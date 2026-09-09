import type { BhdRAddressDto, BhdRInboundEventDto } from './dto/bhd-r-event.dto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function formatBhdRAddress(
  address?: BhdRAddressDto | Record<string, unknown> | null,
): string | null {
  if (!address || typeof address !== 'object') return null;
  const rec = address as Record<string, unknown>;
  const parts = [
    rec.line,
    rec.buildingNumber,
    rec.street,
    rec.area,
    rec.wilayat,
    rec.city,
    rec.governorate,
    rec.countryCode,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part);
  }
  return unique.length ? unique.join('، ') : null;
}

export function toIsoDateTime(value?: string | Date | null): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00.000Z`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export function sanitizeEmail(value?: string | null): string | undefined {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : undefined;
}

export function costCenterCodeForProperty(propertyId: string): string {
  const compact = propertyId.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `BR-${compact || 'PROPERTY'}`;
}

export function pickPartyAddress(
  party?: {
    addresses?: Array<{
      primary?: boolean;
      address?: Record<string, unknown> | null;
    }>;
    address?: Record<string, unknown> | null;
  } | null,
): BhdRAddressDto | undefined {
  if (!party) return undefined;
  const nested =
    party.addresses?.find((row) => row.primary)?.address ||
    party.addresses?.[0]?.address ||
    party.address ||
    null;
  if (!nested) return undefined;
  const line = formatBhdRAddress(nested);
  return {
    line: line || undefined,
    city: str(nested.city),
    governorate: str(nested.governorate),
    wilayat: str(nested.wilayat),
    countryCode: str(nested.countryCode)?.slice(0, 2),
  };
}

export function propertyAddressFromRecord(
  property?: Record<string, unknown> | null,
): BhdRAddressDto | undefined {
  if (!property) return undefined;
  const nested =
    (property.address as Record<string, unknown> | undefined) ||
    (property as { address?: Record<string, unknown> }).address;
  if (!nested) return undefined;
  return {
    line: formatBhdRAddress(nested) || undefined,
    city: str(nested.city),
    governorate: str(nested.governorate),
    wilayat: str(nested.wilayat),
    countryCode: str(nested.countryCode)?.slice(0, 2),
  };
}

export function isSuccessfulPayment(status?: string | null): boolean {
  const value = String(status || '').toLowerCase();
  if (!value) return true;
  return ['succeeded', 'completed', 'paid', 'captured', 'settled', 'cleared', 'success'].includes(
    value,
  );
}

export function isCancelledStatus(status?: string | null): boolean {
  const value = String(status || '').toLowerCase();
  return ['cancelled', 'canceled', 'void', 'rejected', 'failed'].includes(value);
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function mapInvoicePull(input: {
  invoice: Record<string, unknown>;
  party?: Record<string, unknown> | null;
  property?: Record<string, unknown> | null;
  unit?: Record<string, unknown> | null;
  lease?: Record<string, unknown> | null;
}): BhdRInboundEventDto {
  const inv = input.invoice;
  const id = String(inv.id || '');
  const propertyId =
    str(input.property?.id) ||
    str(input.lease?.propertyId) ||
    str(input.unit?.propertyId);
  const unitId = str(input.lease?.unitId) || str(input.unit?.id);
  return {
    idempotencyKey: `bhd-r:pull:invoice:${id}`.slice(0, 180),
    type: 'lease.invoice.issued',
    occurredOn: toIsoDateTime(str(inv.issuedOn) || str(inv.createdAt)),
    dueOn: toIsoDateTime(str(inv.dueOn) || str(inv.issuedOn)),
    amountMinor: String(inv.totalMinor ?? '0'),
    currency: String(inv.currency || 'OMR').toUpperCase(),
    direction: 'inbound',
    accountLabel: 'حساب الإيجار — وارد',
    organizationExternalId: str(inv.organizationId),
    propertyId,
    unitId,
    source: 'bhd-r-pull',
    counterparty: mapCounterparty(input.party),
    property: mapProperty(input.property, propertyId),
    unit: mapUnit(input.unit, unitId),
    memo: str(inv.notes) || `فاتورة ${str(inv.invoiceNumber) || id}`,
    sourceRefs: {
      invoiceId: id,
      leaseId: str(inv.leaseId),
    },
  };
}

export function mapPaymentPull(input: {
  payment: Record<string, unknown>;
  party?: Record<string, unknown> | null;
  property?: Record<string, unknown> | null;
  unit?: Record<string, unknown> | null;
}): BhdRInboundEventDto {
  const pay = input.payment;
  const id = String(pay.id || '');
  const propertyId = str(input.property?.id) || str(input.unit?.propertyId);
  const unitId = str(input.unit?.id);
  return {
    idempotencyKey: `bhd-r:pull:payment:${id}`.slice(0, 180),
    type: 'lease.payment.received',
    occurredOn: toIsoDateTime(str(pay.receivedAt) || str(pay.createdAt)),
    amountMinor: String(pay.amountMinor ?? '0'),
    currency: String(pay.currency || 'OMR').toUpperCase(),
    direction: 'inbound',
    accountLabel: str(pay.method) ? `وارد — ${str(pay.method)}` : 'حساب التحصيل — وارد',
    organizationExternalId: str(pay.organizationId),
    propertyId,
    unitId,
    source: 'bhd-r-pull',
    counterparty: mapCounterparty(input.party),
    property: mapProperty(input.property, propertyId),
    unit: mapUnit(input.unit, unitId),
    memo: str(pay.providerReference) || `تحصيل ${id}`,
    sourceRefs: {
      paymentId: id,
      invoiceId: str(pay.invoiceId),
    },
  };
}

export function mapExpensePull(input: {
  expense: Record<string, unknown>;
  vendor?: Record<string, unknown> | null;
  party?: Record<string, unknown> | null;
  property?: Record<string, unknown> | null;
  unit?: Record<string, unknown> | null;
}): BhdRInboundEventDto {
  const exp = input.expense;
  const id = String(exp.id || '');
  const paid = Boolean(exp.paidAt) || String(exp.status || '').toLowerCase() === 'paid';
  const propertyId = str(exp.propertyId) || str(input.property?.id);
  const unitId = str(exp.unitId) || str(input.unit?.id);
  const vendorName = str(input.vendor?.name) || str(input.party?.displayName);
  return {
    idempotencyKey: `bhd-r:pull:expense:${id}`.slice(0, 180),
    type: paid ? 'expense.paid' : 'expense.approved',
    occurredOn: toIsoDateTime(str(exp.paidAt) || str(exp.issuedOn) || str(exp.createdAt)),
    dueOn: str(exp.dueOn) ? toIsoDateTime(str(exp.dueOn)) : undefined,
    amountMinor: String(exp.amountMinor ?? '0'),
    currency: String(exp.currency || 'OMR').toUpperCase(),
    direction: 'outbound',
    accountLabel: str(exp.category) ? `صادر — ${str(exp.category)}` : 'حساب المصروفات — صادر',
    organizationExternalId: str(exp.organizationId),
    propertyId,
    unitId,
    source: 'bhd-r-pull',
    counterparty: {
      name: vendorName || 'مورد عقاري',
      externalId: str(input.vendor?.id) || str(input.vendor?.partyId) || str(input.party?.id),
      email: sanitizeEmail(str(input.vendor?.email) || str(input.party?.email)),
      phone: str(input.vendor?.phone) || str(input.party?.phone),
      address: pickPartyAddress(input.party),
    },
    property: mapProperty(input.property, propertyId),
    unit: mapUnit(input.unit, unitId),
    memo: str(exp.description) || str(exp.reference) || `مصروف ${id}`,
    sourceRefs: { expenseId: id },
  };
}

function mapCounterparty(party?: Record<string, unknown> | null) {
  if (!party) return { name: 'جهة BHD R' };
  return {
    name: str(party.displayName) || str(party.name) || 'جهة BHD R',
    externalId: str(party.id),
    email: sanitizeEmail(str(party.email)),
    phone: str(party.phone),
    address: pickPartyAddress(party),
  };
}

function mapProperty(property?: Record<string, unknown> | null, fallbackId?: string) {
  const id = str(property?.id) || fallbackId;
  if (!id && !property) return undefined;
  return {
    id,
    name: str(property?.nameAr) || str(property?.nameEn) || str(property?.name),
    serialNumber: str(property?.serialNumber),
    address: propertyAddressFromRecord(property),
  };
}

function mapUnit(unit?: Record<string, unknown> | null, fallbackId?: string) {
  const id = str(unit?.id) || fallbackId;
  if (!id && !unit) return undefined;
  return {
    id,
    name: str(unit?.nameAr) || str(unit?.nameEn) || str(unit?.name),
    code: str(unit?.code),
  };
}
