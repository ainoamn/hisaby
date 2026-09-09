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
      city?: string;
      street?: string;
      governorate?: string;
      wilayat?: string;
      countryCode?: string;
    }>;
    address?: Record<string, unknown> | null;
  } | null,
): BhdRAddressDto | undefined {
  if (!party) return undefined;
  const first = party.addresses?.find((row) => row.primary) || party.addresses?.[0];
  const nested =
    first?.address ||
    (first && (first.city || first.street || first.governorate) ? first : null) ||
    party.address ||
    null;
  if (!nested) return undefined;
  const rec = nested as Record<string, unknown>;
  const line = formatBhdRAddress(rec);
  return {
    line: line || undefined,
    city: str(rec.city),
    governorate: str(rec.governorate),
    wilayat: str(rec.wilayat),
    countryCode: str(rec.countryCode)?.slice(0, 2),
  };
}

const WORKER_TYPE_MAP: Record<string, BhdRInboundEventDto['type'] | 'skip'> = {
  'stay.payment.succeeded': 'stay.payment.succeeded',
  'stay_booking.payment_confirmed': 'stay.payment.succeeded',
  'lease.invoice.issued': 'lease.invoice.issued',
  'invoice.issued': 'lease.invoice.issued',
  'lease.payment.received': 'lease.payment.received',
  'payment.recorded': 'lease.payment.received',
  'receipt.issued': 'lease.payment.received',
  'expense.paid': 'expense.paid',
  'expense.approved': 'expense.approved',
  'deposit.held': 'deposit.held',
  'reservation.deposit_confirmed': 'deposit.held',
  'deposit.released': 'deposit.released',
  'payment.refunded': 'skip',
  'cheque.created': 'skip',
  'accounting.journal.posted': 'skip',
  'accounting.journal-posted': 'skip',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function minorFrom(raw: Record<string, unknown>, payload: Record<string, unknown>): string | undefined {
  const value =
    raw.amountMinor ??
    payload.amountMinor ??
    payload.totalMinor ??
    payload.paidMinor ??
    payload.rentMinor;
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return /^-?\d+$/.test(text) ? text : undefined;
}

/** Flatten BHD-R worker push bodies into the Hisaby inbound event DTO. */
export function normalizeBhdRInboundBody(raw: unknown): {
  skip: boolean;
  skipReason?: string;
  body: Record<string, unknown>;
} {
  const input = asRecord(raw);
  const payload = asRecord(input.payload);
  const mapped = WORKER_TYPE_MAP[String(input.type || '').trim()] || 'skip';
  const idempotencyKey = String(
    input.idempotencyKey || input.eventId || payload.id || `bhd-r:evt:${Date.now()}`,
  ).slice(0, 180);
  const occurredOn = toIsoDateTime(
    str(input.occurredOn) || str(payload.occurredOn) || str(payload.issuedOn) || str(payload.receivedAt),
  );
  if (mapped === 'skip' || idempotencyKey.length < 8) {
    return {
      skip: true,
      skipReason: mapped === 'skip' ? `unsupported_type:${String(input.type || '')}` : 'bad_idempotency',
      body: {
        idempotencyKey: idempotencyKey.padEnd(8, '0').slice(0, 180),
        type: 'stay.payment.succeeded',
        occurredOn,
        amountMinor: '1',
        currency: 'OMR',
      },
    };
  }
  const amountMinor = minorFrom(input, payload);
  if (!amountMinor || amountMinor === '0') {
    return {
      skip: true,
      skipReason: 'missing_amount',
      body: {
        idempotencyKey,
        type: mapped,
        occurredOn,
        amountMinor: '1',
        currency: 'OMR',
      },
    };
  }
  const cp = asRecord(input.counterparty);
  const counterparty = str(cp.name)
    ? input.counterparty
    : payload.guestName
      ? { name: String(payload.guestName) }
      : undefined;
  const refs = asRecord(input.sourceRefs);
  return {
    skip: false,
    body: {
      idempotencyKey,
      type: mapped,
      occurredOn,
      dueOn: input.dueOn || payload.dueOn
        ? toIsoDateTime(str(input.dueOn) || str(payload.dueOn))
        : undefined,
      amountMinor,
      currency: String(input.currency || payload.currency || 'OMR')
        .trim()
        .toUpperCase()
        .slice(0, 3),
      direction: input.direction || undefined,
      accountLabel: input.accountLabel || undefined,
      organizationExternalId:
        input.organizationExternalId || input.organizationId || payload.organizationId,
      organizationId: input.organizationId,
      propertyId: input.propertyId || payload.propertyId,
      unitId: input.unitId || payload.unitId,
      source: str(input.source) || 'bhd-r',
      counterparty,
      property: input.property,
      unit: input.unit,
      memo: String(input.memo || payload.memo || payload.notes || payload.description || '').slice(
        0,
        500,
      ) || undefined,
      sourceRefs: {
        bookingId: refs.bookingId || payload.bookingId,
        invoiceId: refs.invoiceId || payload.invoiceId,
        paymentId: refs.paymentId || payload.paymentId,
        expenseId: refs.expenseId || payload.expenseId,
        leaseId: refs.leaseId || payload.leaseId,
      },
    },
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
