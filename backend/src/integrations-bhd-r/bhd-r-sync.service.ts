import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContactType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/crypto/secrets.crypto';
import { IntegrationsBhdRService } from './integrations-bhd-r.service';
import {
  BhdRApiClient,
  BhdRExpenseRow,
  BhdRInvoiceRow,
  BhdRLeaseRow,
  BhdRPartyRow,
  BhdRPaymentRow,
  BhdRPropertyRow,
  BhdRVendorRow,
} from './bhd-r-api.client';
import {
  isCancelledStatus,
  isSuccessfulPayment,
  mapExpensePull,
  mapInvoicePull,
  mapPaymentPull,
} from './bhd-r-details';

export type BhdRSyncSummary = {
  properties: number;
  parties: number;
  invoices: number;
  payments: number;
  expenses: number;
  skipped: number;
  errors: string[];
};

@Injectable()
export class BhdRSyncService {
  private readonly logger = new Logger(BhdRSyncService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private ingest: IntegrationsBhdRService,
    private api: BhdRApiClient,
  ) {}

  @Cron('*/15 * * * *')
  async cronSyncAll() {
    if (this.disabled()) return;
    const companies = await this.prisma.company.findMany({
      where: { isActive: true, bhdRReadApiKeyEnc: { not: null } },
      select: { id: true },
    });
    for (const company of companies) {
      await this.syncCompany(company.id).catch((err) => {
        this.logger.error(
          `BHD-R auto-sync failed company=${company.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }
  }

  async syncCompany(companyId: string): Promise<{ summary: BhdRSyncSummary; lastSyncAt: string }> {
    if (this.inFlight.has(companyId)) {
      throw new BadRequestException('A BHD-R sync is already running for this company');
    }
    this.inFlight.add(companyId);
    const summary: BhdRSyncSummary = {
      properties: 0,
      parties: 0,
      invoices: 0,
      payments: 0,
      expenses: 0,
      skipped: 0,
      errors: [],
    };
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, bhdRReadApiKeyEnc: true, isActive: true },
      });
      if (!company?.isActive || !company.bhdRReadApiKeyEnc) {
        throw new BadRequestException('Save a BHD-R read API key to enable automatic sync');
      }
      const apiKey = decryptSecret(company.bhdRReadApiKeyEnc, {
        purpose: 'payment',
        aad: `bhd-r-read:${companyId}`,
      });

      const snapshot = await this.api
        .getJson<{
          properties?: BhdRPropertyRow[];
          parties?: BhdRPartyRow[];
          leases?: BhdRLeaseRow[];
          invoices?: BhdRInvoiceRow[];
          payments?: BhdRPaymentRow[];
          expenses?: BhdRExpenseRow[];
        }>('/v1/integrations/hisaby/export', apiKey)
        .catch((err) => {
          this.logger.warn(
            `BHD-R export unavailable, falling back to list endpoints: ${err instanceof Error ? err.message : err}`,
          );
          return null;
        });

      const [fallbackProperties, fallbackParties, fallbackLeases, fallbackInvoices, fallbackPayments, fallbackExpenses, vendors] =
        snapshot
          ? [[], [], [], [], [], [], await this.safeList<BhdRVendorRow>('/v1/operations/vendors', apiKey, summary)]
          : await Promise.all([
              this.safeList<BhdRPropertyRow>('/v1/portfolio/properties', apiKey, summary),
              this.safeList<BhdRPartyRow>('/v1/parties', apiKey, summary),
              this.safeList<BhdRLeaseRow>('/v1/leasing/leases', apiKey, summary),
              this.safeList<BhdRInvoiceRow>('/v1/finance/invoices', apiKey, summary),
              this.safeList<BhdRPaymentRow>('/v1/finance/payments', apiKey, summary),
              this.safeList<BhdRExpenseRow>('/v1/accounting/expenses', apiKey, summary),
              this.safeList<BhdRVendorRow>('/v1/operations/vendors', apiKey, summary),
            ]);

      const properties = snapshot?.properties ?? fallbackProperties;
      const parties = snapshot?.parties ?? fallbackParties;
      const leases = snapshot?.leases ?? fallbackLeases;
      const invoices = snapshot?.invoices ?? fallbackInvoices;
      const payments = snapshot?.payments ?? fallbackPayments;
      const expenses = snapshot?.expenses ?? fallbackExpenses;

      const propertyById = new Map(properties.map((row) => [row.id, row]));
      const unitById = new Map<string, Record<string, unknown> & { id: string; propertyId?: string }>();
      for (const property of properties) {
        await this.ingest.ensurePropertyCostCenter(companyId, {
          id: property.id,
          name: String(property.nameAr || property.nameEn || 'عقار BHD R'),
          serialNumber: property.serialNumber ? String(property.serialNumber) : undefined,
          address: (property.address as Record<string, unknown> | null) || undefined,
        });
        summary.properties += 1;
        for (const unit of property.units || []) {
          if (unit?.id) unitById.set(String(unit.id), { ...unit, propertyId: property.id });
        }
      }

      const partyById = new Map(parties.map((row) => [row.id, row]));
      for (const party of parties) {
        const roles = Array.isArray(party.roles) ? party.roles : [];
        const supplier = roles.includes('supplier');
        const preferred = supplier && !roles.includes('tenant') && !roles.includes('owner')
          ? ContactType.SUPPLIER
          : ContactType.CUSTOMER;
        await this.ingest.upsertBhdRContact(companyId, {
          name: String(party.displayName || 'جهة BHD R'),
          externalId: party.id,
          email: party.email || undefined,
          phone: party.phone || undefined,
          address: this.ingest.partyAddressDto(party),
        }, preferred);
        summary.parties += 1;
      }

      const vendorById = new Map(vendors.map((row) => [row.id, row]));
      const leaseById = new Map(leases.map((row) => [row.id, row]));
      const invoiceById = new Map(invoices.map((row) => [row.id, row]));

      for (const invoice of invoices) {
        if (isCancelledStatus(invoice.status)) {
          summary.skipped += 1;
          continue;
        }
        const lease = invoice.leaseId ? leaseById.get(String(invoice.leaseId)) : undefined;
        const unit = lease?.unitId ? unitById.get(String(lease.unitId)) : undefined;
        const property = unit?.propertyId ? propertyById.get(String(unit.propertyId)) : undefined;
        const party = invoice.tenantPartyId
          ? partyById.get(String(invoice.tenantPartyId))
          : lease?.tenantPartyId
            ? partyById.get(String(lease.tenantPartyId))
            : undefined;
        const ok = await this.tryIngest(
          companyId,
          mapInvoicePull({ invoice, party, property, unit, lease }),
          summary,
        );
        if (ok) summary.invoices += 1;
      }

      for (const payment of payments) {
        if (!isSuccessfulPayment(payment.status) || isCancelledStatus(payment.status)) {
          summary.skipped += 1;
          continue;
        }
        const invoice = payment.invoiceId ? invoiceById.get(String(payment.invoiceId)) : undefined;
        const lease = invoice?.leaseId ? leaseById.get(String(invoice.leaseId)) : undefined;
        const unit = lease?.unitId ? unitById.get(String(lease.unitId)) : undefined;
        const property = unit?.propertyId ? propertyById.get(String(unit.propertyId)) : undefined;
        const party = invoice?.tenantPartyId
          ? partyById.get(String(invoice.tenantPartyId))
          : undefined;
        const ok = await this.tryIngest(
          companyId,
          mapPaymentPull({ payment, party, property, unit }),
          summary,
        );
        if (ok) summary.payments += 1;
      }

      for (const expense of expenses) {
        if (isCancelledStatus(expense.status)) {
          summary.skipped += 1;
          continue;
        }
        const property = expense.propertyId
          ? propertyById.get(String(expense.propertyId))
          : undefined;
        const unit = expense.unitId ? unitById.get(String(expense.unitId)) : undefined;
        const vendor = expense.vendorId ? vendorById.get(String(expense.vendorId)) : undefined;
        const party = vendor?.partyId ? partyById.get(String(vendor.partyId)) : undefined;
        const ok = await this.tryIngest(
          companyId,
          mapExpensePull({ expense, vendor, party, property, unit }),
          summary,
        );
        if (ok) summary.expenses += 1;
      }

      const now = new Date();
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          bhdRLastSyncAt: now,
          bhdRLastSyncError: summary.errors.length ? summary.errors.slice(0, 8).join('\n') : null,
          bhdRLastSyncSummary: summary as Prisma.InputJsonValue,
        },
      });
      this.logger.log(
        `BHD-R sync company=${companyId} properties=${summary.properties} invoices=${summary.invoices} payments=${summary.payments} expenses=${summary.expenses}`,
      );
      return { summary, lastSyncAt: now.toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'BHD-R sync failed';
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          bhdRLastSyncAt: new Date(),
          bhdRLastSyncError: message.slice(0, 2000),
        },
      });
      throw err;
    } finally {
      this.inFlight.delete(companyId);
    }
  }

  private disabled() {
    const raw = (process.env.BHD_R_SYNC_DISABLED || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }

  private async safeList<T>(path: string, apiKey: string, summary: BhdRSyncSummary): Promise<T[]> {
    try {
      const rows = await this.api.getJson<T[] | { items?: T[]; data?: T[] }>(path, apiKey);
      if (Array.isArray(rows)) return rows;
      if (Array.isArray(rows?.items)) return rows.items;
      if (Array.isArray(rows?.data)) return rows.data;
      return [];
    } catch (err) {
      summary.errors.push(`${path}: ${err instanceof Error ? err.message : 'fetch failed'}`);
      return [];
    }
  }

  private async tryIngest(
    companyId: string,
    dto: Parameters<IntegrationsBhdRService['ingestMappedEvent']>[1],
    summary: BhdRSyncSummary,
  ) {
    try {
      if (!/^[1-9]\d*$/.test(String(dto.amountMinor || '').trim())) {
        summary.skipped += 1;
        return false;
      }
      await this.ingest.ingestMappedEvent(companyId, dto);
      return true;
    } catch (err) {
      summary.errors.push(
        `${dto.idempotencyKey}: ${err instanceof Error ? err.message : 'ingest failed'}`.slice(0, 240),
      );
      return false;
    }
  }
}
