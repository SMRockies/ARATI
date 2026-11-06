import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppConfig } from './config.js';
import { HttpExceptionResponseFilter } from './http-exception.filter.js';
import { JsonLogger } from './logger.js';
import { RequestIdMiddleware } from './request-id.middleware.js';
import { RequestLoggingInterceptor } from './request-logging.interceptor.js';

async function bootstrap(): Promise<void> {
  const { loadEnvironment } = await import('@arati/config/load-env.mjs');
  await loadEnvironment();

  const app = await NestFactory.create(AppModule, { logger: false });
  const config = app.get(AppConfig);
  config.validate();
  const logger = app.get(JsonLogger);

  app.use(helmet());
  if (config.trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxyHops);
  } else if (config.nodeEnv === 'production') {
    logger.warn('api.trust_proxy_unset', {
      detail: 'TRUST_PROXY_HOPS is 0 in production; behind a reverse proxy every request shares one rate-limit bucket.',
    });
  }
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionResponseFilter(logger));
  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));

  await app.listen(config.port, '0.0.0.0');
  logger.log('api.started', { port: config.port, environment: config.nodeEnv });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  const startupError = JSON.stringify({ level: 'error', service: 'api', message: 'api.startup_failed', error: message });
  process.stderr.write(`${startupError}\n`);
  console.error(startupError);
  process.exitCode = 1;
});