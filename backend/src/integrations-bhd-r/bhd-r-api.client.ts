import { Injectable, Logger } from '@nestjs/common';

const DEFAULT_BASE = 'https://api.r.bhd-om.com';

@Injectable()
export class BhdRApiClient {
  private readonly logger = new Logger(BhdRApiClient.name);

  baseUrl(): string {
    return (process.env.BHD_R_API_URL || DEFAULT_BASE).replace(/\/+$/, '');
  }

  async getJson<T>(path: string, apiKey: string): Promise<T> {
    const url = `${this.baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-api-key': apiKey,
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`BHD-R ${response.status} ${path}: ${body.slice(0, 180)}`);
      throw new Error(`BHD-R ${response.status} ${path}`);
    }
    return (await response.json()) as T;
  }
}

export type BhdRPropertyRow = Record<string, unknown> & {
  id: string;
  addressId?: string;
  nameAr?: string;
  nameEn?: string;
  serialNumber?: string | null;
  address?: Record<string, unknown> | null;
  units?: Array<Record<string, unknown> & { id: string; propertyId?: string }>;
};

export type BhdRPartyRow = Record<string, unknown> & {
  id: string;
  displayName?: string;
  email?: string | null;
  phone?: string | null;
  roles?: string[];
  addresses?: Array<{ primary?: boolean; address?: Record<string, unknown> | null }>;
};

export type BhdRLeaseRow = Record<string, unknown> & {
  id: string;
  unitId?: string;
  tenantPartyId?: string;
  ownerPartyId?: string;
};

export type BhdRInvoiceRow = Record<string, unknown> & {
  id: string;
  leaseId?: string;
  tenantPartyId?: string;
  totalMinor?: string;
  status?: string;
};

export type BhdRPaymentRow = Record<string, unknown> & {
  id: string;
  invoiceId?: string;
  amountMinor?: string;
  status?: string;
};

export type BhdRExpenseRow = Record<string, unknown> & {
  id: string;
  propertyId?: string | null;
  unitId?: string | null;
  vendorId?: string | null;
  amountMinor?: string;
  status?: string;
};

export type BhdRVendorRow = Record<string, unknown> & {
  id: string;
  name?: string;
  partyId?: string | null;
  email?: string | null;
  phone?: string | null;
};
