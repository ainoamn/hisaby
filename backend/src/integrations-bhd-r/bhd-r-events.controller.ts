import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IntegrationsBhdRService } from './integrations-bhd-r.service';
import { BhdRInboundEventDto } from './dto/bhd-r-event.dto';
import { BhdREventRequest } from '../auth/bhd-r-event.middleware';

@ApiTags('BHD-R integration')
@ApiSecurity('api-key')
@Controller('integrations/bhd-r')
export class BhdREventsController {
  constructor(private service: IntegrationsBhdRService) {}

  @Post('events')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Ingest a BHD-R property accounting event (Bearer qk_bhdr_… inbound token). Idempotent by idempotencyKey.',
  })
  @ApiBody({ type: BhdRInboundEventDto })
  ingest(
    @Req() req: Request,
    @Body() dto: BhdRInboundEventDto,
  ) {
    const skipReq = req as BhdREventRequest;
    if (skipReq.bhdRSkipEvent) {
      return {
        skipped: true,
        reason: skipReq.bhdRSkipReason || 'ignored',
        idempotencyKey: dto.idempotencyKey,
        status: 'ignored',
      };
    }
    const token = this.readToken(req);
    return this.service.ingestEvent(token, dto, req.ip);
  }

  private readToken(req: Request): string {
    const headerKey = req.headers['x-api-key'];
    const auth = req.headers.authorization;
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    throw new UnauthorizedException('Missing inbound token');
  }
}
