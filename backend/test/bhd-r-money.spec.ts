import { majorFromAmountMinor, minorUnitsForCurrency } from '../src/integrations-bhd-r/bhd-r-money';

describe('BHD-R amountMinor conversion', () => {
  it('uses 3 minor units for OMR', () => {
    expect(minorUnitsForCurrency('OMR')).toBe(3);
    expect(majorFromAmountMinor('150000', 'OMR')).toBe(150);
    expect(majorFromAmountMinor('1', 'omr')).toBe(0.001);
  });

  it('uses 2 minor units for AED', () => {
    expect(majorFromAmountMinor('250', 'AED')).toBe(2.5);
  });

  it('rejects non-integer strings', () => {
    expect(() => majorFromAmountMinor('12.5', 'OMR')).toThrow(/integer/);
  });
});
