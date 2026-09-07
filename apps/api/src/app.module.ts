import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { AppConfig } from './config.js';
import { JsonLogger } from './logger.js';
import { PrismaService } from './prisma.service.js';

@Module({
  controllers: [HealthController],
  providers: [AppConfig, JsonLogger, PrismaService]
})
export class AppModule {}
