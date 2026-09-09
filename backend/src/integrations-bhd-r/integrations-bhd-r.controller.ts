import { Body, Controller, Get, Logger, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { IntegrationsBhdRService } from './integrations-bhd-r.service';
import { BhdRSyncService } from './bhd-r-sync.service';
import { UpdateBhdRSettingsDto } from './dto/bhd-r-event.dto';

@ApiTags('BHD-R integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/bhd-r')
export class IntegrationsBhdRController {
  private readonly logger = new Logger(IntegrationsBhdRController.name);

  constructor(
    private service: IntegrationsBhdRService,
    private sync: BhdRSyncService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'BHD R integration status (secrets never returned)' })
  status(@CurrentUser() user: TokenPayload) {
    return this.service.getStatus(user.companyId);
  }

  @Get('readme')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Arabic/English guide: connect BHD R properties' })
  readme() {
    return this.service.getReadme();
  }

  @Post('inbound-token')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create inbound integration token — secret returned once' })
  createToken(@CurrentUser() user: TokenPayload) {
    return this.service.createInboundToken(user.companyId, user.sub);
  }

  @Post('inbound-token/revoke')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revoke the current inbound integration token' })
  revokeToken(@CurrentUser() user: TokenPayload) {
    return this.service.revokeInboundToken(user.companyId);
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Save optional BHD-R read key and organization id' })
  async updateSettings(
    @CurrentUser() user: TokenPayload,
    @Body() dto: UpdateBhdRSettingsDto,
  ) {
    const status = await this.service.updateSettings(user.companyId, dto);
    if (status.readKey.configured) {
      void this.sync.syncCompany(user.companyId).catch((err) => {
        this.logger.warn(
          `BHD-R sync after save failed: ${err instanceof Error ? err.message : err}`,
        );
      });
    }
    return { ...status, syncStarted: !!status.readKey.configured };
  }

  @Post('sync')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'Pull properties, parties, invoices, payments and expenses from BHD-R now' })
  syncNow(@CurrentUser() user: TokenPayload) {
    return this.sync.syncCompany(user.companyId);
  }
}
