import { Controller, Get, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { Public } from './auth/auth.decorators.js';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'api' };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string; service: string; database: string }> {
    try {
      await this.prisma.checkConnection();
      return { status: 'ready', service: 'api', database: 'postgresql' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_NOT_READY',
        message: 'Database is not ready.'
      });
    }
  }
}
