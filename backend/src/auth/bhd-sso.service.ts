import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { ensureBhdSubColumn } from '../prisma/ensure-bhd-sub';

export const BHD_OAUTH_STATE_COOKIE = 'bhd_oauth_state';

type OAuthState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  redirectUri: string;
};

/** Claims aligned with ONE-BHD `IdentityClaims` / userinfo (BHD-IDENTITY-SSO §4). */
type IdClaims = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  preferred_username?: string;
  phone_number?: string;
  nonce?: string;
};

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomToken(bytes = 32): string {
  return base64Url(randomBytes(bytes));
}

function sha256Base64Url(value: string): string {
  return base64Url(createHash('sha256').update(value).digest());
}

function safeReturnTo(raw: string | null | undefined): string {
  const v = (raw || '/dashboard').trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('://') || v.includes('\\')) {
    return '/dashboard';
  }
  // Portal launcher always sends returnTo=/ — Hisaby home is the dashboard.
  if (v === '/') return '/dashboard';
  return v;
}

@Injectable()
export class BhdSsoService {
  private readonly logger = new Logger(BhdSsoService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  isConfigured(): boolean {
    return !!(
      this.issuer() &&
      this.clientId() &&
      (process.env.BHD_OAUTH_REDIRECT_URI || process.env.FRONTEND_URL)
    );
  }

  /** Public readiness flags only — never expose secret values. */
  async status() {
    const ok = await ensureBhdSubColumn(this.prisma);
    let bhdSubColumn = ok;
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'bhd_sub' LIMIT 1`,
      );
      bhdSubColumn = Array.isArray(rows) && rows.length > 0;
    } catch {
      bhdSubColumn = false;
    }
    return {
      configured: this.isConfigured(),
      issuer: this.issuer(),
      clientId: this.clientId(),
      identityTokenSecretConfigured: !!this.identityTokenSecret(),
      clientSecretConfigured: !!this.clientSecret(),
      bhdSubColumn,
      verifyModes: [
        'HS256+BHD_IDENTITY_TOKEN_SECRET',
        'JWKS',
        'userinfo_after_code_exchange',
      ] as const,
    };
  }

  issuer(): string {
    return (
      process.env.BHD_IDENTITY_ISSUER ||
      this.config.get<string>('bhd.issuer') ||
      'https://id.bhd-om.com'
    ).replace(/\/$/, '');
  }

  clientId(): string {
    return (
      process.env.BHD_OAUTH_CLIENT_ID ||
      this.config.get<string>('bhd.clientId') ||
      'bhd-hisaby'
    ).trim();
  }

  clientSecret(): string {
    return (process.env.BHD_OAUTH_CLIENT_SECRET || '').trim();
  }

  /** Prefer explicit redirect; else derive from request public origin. */
  redirectUriFor(requestOrigin: string): string {
    const fixed = (process.env.BHD_OAUTH_REDIRECT_URI || '').trim();
    if (fixed) return fixed;
    return `${requestOrigin.replace(/\/$/, '')}/api/auth/bhd/callback`;
  }

  frontendOrigin(): string {
    return (
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  buildStart(returnToRaw: string | undefined, requestOrigin: string): {
    authorizeUrl: string;
    stateCookieValue: string;
  } {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'BHD Identity SSO is not configured (BHD_IDENTITY_ISSUER / BHD_OAUTH_CLIENT_ID)',
      );
    }
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const challenge = sha256Base64Url(verifier);
    const returnTo = safeReturnTo(returnToRaw);
    const redirectUri = this.redirectUriFor(requestOrigin);
    const payload: OAuthState = {
      state,
      nonce,
      verifier,
      returnTo,
      redirectUri,
    };
    const authorize = new URL(`${this.issuer()}/oauth/authorize`);
    authorize.searchParams.set('client_id', this.clientId());
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', 'openid profile email');
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('nonce', nonce);
    authorize.searchParams.set('code_challenge', challenge);
    authorize.searchParams.set('code_challenge_method', 'S256');
    return {
      authorizeUrl: authorize.toString(),
      // Plain JSON — Express cookie serializer encodes once (avoid double encodeURIComponent)
      stateCookieValue: JSON.stringify(payload),
    };
  }

  parseStateCookie(raw: string | undefined): OAuthState | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OAuthState;
    } catch {
      try {
        return JSON.parse(decodeURIComponent(raw)) as OAuthState;
      } catch {
        return null;
      }
    }
  }

  async exchangeAndLogin(
    code: string,
    stateParam: string,
    saved: OAuthState,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ tokens: { accessToken: string; refreshToken: string }; returnTo: string }> {
    if (!code || !stateParam || saved.state !== stateParam) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'BHD_STATE_MISMATCH',
        message: 'Invalid OAuth state',
      });
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: saved.redirectUri,
      client_id: this.clientId(),
      code_verifier: saved.verifier,
    });
    const secret = this.clientSecret();
    if (secret) body.set('client_secret', secret);

    const tokenRes = await fetch(`${this.issuer()}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      this.logger.warn(
        `BHD token exchange failed: ${tokenRes.status} ${text.slice(0, 200)} redirect_uri=${saved.redirectUri}`,
      );
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_TOKEN_EXCHANGE',
        message: 'BHD token exchange failed',
      });
    }
    const tokenJson = (await tokenRes.json()) as {
      id_token?: string;
      access_token?: string;
    };
    if (!tokenJson.id_token && !tokenJson.access_token) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_MISSING_ID_TOKEN',
        message: 'Missing id_token and access_token',
      });
    }

    const claims = await this.resolveClaims(
      tokenJson.id_token,
      tokenJson.access_token,
      saved.nonce,
    );
    let session: { accessToken: string; refreshToken: string };
    try {
      session = await this.authService.loginWithBhdIdentity(claims, meta);
    } catch (err: unknown) {
      const prismaCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      const msg = err instanceof Error ? err.message : String(err);
      if (
        prismaCode === 'P2022' ||
        /bhd_sub/i.test(msg) ||
        /column.*does not exist/i.test(msg)
      ) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'BHD_SCHEMA',
          message: 'Database missing bhd_sub — run prisma migrate deploy',
        });
      }
      throw err;
    }
    return {
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
      returnTo: saved.returnTo || '/dashboard',
    };
  }

  endSessionUrl(postLogoutRedirect?: string): string {
    const url = new URL(`${this.issuer()}/oauth/end-session`);
    url.searchParams.set('client_id', this.clientId());
    url.searchParams.set(
      'post_logout_redirect_uri',
      postLogoutRedirect || `${this.frontendOrigin()}/`,
    );
    return url.toString();
  }

  /**
   * Shared HS256 secret while Identity JWKS is empty.
   * Identity signs with IDENTITY_TOKEN_SECRET || AUTH_SECRET (ONE-BHD issuer.ts).
   */
  private identityTokenSecret(): string {
    return (
      process.env.BHD_IDENTITY_TOKEN_SECRET ||
      process.env.IDENTITY_TOKEN_SECRET ||
      ''
    ).trim();
  }

  /**
   * 1) Cryptographic id_token verify (HS256 secret or JWKS).
   * 2) Else userinfo with access_token after successful code+PKCE exchange
   *    (TLS to issuer; no shared signing secret required on Render).
   */
  private async resolveClaims(
    idToken: string | undefined,
    accessToken: string | undefined,
    expectedNonce: string,
  ): Promise<IdClaims> {
    if (idToken) {
      try {
        return await this.verifyIdToken(idToken, expectedNonce);
      } catch (err: unknown) {
        this.logger.warn(
          `BHD id_token verify failed, trying userinfo: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (!accessToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_ID_TOKEN_VERIFY',
        message: 'Invalid id_token and no access_token for userinfo',
      });
    }

    if (idToken) {
      this.assertNonceOnUnverifiedIdToken(idToken, expectedNonce);
    }

    return this.claimsFromUserInfo(accessToken);
  }

  private assertNonceOnUnverifiedIdToken(idToken: string, expectedNonce: string) {
    try {
      const payload = decodeJwt(idToken);
      if (payload.nonce !== expectedNonce) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'BHD_NONCE',
          message: 'Invalid nonce',
        });
      }
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_ID_TOKEN_VERIFY',
        message: 'Could not read id_token nonce',
      });
    }
  }

  private async claimsFromUserInfo(accessToken: string): Promise<IdClaims> {
    const res = await fetch(`${this.issuer()}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(
        `BHD userinfo failed: ${res.status} ${text.slice(0, 200)}`,
      );
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_ID_TOKEN_VERIFY',
        message: 'Identity userinfo failed',
      });
    }
    const body = (await res.json()) as Record<string, unknown>;
    return this.normalizeClaims(body);
  }

  private async verifyIdToken(idToken: string, expectedNonce: string): Promise<IdClaims> {
    const issuer = this.issuer();
    const audience = this.clientId();

    let payload: Record<string, unknown>;
    try {
      payload = await this.verifyIdTokenPayload(idToken, issuer, audience);
    } catch (err: unknown) {
      this.logger.warn(
        `BHD id_token crypto verify failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_ID_TOKEN_VERIFY',
        message: 'Invalid id_token',
      });
    }

    if (payload.nonce !== expectedNonce) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_NONCE',
        message: 'Invalid nonce',
      });
    }
    return this.normalizeClaims(payload);
  }

  private normalizeClaims(payload: Record<string, unknown>): IdClaims {
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_CLAIMS',
        message: 'Invalid identity claims (need sub + email)',
      });
    }
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'BHD_EMAIL_UNVERIFIED',
        message: 'Email not verified on BHD Identity',
      });
    }
    return {
      sub: payload.sub,
      email: String(payload.email).trim().toLowerCase(),
      email_verified: true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      preferred_username:
        typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined,
      phone_number:
        typeof payload.phone_number === 'string' ? payload.phone_number : undefined,
    };
  }

  /**
   * Prefer HS256 with BHD_IDENTITY_TOKEN_SECRET while Identity JWKS is empty;
   * fall back to JWKS for future RS256.
   */
  private async verifyIdTokenPayload(
    idToken: string,
    issuer: string,
    audience: string,
  ): Promise<Record<string, unknown>> {
    const hsSecret = this.identityTokenSecret();

    if (hsSecret) {
      try {
        const { payload } = await jwtVerify(
          idToken,
          new TextEncoder().encode(hsSecret),
          {
            issuer,
            audience,
            algorithms: ['HS256'],
          },
        );
        return payload as Record<string, unknown>;
      } catch (hsErr: unknown) {
        this.logger.warn(
          `BHD HS256 id_token verify failed, trying JWKS: ${
            hsErr instanceof Error ? hsErr.message : String(hsErr)
          }`,
        );
      }
    } else {
      this.logger.warn(
        'BHD_IDENTITY_TOKEN_SECRET unset — will use JWKS then userinfo fallback',
      );
    }

    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(`${issuer}/oauth/jwks.json`));
    }
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer,
      audience,
    });
    return payload as Record<string, unknown>;
  }
}
