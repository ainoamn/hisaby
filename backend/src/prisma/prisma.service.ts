import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ensureBhdSubColumn } from './ensure-bhd-sub';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    // Non-fatal: column already on Neon; keep boot alive even if ALTER is denied
    const ok = await ensureBhdSubColumn(this);
    if (ok) this.logger.log('users.bhd_sub column ensured');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
