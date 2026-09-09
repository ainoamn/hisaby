import { ForbiddenException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from './auth-cookies';
import { isTrustedCsrfOrigin } from './browser-origins';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_MUTATION_PREFIXES = [
  '/api/public/',
  '/api/payments/webhook',
  '/api/payments/webhooks',
  '/api/integrations/bhd-r/events',
];
const AUTH_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return next();
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (
    AUTH_EXEMPT_PATHS.has(path) ||
    PUBLIC_MUTATION_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return next();
  }
  if (req.headers.authorization || req.headers['x-api-key']) return next();

  const hasAuthCookie = !!(
    req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]
  );
  if (!hasAuthCookie) return next();

  if (!isTrustedCsrfOrigin(req.headers)) {
    return next(new ForbiddenException('CSRF origin validation failed'));
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const header = req.headers['x-csrf-token'];
  const headerToken = Array.isArray(header) ? header[0] : header;
  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    !constantTimeEqual(cookieToken, headerToken)
  ) {
    return next(new ForbiddenException('CSRF token validation failed'));
  }
  return next();
}

