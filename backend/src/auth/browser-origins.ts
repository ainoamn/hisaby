const PRODUCTION_FRONTEND_ORIGINS = [
  'https://hisaby.bhd-om.com',
  'https://www.hisaby.bhd-om.com',
];

const DEFAULT_API_ORIGIN = 'https://hisaby-api.onrender.com';

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function originFromEnvValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return null;
  return originOf(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
}

export function allowedBrowserOrigins(): string[] {
  const found = new Set<string>();
  const raw = [
    process.env.CORS_ORIGIN || '',
    process.env.FRONTEND_URL || '',
  ]
    .join(',')
    .split(',');

  for (const part of raw) {
    const origin = originFromEnvValue(part);
    if (origin) found.add(origin);
  }

  if (!process.env.CORS_ORIGIN && process.env.NODE_ENV !== 'production') {
    found.add('http://localhost:3000');
  }

  for (const origin of PRODUCTION_FRONTEND_ORIGINS) found.add(origin);
  return [...found];
}

export function vercelPreviewsAllowed(): boolean {
  return (
    process.env.CORS_ALLOW_VERCEL_PREVIEWS === '1' ||
    process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true'
  );
}

export function isVercelPreviewOrigin(origin: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

export function isAllowedCorsOrigin(origin: string): boolean {
  return (
    allowedBrowserOrigins().includes(origin) ||
    (vercelPreviewsAllowed() && isVercelPreviewOrigin(origin))
  );
}

function apiPublicOrigin(): string {
  return (
    originFromEnvValue(process.env.API_PUBLIC_URL || '') ||
    originFromEnvValue(process.env.BACKEND_URL || '') ||
    DEFAULT_API_ORIGIN
  );
}

function hostnameOf(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isRewrittenProxyOrigin(origin: string): boolean {
  if (origin === apiPublicOrigin() || origin === DEFAULT_API_ORIGIN) return true;
  const host = hostnameOf(origin);
  if (!host) return false;
  return (
    host.endsWith('.onrender.com') ||
    host.endsWith('.vercel.app') ||
    isVercelPreviewOrigin(origin)
  );
}

/**
 * Browser POSTs to /backend-api are same-origin, but Vercel rewrites and
 * Node fetch() replace Origin with the API or *.vercel.app host and often
 * drop Referer. Reject only a present third-party Origin. Missing/proxy
 * Origin falls through to the double-submit CSRF token.
 */
export function isTrustedCsrfOrigin(headers: {
  origin?: string | string[];
  referer?: string | string[];
  'sec-fetch-site'?: string | string[];
  'x-forwarded-origin'?: string | string[];
}): boolean {
  const origin = firstHeader(headers.origin);
  if (origin && isAllowedCorsOrigin(origin)) return true;
  if (origin && !isRewrittenProxyOrigin(origin)) return false;

  const forwarded = firstHeader(headers['x-forwarded-origin']);
  if (forwarded && isAllowedCorsOrigin(forwarded)) return true;

  const refererOrigin = originOf(firstHeader(headers.referer) || '');
  if (refererOrigin && isAllowedCorsOrigin(refererOrigin)) return true;

  return !origin || isRewrittenProxyOrigin(origin);
}
