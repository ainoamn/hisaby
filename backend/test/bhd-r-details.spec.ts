import {
  costCenterCodeForProperty,
  formatBhdRAddress,
  mapExpensePull,
  mapInvoicePull,
  mapPaymentPull,
  normalizeBhdRInboundBody,
  sanitizeEmail,
  toIsoDateTime,
} from '../src/integrations-bhd-r/bhd-r-details';

describe('BHD-R detail mapping', () => {
  it('formats Omani property addresses', () => {
    expect(
      formatBhdRAddress({
        buildingNumber: '12',
        street: 'شارع السلطان',
        city: 'مسقط',
        wilayat: 'بوشر',
        governorate: 'مسقط',
        countryCode: 'OM',
      }),
    ).toBe('12، شارع السلطان، بوشر، مسقط، OM');
  });

  it('converts date-only values to ISO datetimes', () => {
    expect(toIsoDateTime('2026-09-30')).toBe('2026-09-30T00:00:00.000Z');
  });

  it('maps lease invoices as inbound with due dates and property', () => {
    const dto = mapInvoicePull({
      invoice: {
        id: 'inv-1',
        organizationId: 'org-1',
        leaseId: 'lease-1',
        tenantPartyId: 'pty-1',
        invoiceNumber: 'INV-9',
        totalMinor: '150000',
        currency: 'OMR',
        issuedOn: '2026-09-01',
        dueOn: '2026-09-15',
        notes: 'إيجار سبتمبر',
      },
      party: {
        id: 'pty-1',
        displayName: 'أحمد',
        email: 'ahmed@example.com',
        phone: '96890000000',
        addresses: [
          {
            primary: true,
            address: { city: 'مسقط', governorate: 'مسقط', street: 'الخوير' },
          },
        ],
      },
      property: {
        id: 'prop-1',
        nameAr: 'برج النور',
        serialNumber: 'SN-1',
        address: { city: 'مسقط', street: 'القرم' },
      },
      unit: { id: 'unit-1', nameAr: 'شقة 12', code: 'A-12', propertyId: 'prop-1' },
      lease: { id: 'lease-1', unitId: 'unit-1', tenantPartyId: 'pty-1' },
    });
    expect(dto.type).toBe('lease.invoice.issued');
    expect(dto.direction).toBe('inbound');
    expect(dto.dueOn).toBe('2026-09-15T00:00:00.000Z');
    expect(dto.property?.name).toBe('برج النور');
    expect(dto.property?.address?.city).toBe('مسقط');
    expect(dto.counterparty?.address?.city).toBe('مسقط');
    expect(dto.sourceRefs?.invoiceId).toBe('inv-1');
    expect(costCenterCodeForProperty('prop-1')).toMatch(/^BR-/);
  });

  it('maps expenses as outbound paid/approved', () => {
    const dto = mapExpensePull({
      expense: {
        id: 'exp-1',
        amountMinor: '25000',
        currency: 'OMR',
        status: 'approved',
        issuedOn: '2026-09-02',
        dueOn: '2026-09-10',
        category: 'maintenance',
        description: 'سباكة',
        propertyId: 'prop-1',
      },
      vendor: { id: 'vnd-1', name: 'مؤسسة الصيانة', email: 'bad', phone: '123' },
      property: { id: 'prop-1', nameAr: 'برج النور' },
    });
    expect(dto.type).toBe('expense.approved');
    expect(dto.direction).toBe('outbound');
    expect(dto.accountLabel).toContain('صادر');
    expect(dto.counterparty?.email).toBeUndefined();
    expect(sanitizeEmail('ok@t.co')).toBe('ok@t.co');
  });

  it('maps inbound payments onto source invoices', () => {
    const dto = mapPaymentPull({
      payment: {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amountMinor: '150000',
        currency: 'OMR',
        method: 'bank',
        receivedAt: '2026-09-09T10:00:00.000Z',
        status: 'succeeded',
      },
    });
    expect(dto.type).toBe('lease.payment.received');
    expect(dto.direction).toBe('inbound');
    expect(dto.sourceRefs?.paymentId).toBe('pay-1');
    expect(dto.sourceRefs?.invoiceId).toBe('inv-1');
  });

  it('flattens BHD-R worker push bodies onto the inbound contract', () => {
    const { skip, body } = normalizeBhdRInboundBody({
      type: 'invoice.issued',
      idempotencyKey: 'bhd-r:outbox:evt-1',
      payload: { amountMinor: '150000', currency: 'OMR', invoiceId: 'inv-1', propertyId: 'prop-1' },
    });
    expect(skip).toBe(false);
    expect(body.type).toBe('lease.invoice.issued');
    expect(body.amountMinor).toBe('150000');
    expect((body.sourceRefs as { invoiceId?: string }).invoiceId).toBe('inv-1');
  });

  it('ignores informational worker topics so auto-push does not fail', () => {
    const { skip, skipReason } = normalizeBhdRInboundBody({
      type: 'accounting.journal.posted',
      idempotencyKey: 'bhd-r:outbox:evt-2',
    });
    expect(skip).toBe(true);
    expect(skipReason).toContain('unsupported_type');
  });
});
