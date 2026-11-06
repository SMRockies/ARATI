import { Injectable } from '@nestjs/common';

@Injectable()
export class JsonLogger {
  log(message: string, context: Record<string, unknown> = {}): void {
    this.write('info', message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.write('warn', message, context);
  }

  error(message: string, context: Record<string, unknown> = {}): void {
    this.write('error', message, context);
  }

  private write(level: string, message: string, context: Record<string, unknown>): void {
    process.stdout.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'api',
      message,
      ...context
    })}\n`);
  }
}
