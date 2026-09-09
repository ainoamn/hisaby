import { NextFunction, Request, Response } from 'express';
import { normalizeBhdRInboundBody } from '../integrations-bhd-r/bhd-r-details';

export type BhdREventRequest = Request & {
  bhdRSkipEvent?: boolean;
  bhdRSkipReason?: string;
};

export function bhdREventNormalize(req: Request, _res: Response, next: NextFunction) {
  const url = String(req.originalUrl || req.url || '');
  if (req.method !== 'POST' || !url.includes('/integrations/bhd-r/events')) {
    next();
    return;
  }
  const result = normalizeBhdRInboundBody(req.body);
  req.body = result.body;
  const tagged = req as BhdREventRequest;
  tagged.bhdRSkipEvent = result.skip;
  tagged.bhdRSkipReason = result.skipReason;
  next();
}
