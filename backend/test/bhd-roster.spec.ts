import {
  normalizeRosterAccount,
  readRosterCookie,
  signRoster,
  upsertRoster,
} from '../src/auth/auth-cookies';

describe('product account roster', () => {
  const first = normalizeRosterAccount({
    sub: 'user_one',
    email: 'one@bhd-om.com',
    name: 'الأول',
    picture: null,
  })!;
  const second = normalizeRosterAccount({
    sub: 'user_two',
    email: 'two@bhd-om.com',
    name: 'الثاني',
    picture: null,
  })!;

  it('keeps the newest account first and drops duplicates', () => {
    const roster = upsertRoster(upsertRoster([], first), second);
    expect(roster.map((item) => item.sub)).toEqual(['user_two', 'user_one']);
    const again = upsertRoster(roster, first);
    expect(again.map((item) => item.sub)).toEqual(['user_one', 'user_two']);
  });

  it('keeps username, phone, and provider marks when the account is updated', () => {
    const withPhone = normalizeRosterAccount({
      ...second,
      phone: '+96890000000',
      providers: ['whatsapp'],
    })!;
    const again = upsertRoster([withPhone], {
      ...second,
      picture: 'https://lh3.googleusercontent.com/a/photo',
    });
    expect(again[0].phone).toBe('+96890000000');
    expect(again[0].providers).toEqual(['google', 'whatsapp']);
  });

  it('round-trips a signed cookie and rejects a tampered payload', () => {
    const token = signRoster([first, second]);
    expect(readRosterCookie(token).map((item) => item.email)).toEqual([
      'one@bhd-om.com',
      'two@bhd-om.com',
    ]);
    const [version, payload, sig] = token.split('.');
    expect(readRosterCookie(`${version}.${payload}x.${sig}`)).toEqual([]);
  });
});
