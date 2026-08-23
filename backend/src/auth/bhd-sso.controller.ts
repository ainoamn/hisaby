import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  Logger,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import {
  BHD_OAUTH_STATE_COOKIE,
  BhdSsoService,
} from './bhd-sso.service';
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import { AuthService } from './auth.service';

@ApiTags('Auth / BHD Identity')
@Controller('auth')
export class BhdSsoController {
  private readonly logger = new Logger(BhdSsoController.name);

  constructor(
    private readonly bhdSso: BhdSsoService,
    private readonly authService: AuthService,
  ) {}

  private requestOrigin(req: Request): string {
    const xfProto = (req.headers['x-forwarded-proto'] as string) || '';
    const xfHost = (req.headers['x-forwarded-host'] as string) || '';
    if (xfHost) {
      const proto = (xfProto.split(',')[0] || 'https').trim();
      return `${proto}://${xfHost.split(',')[0].trim()}`;
    }
    const frontend = this.bhdSso.frontendOrigin();
    if (frontend) return frontend;
    return `${req.protocol}://${req.get('host')}`;
  }

  @Get('bhd/start')
  @SkipThrottle()
  @ApiOperation({ summary: 'Begin BHD Identity SSO (302 → id.bhd-om.com)' })
  start(
    @Query('returnTo') returnTo: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = this.requestOrigin(req);
    const { authorizeUrl, stateCookieValue } = this.bhdSso.buildStart(
      returnTo,
      origin,
    );
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(BHD_OAUTH_STATE_COOKIE, stateCookieValue, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60 * 1000,
    });
    return res.redirect(302, authorizeUrl);
  }

  @Get('bhd/callback')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'BHD Identity OAuth callback' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = this.requestOrigin(req);
    const fail = (path = '/login?bhd=error') => {
      res.clearCookie(BHD_OAUTH_STATE_COOKIE, { path: '/' });
      return res.redirect(302, `${origin}${path}`);
    };

    if (error) {
      this.logger.warn(`BHD callback error: ${error}`);
      return fail(`/login?bhd=denied`);
    }

    const raw = req.cookies?.[BHD_OAUTH_STATE_COOKIE] as string | undefined;
    const saved = this.bhdSso.parseStateCookie(raw);
    res.clearCookie(BHD_OAUTH_STATE_COOKIE, { path: '/' });
    // Clear any previous product session before establishing the new one (§0.7)
    clearAuthCookies(res);

    if (!saved) {
      this.logger.warn('BHD callback: missing or invalid oauth state cookie');
      return fail('/login?bhd=state');
    }
    if (!code || !state) {
      this.logger.warn('BHD callback: missing code or state query');
      return fail('/login?bhd=params');
    }

    try {
      const { tokens, returnTo } = await this.bhdSso.exchangeAndLogin(
        code,
        state,
        saved,
        {
          ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
          userAgent: this.normalizeUserAgent(req.headers['user-agent']),
        },
      );
      setAuthCookies(res, tokens);
      let dest = returnTo.startsWith('/') ? returnTo : '/dashboard';
      if (dest === '/') dest = '/dashboard';
      return res.redirect(302, `${origin}${dest}`);
    } catch (err: unknown) {
      const errCode = this.bhdErrorCode(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `BHD callback failed code=${errCode || 'none'}: ${errMsg.slice(0, 400)}`,
      );
      if (errCode === 'BHD_NO_LOCAL_USER') {
        return fail('/login?bhd=no_user');
      }
      if (errCode === 'BHD_EMAIL_UNVERIFIED') {
        return fail('/login?bhd=email');
      }
      if (errCode === 'BHD_EMAIL_LINKED_OTHER') {
        return fail('/login?bhd=linked');
      }
      if (errCode === 'BHD_INACTIVE') {
        return fail('/login?bhd=inactive');
      }
      if (errCode === 'BHD_LOCKED') {
        return fail('/login?bhd=locked');
      }
      if (errCode === 'BHD_SCHEMA') {
        return fail('/login?bhd=schema');
      }
      if (errCode === 'BHD_PROVISION') {
        return fail(`/login?bhd=provision&why=${this.whySlug(errMsg)}`);
      }
      if (errCode === 'BHD_TOKEN_EXCHANGE' || errCode === 'BHD_MISSING_ID_TOKEN') {
        return fail('/login?bhd=token');
      }
      if (
        errCode === 'BHD_ID_TOKEN_VERIFY' ||
        errCode === 'BHD_NONCE' ||
        errCode === 'BHD_CLAIMS'
      ) {
        return fail('/login?bhd=verify');
      }
      if (errCode === 'BHD_STATE_MISMATCH') {
        return fail('/login?bhd=state');
      }
      return fail(
        `/login?bhd=exchange&why=${this.whySlug(errCode || errMsg || 'unknown')}`,
      );
    }
  }

  private normalizeUserAgent(raw: string | string[] | undefined): string | undefined {
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (!s || typeof s !== 'string') return undefined;
    return s.slice(0, 512);
  }

  private whySlug(raw: string): string {
    const cleaned = String(raw || 'unknown')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 48);
    return encodeURIComponent(cleaned || 'unknown');
  }

  private bhdErrorCode(err: unknown): string {
    const fromBody = (body: unknown): string => {
      if (!body) return '';
      if (typeof body === 'string') {
        if (/No Hisaby user/i.test(body)) return 'BHD_NO_LOCAL_USER';
        if (/already linked to another BHD/i.test(body)) return 'BHD_EMAIL_LINKED_OTHER';
        if (/inactive/i.test(body)) return 'BHD_INACTIVE';
        if (/Account locked/i.test(body)) return 'BHD_LOCKED';
        if (/bhd_sub/i.test(body)) return 'BHD_SCHEMA';
        if (/provision|Unique constraint|P2002/i.test(body)) return 'BHD_PROVISION';
        return '';
      }
      if (typeof body === 'object') {
        const o = body as Record<string, unknown>;
        if (typeof o.code === 'string' && o.code.startsWith('BHD_')) {
          return o.code;
        }
        if (o.message != null) return fromBody(o.message);
      }
      return '';
    };

    if (err && typeof err === 'object' && 'code' in err) {
      const c = String((err as { code: unknown }).code);
      if (c.startsWith('BHD_')) return c;
      if (c === 'P2022') return 'BHD_SCHEMA';
      if (c === 'P2002') return 'BHD_PROVISION';
    }

    if (err && typeof err === 'object' && 'getResponse' in err) {
      try {
        const body = (err as ForbiddenException).getResponse();
        const coded = fromBody(body);
        if (coded) return coded;
      } catch {
        /* ignore */
      }
    }
    if (err instanceof Error) {
      return fromBody(err.message);
    }
    return '';
  }

  @Get('bhd/logout')
  @SkipThrottle()
  @ApiOperation({ summary: 'Clear Hisaby session then BHD end-session' })
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = (req as Request & { user?: { sub?: string } }).user;
    if (user?.sub) {
      try {
        await this.authService.logout(user.sub);
      } catch {
        /* ignore */
      }
    }
    clearAuthCookies(res);
    res.clearCookie(BHD_OAUTH_STATE_COOKIE, { path: '/' });
    const origin = this.requestOrigin(req);
    return res.redirect(302, this.bhdSso.endSessionUrl(`${origin}/`));
  }

  @Get('bhd/status')
  @SkipThrottle()
  @ApiOperation({
    summary: 'BHD SSO readiness (no secrets) — identityTokenSecretConfigured etc.',
  })
  async status() {
    return this.bhdSso.status();
  }

  @Get('admin-entry')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Platform /admin entry via BHD SSO (never local password)',
  })
  adminEntry(
    @Query('next') next: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = this.requestOrigin(req);
    let returnTo = '/admin';
    const raw = (next || '').trim();
    if (
      raw.startsWith('/') &&
      !raw.startsWith('//') &&
      !raw.includes('://') &&
      !raw.includes('\\')
    ) {
      returnTo = raw;
    }
    return res.redirect(
      302,
      `${origin}/api/auth/bhd/start?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }
}
