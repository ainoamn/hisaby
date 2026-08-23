import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ensureBhdSubColumn } from '../auth/ensure-bhd-sub';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    const ok = await ensureBhdSubColumn(this);
    if (ok) this.logger.log('users.bhd_sub column ensured');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
