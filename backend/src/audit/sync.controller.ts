import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipThrottle()
@Controller('sync')
export class SyncController {
  constructor(private prisma: PrismaService) {}

  /** Latest company write. Clients poll this and refresh open pages in place. */
  @Get('cursor')
  async cursor(@CurrentUser() user: TokenPayload) {
    const row = await this.prisma.auditLog.findFirst({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    return {
      cursor: row ? `${row.createdAt.toISOString()}|${row.id}` : '0',
    };
  }
}
