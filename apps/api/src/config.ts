import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfig {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = Number(process.env.API_PORT ?? 3001);
  readonly corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  readonly databaseUrl = process.env.DATABASE_URL;

  validate(): void {
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL is required.');
    }

    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) {
      throw new Error('API_PORT must be a valid TCP port.');
    }
  }
}
