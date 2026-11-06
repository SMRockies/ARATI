import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { OrganizationsController } from './organizations.controller.js';
import { PermissionGuard, SessionAuthGuard } from './auth.guards.js';
import { AuthLoginRateLimitGuard } from './auth.rate-limit.js';

@Module({
  controllers: [AuthController, OrganizationsController],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    AuthLoginRateLimitGuard,
  ],
})
export class AuthModule {}
