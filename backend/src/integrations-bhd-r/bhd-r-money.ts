const MINOR_UNITS: Record<string, number> = {
  OMR: 3,
  BHD: 3,
  KWD: 3,
  AED: 2,
  SAR: 2,
  QAR: 2,
  USD: 2,
  EUR: 2,
};

export function minorUnitsForCurrency(currency: string): number {
  return MINOR_UNITS[currency.trim().toUpperCase()] ?? 3;
}

/** Convert BHD-R amountMinor (integer string) to major units used by Hisaby invoices. */
export function majorFromAmountMinor(amountMinor: string, currency: string): number {
  const raw = String(amountMinor || '').trim();
  if (!/^-?\d+$/.test(raw)) {
    throw new Error('amountMinor must be an integer string');
  }
  const scale = minorUnitsForCurrency(currency);
  const negative = raw.startsWith('-');
  const digits = negative ? raw.slice(1) : raw;
  const padded = digits.padStart(scale + 1, '0');
  const whole = padded.slice(0, -scale) || '0';
  const frac = scale > 0 ? padded.slice(-scale) : '';
  const value = Number(scale > 0 ? `${whole}.${frac}` : whole);
  if (!Number.isFinite(value)) {
    throw new Error('amountMinor is not a finite amount');
  }
  return negative ? -value : value;
}
