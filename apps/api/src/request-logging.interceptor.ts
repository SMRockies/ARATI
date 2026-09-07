import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request, Response } from 'express';
import { JsonLogger } from './logger.js';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: JsonLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const requestId = response.locals.requestId ?? request.header('x-request-id');

    response.once('finish', () => {
      this.logger.log('request.completed', {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    return next.handle();
  }
}
