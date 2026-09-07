import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = request.header('x-request-id')?.trim() || `req_${randomUUID()}`;
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-ID', requestId);
    response.locals.requestId = requestId;
    next();
  }
}
