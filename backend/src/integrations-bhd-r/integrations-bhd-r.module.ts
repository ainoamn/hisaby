import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { IntegrationsBhdRService } from './integrations-bhd-r.service';
import { IntegrationsBhdRController } from './integrations-bhd-r.controller';
import { BhdREventsController } from './bhd-r-events.controller';
import { BhdRSyncService } from './bhd-r-sync.service';
import { BhdRApiClient } from './bhd-r-api.client';

@Module({
  imports: [InvoicesModule],
  controllers: [IntegrationsBhdRController, BhdREventsController],
  providers: [IntegrationsBhdRService, BhdRSyncService, BhdRApiClient],
  exports: [IntegrationsBhdRService, BhdRSyncService],
})
export class IntegrationsBhdRModule {}
