import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JsonLogger } from './logger.js';

@Catch()
export class HttpExceptionResponseFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const requestId = response.locals.requestId ?? request.header('x-request-id');
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseCode = typeof exceptionResponse === 'object' && exceptionResponse !== null && 'code' in exceptionResponse
      ? exceptionResponse.code
      : undefined;
    const message = typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
      ? exceptionResponse.message
      : exception instanceof HttpException ? exception.message : 'Internal server error';
    const code = typeof responseCode === 'string'
      ? responseCode
      : status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : this.codeFor(status);

    if (status >= 500) {
      this.logger.error('request.failed', { requestId, statusCode: status, method: request.method, path: request.originalUrl });
    }

    response.status(status).json({
      error: {
        code,
        message: Array.isArray(message) ? 'Request validation failed.' : message,
        details: Array.isArray(message) ? message : undefined,
        requestId,
        timestamp: new Date().toISOString()
      }
    });
  }

  private codeFor(status: number): string {
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    return 'INTERNAL_ERROR';
  }
}
