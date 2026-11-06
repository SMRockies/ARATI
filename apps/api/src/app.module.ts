import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { JsonLogger } from './logger.js';
import { CoreModule } from './core.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { MarketModule } from './market/market.module.js';

@Module({
  imports: [CoreModule, AuthModule, CatalogModule, InventoryModule, MarketModule],
  controllers: [HealthController],
  providers: [JsonLogger]
})
export class AppModule {}
