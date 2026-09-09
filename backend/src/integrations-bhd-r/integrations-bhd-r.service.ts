import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { ContactType, InvoiceType, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { encryptSecret } from '../common/crypto/secrets.crypto';
import { majorFromAmountMinor } from './bhd-r-money';
import {
  costCenterCodeForProperty,
  formatBhdRAddress,
  pickPartyAddress,
} from './bhd-r-details';
import {
  BhdRAddressDto,
  BhdRInboundEventDto,
  UpdateBhdRSettingsDto,
} from './dto/bhd-r-event.dto';

const TOKEN_PREFIX = 'qk_bhdr_';
const PROPERTIES_URL = 'https://r.bhd-om.com';
const EVENTS_PATH = '/api/integrations/bhd-r/events';
const PUBLIC_ORIGIN = (process.env.FRONTEND_URL || 'https://hisaby.bhd-om.com').replace(/\/+$/, '');

type TaxConfig = {
  applyVat?: boolean;
  vatRate?: number;
};

type ActorCompany = {
  id: string;
  currency: string;
  ftaConfig: Prisma.JsonValue | null;
  bhdRInboundCreatedById: string | null;
};

@Injectable()
export class IntegrationsBhdRService {
  private readonly logger = new Logger(IntegrationsBhdRService.name);

  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
  ) {}

  getStatus(companyId: string) {
    return this.loadStatus(companyId);
  }

  getReadme() {
    return {
      titleAr: 'كيف أربط برنامج العقارات BHD R',
      titleEn: 'How to connect BHD R properties',
      propertiesUrl: PROPERTIES_URL,
      eventsPath: EVENTS_PATH,
      eventsUrl: `${PUBLIC_ORIGIN}${EVENTS_PATH}`,
      sections: [
        {
          id: 'who-creates',
          titleAr: 'من ينشئ أي مفتاح؟',
          stepsAr: [
            'استقبال أحداث العقارات داخل المحاسبة: Hisaby ينشئ رمز التكامل الوارد من إعدادات الشركة.',
            'قراءة كل تفاصيل العقارات (عناوين، وحدات، فواتير، مدفوعات وارد/صادر، حسابات، تواريخ): يُنشأ مفتاح القراءة في موقع العقارات /ar/owner/api-keys بزر «صلاحيات حسابي الكاملة» ثم يُلصق هنا.',
            'بعد لصق مفتاح القراءة تتم المزامنة تلقائياً كل 15 دقيقة بدون تدخل بشري، ويمكن تشغيل مزامنة فورية من هذه الشاشة.',
            'دخول المستخدم اليومي: لا مفتاح — SSO إلى hisaby.bhd-om.com.',
          ],
        },
        {
          id: 'inbound',
          titleAr: 'الربط الأساسي (دفع أحداث من العقارات)',
          stepsAr: [
            'من إعدادات الشركة → تكامل BHD R اضغط «إنشاء رمز تكامل وارد».',
            'انسخ الرمز مرة واحدة. لن يُعرض السر بعد إغلاق النافذة.',
            'في BHD-R الصق الرمز في إعدادات الربط (مرحلة B) واحفظ.',
        'BHD-R يرسل الأحداث إلى POST https://hisaby.bhd-om.com/api/integrations/bhd-r/events مع Authorization: Bearer <الرمز>.',
          ],
        },
        {
          id: 'read-key',
          titleAr: 'مفتاح القراءة والمزامنة التلقائية',
          stepsAr: [
            'افتح https://r.bhd-om.com/ar/owner/api-keys',
            'أنشئ مفتاحاً واضغط «تعبئة صلاحيات حسابي الكاملة» (عقارات، عناوين، أطراف، فواتير، مدفوعات وارد، مصروفات صادر، حسابات، تواريخ).',
            'الصقه هنا تحت «مفتاح قراءة BHD R». Hisaby لا يعيد عرض السر ويبدأ السحب والمزامنة فوراً ثم كل 15 دقيقة.',
          ],
        },
      ],
    };
  }

  async createInboundToken(companyId: string, userId: string) {
    const secret = `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
    const prefix = secret.slice(0, 16);
    const hash = this.hashKey(secret);
    const now = new Date();
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        bhdRInboundTokenHash: hash,
        bhdRInboundTokenPrefix: prefix,
        bhdRInboundCreatedAt: now,
        bhdRInboundCreatedById: userId,
        bhdRInboundLastUsedAt: null,
      },
    });
    return {
      secret,
      prefix,
      createdAt: now.toISOString(),
      warning:
        'انسخ هذا الرمز الآن — لن يُعرض مرة أخرى. الصقه في إعدادات الربط داخل BHD R.',
      eventsPath: EVENTS_PATH,
    };
  }

  async revokeInboundToken(companyId: string) {
    const company = await this.requireCompany(companyId);
    if (!company.bhdRInboundTokenHash) {
      throw new BadRequestException('No inbound token to revoke');
    }
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        bhdRInboundTokenHash: null,
        bhdRInboundTokenPrefix: null,
        bhdRInboundLastUsedAt: null,
      },
    });
    return { revoked: true };
  }

  async updateSettings(companyId: string, dto: UpdateBhdRSettingsDto) {
    const data: Prisma.CompanyUpdateInput = {};
    if (dto.organizationExternalId !== undefined) {
      data.bhdROrganizationExternalId = dto.organizationExternalId.trim() || null;
    }
    if (dto.readApiKey !== undefined) {
      const raw = dto.readApiKey.trim();
      if (!raw) {
        data.bhdRReadApiKeyEnc = null;
      } else {
        data.bhdRReadApiKeyEnc = encryptSecret(raw, {
          purpose: 'payment',
          aad: `bhd-r-read:${companyId}`,
        });
      }
    }
    if (Object.keys(data).length === 0) {
      return this.loadStatus(companyId);
    }
    await this.prisma.company.update({ where: { id: companyId }, data });
    return this.loadStatus(companyId);
  }

  async ingestEvent(rawToken: string, dto: BhdRInboundEventDto, ip?: string) {
    const company = await this.authenticateInbound(rawToken);
    const result = await this.ingestEventForCompany(company, dto);
    this.touchLastUsed(company.id).catch(() => undefined);
    void ip;
    return result;
  }

  async ingestMappedEvent(companyId: string, dto: BhdRInboundEventDto) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isActive: true },
      select: {
        id: true,
        currency: true,
        ftaConfig: true,
        bhdRInboundCreatedById: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return this.ingestEventForCompany(company, dto);
  }

  partyAddressDto(party: {
    addresses?: Array<{ primary?: boolean; address?: Record<string, unknown> | null }>;
    address?: Record<string, unknown> | null;
  }): BhdRAddressDto | undefined {
    return pickPartyAddress(party);
  }

  async upsertBhdRContact(
    companyId: string,
    counterparty: BhdRInboundEventDto['counterparty'],
    preferredType: ContactType,
  ) {
    return this.ensureContact(companyId, counterparty, preferredType);
  }

  async ensurePropertyCostCenter(
    companyId: string,
    property: {
      id: string;
      name?: string;
      serialNumber?: string;
      address?: Record<string, unknown> | BhdRAddressDto | null;
    },
  ) {
    const code = costCenterCodeForProperty(property.id);
    const name = (property.name || 'عقار BHD R').slice(0, 160);
    const addressLine = formatBhdRAddress(property.address || undefined);
    const description = [
      addressLine,
      property.serialNumber ? `مسلسل: ${property.serialNumber}` : null,
      `bhd-r:property:${property.id}`,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 500);
    const existing = await this.prisma.costCenter.findFirst({
      where: { companyId, code },
    });
    if (existing) {
      await this.prisma.costCenter.update({
        where: { id: existing.id },
        data: { name, description, isActive: true },
      });
      return existing.id;
    }
    const created = await this.prisma.costCenter.create({
      data: { companyId, code, name, nameEn: name, description },
    });
    return created.id;
  }

  private async ingestEventForCompany(company: ActorCompany, dto: BhdRInboundEventDto) {
    const existing = await this.prisma.bhdRInboundEvent.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: company.id,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existing?.status === 'processed') {
      return this.toEventResult(existing, true);
    }

    let row = existing;
    if (!row) {
      try {
        row = await this.prisma.bhdRInboundEvent.create({
          data: {
            companyId: company.id,
            idempotencyKey: dto.idempotencyKey,
            type: dto.type,
            payload: dto as unknown as Prisma.InputJsonValue,
            status: 'processing',
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const raced = await this.prisma.bhdRInboundEvent.findUnique({
            where: {
              companyId_idempotencyKey: {
                companyId: company.id,
                idempotencyKey: dto.idempotencyKey,
              },
            },
          });
          if (raced?.status === 'processed') {
            return this.toEventResult(raced, true);
          }
          row = raced;
        } else {
          throw err;
        }
      }
    }
    if (!row) {
      throw new BadRequestException('Could not record inbound event');
    }

    try {
      const result = await this.applyEvent(company, dto);
      const updated = await this.prisma.bhdRInboundEvent.update({
        where: { id: row.id },
        data: {
          status: 'processed',
          invoiceId: result.invoiceId,
          paymentId: result.paymentId,
          errorMessage: null,
        },
      });
      this.logger.log(
        `BHD-R ${dto.type} processed company=${company.id} invoice=${result.invoiceId || '-'}`,
      );
      return this.toEventResult(updated, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Event failed';
      await this.prisma.bhdRInboundEvent.update({
        where: { id: row.id },
        data: { status: 'error', errorMessage: message.slice(0, 2000) },
      });
      throw err;
    }
  }

  private async applyEvent(company: ActorCompany, dto: BhdRInboundEventDto) {
    const amount = majorFromAmountMinor(dto.amountMinor, dto.currency);
    if (amount <= 0) {
      throw new BadRequestException('amountMinor must be greater than zero');
    }
    const userId = await this.resolveActor(company);
    const occurredOn = dto.occurredOn;
    const dueOn = dto.dueOn || occurredOn;
    const orgId = dto.organizationExternalId || dto.organizationId || null;
    const sourceRefs = dto.sourceRefs || {};
    const propertyId = dto.property?.id || dto.propertyId || null;
    const unitId = dto.unit?.id || dto.unitId || null;
    const direction =
      dto.direction ||
      (dto.type === 'expense.paid' || dto.type === 'expense.approved' ? 'outbound' : 'inbound');
    const notes = this.buildNotes(dto, orgId, propertyId, unitId, direction);
    const customFieldsJson = {
      bhdR: {
        source: dto.source || 'bhd-r',
        eventType: dto.type,
        idempotencyKey: dto.idempotencyKey,
        organizationExternalId: orgId,
        direction,
        accountLabel: dto.accountLabel || null,
        occurredOn,
        dueOn,
        propertyId,
        unitId,
        property: dto.property || null,
        unit: dto.unit || null,
        counterparty: dto.counterparty || null,
        bookingId: sourceRefs.bookingId || null,
        invoiceId: sourceRefs.invoiceId || null,
        paymentId: sourceRefs.paymentId || null,
        expenseId: sourceRefs.expenseId || null,
        leaseId: sourceRefs.leaseId || null,
      },
    };
    const taxRate = this.lineTaxRate(company.ftaConfig);
    const isExpense = dto.type === 'expense.paid' || dto.type === 'expense.approved';
    const contact = await this.ensureContact(
      company.id,
      dto.counterparty,
      isExpense ? ContactType.SUPPLIER : ContactType.CUSTOMER,
    );
    const costCenterId = propertyId
      ? await this.ensurePropertyCostCenter(company.id, {
          id: propertyId,
          name: dto.property?.name,
          serialNumber: dto.property?.serialNumber,
          address: dto.property?.address || undefined,
        })
      : undefined;

    const linkedInvoice = await this.findLinkedInvoice(company.id, sourceRefs);
    if (dto.type === 'lease.invoice.issued' && linkedInvoice) {
      return { invoiceId: linkedInvoice.id, paymentId: null };
    }
    if (sourceRefs.expenseId) {
      const linkedExpense = await this.findLinkedInvoice(company.id, {
        expenseId: sourceRefs.expenseId,
      });
      if (linkedExpense && isExpense) {
        return { invoiceId: linkedExpense.id, paymentId: null };
      }
    }
    if (sourceRefs.paymentId) {
      const linkedPayment = await this.findLinkedPayment(company.id, sourceRefs.paymentId);
      if (linkedPayment) {
        return { invoiceId: linkedPayment.invoiceId, paymentId: linkedPayment.id };
      }
    }

    if (dto.type === 'lease.payment.received') {
      const existingInvoice = linkedInvoice;
      if (existingInvoice) {
        const paid = await this.invoices.recordPayment(company.id, userId, existingInvoice.id, {
          method: PaymentMethod.ONLINE,
          amount,
          date: occurredOn,
          reference: sourceRefs.paymentId || dto.idempotencyKey,
          notes,
        });
        const paymentId = paid.payments?.[paid.payments.length - 1]?.id || null;
        return { invoiceId: paid.id, paymentId };
      }
    }

    const payNow =
      dto.type === 'stay.payment.succeeded' ||
      dto.type === 'lease.payment.received' ||
      dto.type === 'expense.paid' ||
      dto.type === 'deposit.released';

    const created = await this.invoices.create(company.id, userId, {
      type: isExpense ? InvoiceType.PURCHASE : InvoiceType.SALES,
      contactId: contact.id,
      date: occurredOn,
      dueDate: dueOn,
      taxRate,
      notes,
      currency: dto.currency.toUpperCase(),
      payImmediately: payNow,
      paymentMethod: payNow ? PaymentMethod.ONLINE : undefined,
      costCenterId,
      customFieldsJson,
      items: [
        {
          description: this.lineDescription(dto),
          quantity: 1,
          unitPrice: amount,
          taxRate,
        },
      ],
    });

    const invoiceId = created.id;
    if (!payNow && dto.type !== 'deposit.held') {
      await this.invoices.send(company.id, userId, invoiceId);
    }
    const payments = (created as { payments?: Array<{ id: string }> }).payments;
    const paymentId = payments?.length ? payments[payments.length - 1].id : null;
    return { invoiceId, paymentId };
  }

  private lineTaxRate(ftaConfig: Prisma.JsonValue | null): number {
    const tax = (ftaConfig as TaxConfig) || {};
    if (tax.applyVat === false) return 0;
    return 0;
  }

  private lineDescription(dto: BhdRInboundEventDto): string {
    const labels: Record<string, string> = {
      'stay.payment.succeeded': 'تحصيل إقامة — BHD R',
      'lease.invoice.issued': 'فاتورة إيجار — BHD R',
      'lease.payment.received': 'تحصيل إيجار — BHD R',
      'expense.paid': 'مصروف عقار مدفوع — BHD R',
      'expense.approved': 'مصروف عقار معتمد — BHD R',
      'deposit.held': 'أمانات محتجزة — BHD R',
      'deposit.released': 'أمانات مفرج عنها — BHD R',
    };
    const propertyName = dto.property?.name?.trim();
    const unitName = dto.unit?.name?.trim() || dto.unit?.code?.trim();
    const place = [propertyName, unitName].filter(Boolean).join(' / ');
    const base = labels[dto.type] || `حدث عقاري — ${dto.type}`;
    const withPlace = place ? `${base} — ${place}` : base;
    return dto.memo?.trim() ? `${withPlace}: ${dto.memo.trim()}` : withPlace;
  }

  private buildNotes(
    dto: BhdRInboundEventDto,
    orgId: string | null,
    propertyId: string | null,
    unitId: string | null,
    direction: string,
  ): string {
    const refs = dto.sourceRefs || {};
    const address = formatBhdRAddress(dto.property?.address || dto.counterparty?.address);
    const tags = [
      `bhd-r:${dto.type}`,
      `bhd-r:direction:${direction}`,
      orgId ? `bhd-r:org:${orgId}` : null,
      propertyId ? `bhd-r:property:${propertyId}` : null,
      unitId ? `bhd-r:unit:${unitId}` : null,
      refs.bookingId ? `bhd-r:booking:${refs.bookingId}` : null,
      refs.invoiceId ? `bhd-r:invoice:${refs.invoiceId}` : null,
      refs.paymentId ? `bhd-r:payment:${refs.paymentId}` : null,
      refs.expenseId ? `bhd-r:expense:${refs.expenseId}` : null,
      refs.leaseId ? `bhd-r:lease:${refs.leaseId}` : null,
      dto.accountLabel ? `bhd-r:account:${dto.accountLabel}` : null,
      `bhd-r:idemp:${dto.idempotencyKey}`,
    ].filter(Boolean);
    const memo = dto.memo?.trim();
    const due = dto.dueOn ? `استحقاق: ${dto.dueOn}` : null;
    const occurred = `تاريخ: ${dto.occurredOn}`;
    return [memo, address, occurred, due, tags.join(' ')].filter(Boolean).join('\n');
  }

  private async findLinkedInvoice(
    companyId: string,
    refs: { invoiceId?: string; bookingId?: string; expenseId?: string },
  ) {
    const needles = [
      refs.invoiceId ? `bhd-r:invoice:${refs.invoiceId}` : null,
      refs.bookingId ? `bhd-r:booking:${refs.bookingId}` : null,
      refs.expenseId ? `bhd-r:expense:${refs.expenseId}` : null,
    ].filter((value): value is string => !!value);
    if (!needles.length) return null;
    for (const needle of needles) {
      const row = await this.prisma.invoice.findFirst({
        where: { companyId, notes: { contains: needle } },
        orderBy: { createdAt: 'desc' },
      });
      if (row) return row;
    }
    return null;
  }

  private async findLinkedPayment(companyId: string, paymentId: string) {
    return this.prisma.payment.findFirst({
      where: {
        invoice: { companyId },
        OR: [
          { reference: paymentId },
          { notes: { contains: `bhd-r:payment:${paymentId}` } },
        ],
      },
      select: { id: true, invoiceId: true },
    });
  }

  private async ensureContact(
    companyId: string,
    counterparty: BhdRInboundEventDto['counterparty'],
    preferredType: ContactType,
  ) {
    const name = counterparty?.name?.trim() || 'جهة BHD R';
    const externalId = counterparty?.externalId?.trim();
    const addressLine = formatBhdRAddress(counterparty?.address);
    const details = {
      email: counterparty?.email?.trim() || undefined,
      phone: counterparty?.phone?.trim() || undefined,
      taxId: counterparty?.taxId?.trim() || undefined,
      address: addressLine || undefined,
      city: counterparty?.address?.city?.trim() || undefined,
      country: counterparty?.address?.countryCode?.trim() || undefined,
    };

    const applyDetails = async (id: string, currentType: ContactType) => {
      await this.widenContactType(id, currentType, preferredType);
      await this.prisma.contact.update({
        where: { id },
        data: {
          name,
          ...(details.email ? { email: details.email } : {}),
          ...(details.phone ? { phone: details.phone } : {}),
          ...(details.taxId ? { taxId: details.taxId } : {}),
          ...(details.address ? { address: details.address } : {}),
          ...(details.city ? { city: details.city } : {}),
          ...(details.country ? { country: details.country } : {}),
          customFieldsJson: {
            bhdR: {
              externalId: externalId || null,
              source: 'bhd-r',
              address: counterparty?.address || null,
            },
          },
        },
      });
    };

    if (externalId) {
      const tagged = await this.prisma.contact.findFirst({
        where: {
          companyId,
          notes: { contains: `bhd-r:party:${externalId}` },
        },
      });
      if (tagged) {
        await applyDetails(tagged.id, tagged.type);
        return this.prisma.contact.findUniqueOrThrow({ where: { id: tagged.id } });
      }
    }
    const byName = await this.prisma.contact.findFirst({
      where: { companyId, name, isActive: true },
    });
    if (byName) {
      await applyDetails(byName.id, byName.type);
      return this.prisma.contact.findUniqueOrThrow({ where: { id: byName.id } });
    }

    const type =
      preferredType === ContactType.SUPPLIER ? ContactType.SUPPLIER : ContactType.CUSTOMER;
    return this.prisma.contact.create({
      data: {
        companyId,
        type,
        name,
        email: details.email,
        phone: details.phone,
        taxId: details.taxId,
        address: details.address,
        city: details.city,
        country: details.country || 'OM',
        notes: externalId ? `bhd-r:party:${externalId}` : 'جهة من تكامل BHD R',
        customFieldsJson: {
          bhdR: {
            externalId: externalId || null,
            source: 'bhd-r',
            address: counterparty?.address || null,
          },
        },
      },
    });
  }

  private async widenContactType(
    id: string,
    current: ContactType,
    needed: ContactType,
  ) {
    if (current === ContactType.BOTH || current === needed) return;
    await this.prisma.contact.update({
      where: { id },
      data: { type: ContactType.BOTH },
    });
  }

  private async resolveActor(company: {
    id: string;
    bhdRInboundCreatedById: string | null;
  }) {
    if (company.bhdRInboundCreatedById) {
      const creator = await this.prisma.user.findFirst({
        where: {
          id: company.bhdRInboundCreatedById,
          companyId: company.id,
          isActive: true,
        },
        select: { id: true },
      });
      if (creator) return creator.id;
    }
    const admin = await this.prisma.user.findFirst({
      where: { companyId: company.id, role: 'ADMIN', isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      throw new BadRequestException('Company has no active admin to post BHD-R documents');
    }
    return admin.id;
  }

  private async authenticateInbound(rawToken: string) {
    const secret = rawToken.trim();
    if (!secret.startsWith(TOKEN_PREFIX) || secret.length < 20) {
      throw new UnauthorizedException('Invalid inbound token');
    }
    const hash = this.hashKey(secret);
    const company = await this.prisma.company.findFirst({
      where: { bhdRInboundTokenHash: hash, isActive: true },
      select: {
        id: true,
        currency: true,
        ftaConfig: true,
        bhdRInboundCreatedById: true,
        bhdRInboundTokenHash: true,
      },
    });
    if (!company?.bhdRInboundTokenHash) {
      throw new UnauthorizedException('Invalid inbound token');
    }
    const left = Buffer.from(company.bhdRInboundTokenHash);
    const right = Buffer.from(hash);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Invalid inbound token');
    }
    return company;
  }

  private async loadStatus(companyId: string) {
    const company = await this.requireCompany(companyId);
    return {
      inbound: {
        configured: !!company.bhdRInboundTokenHash,
        prefix: company.bhdRInboundTokenPrefix,
        createdAt: company.bhdRInboundCreatedAt,
        lastUsedAt: company.bhdRInboundLastUsedAt,
      },
      readKey: { configured: !!company.bhdRReadApiKeyEnc },
      organizationExternalId: company.bhdROrganizationExternalId,
      sync: {
        automatic: !!company.bhdRReadApiKeyEnc,
        intervalMinutes: 15,
        lastSyncAt: company.bhdRLastSyncAt,
        lastError: company.bhdRLastSyncError,
        lastSummary: company.bhdRLastSyncSummary,
      },
      eventsPath: EVENTS_PATH,
      eventsUrl: `${PUBLIC_ORIGIN}${EVENTS_PATH}`,
      propertiesUrl: PROPERTIES_URL,
      propertiesApiKeysUrl: `${PROPERTIES_URL}/ar/owner/api-keys`,
      ssoUrl: PROPERTIES_URL,
    };
  }

  private async requireCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        bhdRInboundTokenHash: true,
        bhdRInboundTokenPrefix: true,
        bhdRInboundCreatedAt: true,
        bhdRInboundLastUsedAt: true,
        bhdRReadApiKeyEnc: true,
        bhdROrganizationExternalId: true,
        bhdRLastSyncAt: true,
        bhdRLastSyncError: true,
        bhdRLastSyncSummary: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private hashKey(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private touchLastUsed(companyId: string) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { bhdRInboundLastUsedAt: new Date() },
    });
  }

  private toEventResult(
    row: {
      id: string;
      type: string;
      status: string;
      invoiceId: string | null;
      paymentId: string | null;
      idempotencyKey: string;
    },
    duplicate: boolean,
  ) {
    return {
      duplicate,
      eventId: row.id,
      idempotencyKey: row.idempotencyKey,
      type: row.type,
      status: row.status,
      invoiceId: row.invoiceId,
      paymentId: row.paymentId,
    };
  }
}
