import { csrfProtection } from '../src/auth/csrf.middleware';

function run(request: Record<string, unknown>) {
  return new Promise<unknown>((resolve) => {
    csrfProtection(request as never, {} as never, (error?: unknown) =>
      resolve(error || null),
    );
  });
}

describe('csrfProtection', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CORS_ORIGIN = 'https://hisaby.pro';
    process.env.FRONTEND_URL = 'https://hisaby.pro';
    process.env.API_PUBLIC_URL = 'https://hisaby-api.onrender.com';
    delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects cookie-authenticated mutations without a double-submit token', async () => {
    const error = await run({
      method: 'POST',
      originalUrl: '/api/invoices',
      headers: { origin: 'https://hisaby.pro' },
      cookies: { bhd_access: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeTruthy();
  });

  it('accepts a matching token from an allowed origin', async () => {
    const error = await run({
      method: 'POST',
      originalUrl: '/api/invoices',
      headers: {
        origin: 'https://hisaby.pro',
        'x-csrf-token': 'expected',
      },
      cookies: { bhd_access: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeNull();
  });

  it('accepts a matching token even when Origin was replaced by the API host', async () => {
    const error = await run({
      method: 'PATCH',
      originalUrl: '/api/admin/tenants/abc',
      headers: {
        origin: 'https://hisaby-api.onrender.com',
        'x-csrf-token': 'expected',
      },
      cookies: { bhd_access: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeNull();
  });

  it('accepts a matching token from a Vercel proxy Origin', async () => {
    const error = await run({
      method: 'POST',
      originalUrl: '/api/auth/refresh',
      headers: {
        origin: 'https://hisaby-git-main-team.vercel.app',
        'x-csrf-token': 'expected',
      },
      cookies: { bhd_refresh: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeNull();
  });

  it('accepts cookie mutations that omit Origin when the CSRF token matches', async () => {
    const error = await run({
      method: 'PATCH',
      originalUrl: '/api/admin/tenants/abc',
      headers: {
        'x-csrf-token': 'expected',
      },
      cookies: { bhd_access: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeNull();
  });

  it('does not treat Origin as the CSRF control once the token matches', async () => {
    const error = await run({
      method: 'PATCH',
      originalUrl: '/api/admin/tenants/abc',
      headers: {
        origin: 'https://evil.example',
        'x-csrf-token': 'expected',
      },
      cookies: { bhd_access: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeNull();
  });

  it('allows BHD-R inbound events without CSRF cookies', async () => {
    const error = await run({
      method: 'POST',
      originalUrl: '/api/integrations/bhd-r/events',
      headers: { authorization: 'Bearer qk_bhdr_test' },
      cookies: {},
    });
    expect(error).toBeNull();
  });
});
