import { Response, CookieOptions } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { identitySessionMaxAgeMs, identitySessionMaxAgeSecCached } from './bhd-runtime';

export const ACCESS_COOKIE = 'bhd_access';
export const REFRESH_COOKIE = 'bhd_refresh';
export const CSRF_COOKIE = 'bhd_csrf';
/** Product-local mirror of identity accounts signed into this browser. Host-only. */
export const ROSTER_COOKIE = 'bhd_roster';
export const MAX_ROSTER_ACCOUNTS = 8;

/** Live default from id.bhd-om.com/api/bhd/runtime (40d fallback). */
export const SESSION_MAX_AGE_SEC = identitySessionMaxAgeSecCached();
export const SESSION_MAX_AGE_MS = identitySessionMaxAgeMs();
export const SESSION_JWT_EXPIRES_IN = '400d';

export const AUTH_PROVIDERS = ['password', 'google', 'facebook', 'whatsapp'] as const;
export type AuthProviderMark = (typeof AUTH_PROVIDERS)[number];

export type ProductRosterAccount = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  username: string | null;
  phone: string | null;
  providers: AuthProviderMark[];
};

function baseCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSiteEnv = (process.env.COOKIE_SAME_SITE || '').toLowerCase();
  const sameSite =
    sameSiteEnv === 'none' || sameSiteEnv === 'lax' || sameSiteEnv === 'strict'
      ? (sameSiteEnv as CookieOptions['sameSite'])
      : 'lax';
  return {
    httpOnly: true,
    // Secure required for SameSite=None; also on in production
    secure: isProd || sameSite === 'none',
    sameSite,
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  const base = baseCookieOptions();
  const maxAge = identitySessionMaxAgeMs();
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge,
  });
  res.cookie(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
    ...base,
    httpOnly: false,
    maxAge,
  });
}

export function clearAuthCookies(res: Response) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}

function rosterKey(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') return '';
  return 'qootk-dev-secret-change-in-production-min-32-chars!!';
}

function asProviders(value: unknown): AuthProviderMark[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AuthProviderMark =>
      typeof item === 'string' &&
      (AUTH_PROVIDERS as readonly string[]).includes(item),
  );
}

export function inferProviders(input: {
  picture?: string | null;
  providers?: AuthProviderMark[] | null;
  googleLinked?: boolean;
  facebookLinked?: boolean;
  hasPassword?: boolean;
}): AuthProviderMark[] {
  const found = new Set<AuthProviderMark>(input.providers || []);
  if (input.googleLinked) found.add('google');
  if (input.facebookLinked) found.add('facebook');
  if (input.hasPassword) found.add('password');
  const picture = input.picture || '';
  if (picture.includes('googleusercontent.com')) found.add('google');
  if (picture.includes('fbcdn.net') || picture.includes('facebook.com')) found.add('facebook');
  return AUTH_PROVIDERS.filter((item) => found.has(item));
}

function isRosterAccount(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const sub = typeof row.sub === 'string' ? row.sub : '';
  const email = typeof row.email === 'string' ? row.email : '';
  const username = typeof row.username === 'string' ? row.username : '';
  const phone = typeof row.phone === 'string' ? row.phone : '';
  return sub.length > 0 && sub.length <= 128 && (email.includes('@') || !!username || !!phone);
}

export function normalizeRosterAccount(input: {
  sub: string;
  email?: string;
  name?: string;
  picture?: string | null;
  username?: string | null;
  phone?: string | null;
  providers?: AuthProviderMark[] | null;
  googleLinked?: boolean;
  facebookLinked?: boolean;
  hasPassword?: boolean;
}): ProductRosterAccount | null {
  const sub = input.sub.trim().slice(0, 128);
  const email = (input.email || '').trim().toLowerCase().slice(0, 200);
  const username = (input.username || '').trim().slice(0, 80) || null;
  const phone = (input.phone || '').trim().slice(0, 32) || null;
  if (!sub || (!email.includes('@') && !username && !phone)) return null;
  const picture = (input.picture || '').trim().slice(0, 400) || null;
  const handle = email || username || phone || 'حساب';
  return {
    sub,
    email: email.includes('@') ? email : '',
    name: (input.name || handle).trim().slice(0, 120) || handle,
    picture,
    username,
    phone,
    providers: inferProviders({
      picture,
      providers: input.providers,
      googleLinked: input.googleLinked,
      facebookLinked: input.facebookLinked,
      hasPassword: input.hasPassword,
    }),
  };
}

export function upsertRoster(
  roster: ProductRosterAccount[],
  next: ProductRosterAccount,
): ProductRosterAccount[] {
  const prev = roster.find((item) => item.sub === next.sub);
  const merged = normalizeRosterAccount({
    ...next,
    email: next.email || prev?.email,
    name: next.name || prev?.name,
    picture: next.picture || prev?.picture,
    username: next.username || prev?.username,
    phone: next.phone || prev?.phone,
    providers: inferProviders({
      picture: next.picture || prev?.picture,
      providers: [...(prev?.providers || []), ...(next.providers || [])],
    }),
  });
  if (!merged) return roster.slice(0, MAX_ROSTER_ACCOUNTS);
  const rest = roster.filter((item) => item.sub !== next.sub);
  return [merged, ...rest].slice(0, MAX_ROSTER_ACCOUNTS);
}

export function signRoster(accounts: ProductRosterAccount[]): string {
  const key = rosterKey();
  if (!key) return '';
  const payload = Buffer.from(JSON.stringify(accounts), 'utf8').toString('base64url');
  const sig = createHmac('sha256', key).update(payload).digest('base64url');
  return `v1.${payload}.${sig}`;
}

export function readRosterCookie(raw: string | undefined): ProductRosterAccount[] {
  if (!raw) return [];
  const key = rosterKey();
  if (!key) return [];
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return [];
  const payload = parts[1];
  const sig = parts[2];
  const expected = createHmac('sha256', key).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(parsed)) return [];
    const accounts: ProductRosterAccount[] = [];
    for (const item of parsed) {
      if (!isRosterAccount(item)) continue;
      const row = normalizeRosterAccount({
        sub: String(item.sub),
        email: typeof item.email === 'string' ? item.email : '',
        name: typeof item.name === 'string' ? item.name : '',
        picture: typeof item.picture === 'string' ? item.picture : null,
        username: typeof item.username === 'string' ? item.username : null,
        phone: typeof item.phone === 'string' ? item.phone : null,
        providers: asProviders(item.providers),
      });
      if (row) accounts.push(row);
    }
    return accounts.slice(0, MAX_ROSTER_ACCOUNTS);
  } catch {
    return [];
  }
}

export function setRosterCookie(res: Response, accounts: ProductRosterAccount[]) {
  const value = signRoster(accounts.slice(0, MAX_ROSTER_ACCOUNTS));
  if (!value) return;
  res.cookie(ROSTER_COOKIE, value, {
    ...baseCookieOptions(),
    maxAge: identitySessionMaxAgeMs(),
  });
}

export function clearRosterCookie(res: Response) {
  res.clearCookie(ROSTER_COOKIE, baseCookieOptions());
}
