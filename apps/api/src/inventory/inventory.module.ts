import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { ProofStorageService } from './proof-storage.service.js';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, ProofStorageService],
  exports: [InventoryService],
})
export class InventoryModule {}
