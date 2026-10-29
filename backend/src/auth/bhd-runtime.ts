const IDENTITY_RUNTIME_URL = 'https://id.bhd-om.com/api/bhd/runtime';
export const SESSION_MAX_AGE_FALLBACK_SEC = 40 * 24 * 60 * 60;

let cache: { at: number; maxAgeSec: number } | null = null;
const CACHE_MS = 5 * 60_000;

function acceptMaxAge(value: unknown) {
  return typeof value === 'number' && value > 0
    ? Math.floor(value)
    : SESSION_MAX_AGE_FALLBACK_SEC;
}

export function identitySessionMaxAgeSecCached(): number {
  if (cache) {
    if (Date.now() - cache.at > CACHE_MS) {
      void refreshIdentitySessionMaxAge().catch(() => undefined);
    }
    return cache.maxAgeSec;
  }
  void refreshIdentitySessionMaxAge().catch(() => undefined);
  return SESSION_MAX_AGE_FALLBACK_SEC;
}

export async function refreshIdentitySessionMaxAge(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.maxAgeSec;
  try {
    const response = await fetch(IDENTITY_RUNTIME_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime ${response.status}`);
    const body = (await response.json()) as { session?: { maxAgeSec?: number } };
    const maxAgeSec = acceptMaxAge(body.session?.maxAgeSec);
    cache = { at: now, maxAgeSec };
    return maxAgeSec;
  } catch {
    if (cache) return cache.maxAgeSec;
    return SESSION_MAX_AGE_FALLBACK_SEC;
  }
}

export function identitySessionMaxAgeMs(): number {
  return identitySessionMaxAgeSecCached() * 1000;
}
