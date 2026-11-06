import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfig {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = Number(process.env.API_PORT ?? 3001);
  readonly corsOrigins: string[] = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  readonly databaseUrl = process.env.DATABASE_URL;
  /**
   * Number of reverse proxies in front of the API whose `X-Forwarded-For` hops
   * are trusted. Default 0: no header is trusted, so a client cannot choose its
   * own `request.ip` and thereby dodge a per-address rate limit. Behind nginx or
   * a load balancer this must be set (normally 1), otherwise every request looks
   * like it came from the proxy and all clients share one rate-limit bucket.
   */
  readonly trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  /** Organization whose catalogue the public `/api/v1/market` API serves. */
  readonly marketOrganizationId = process.env.MARKET_ORGANIZATION_ID || null;
  /** Private local storage for receipt proofs; mount durable storage in deployments. */
  readonly inventoryProofStorageDir = process.env.INVENTORY_PROOF_STORAGE_DIR || 'var/inventory-proofs';

  validate(): void {
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL is required.');
    }

    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) {
      throw new Error('API_PORT must be a valid TCP port.');
    }

    if (!Number.isInteger(this.trustProxyHops) || this.trustProxyHops < 0 || this.trustProxyHops > 10) {
      throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10.');
    }

    if (this.corsOrigins.length === 0) {
      throw new Error('CORS_ORIGIN must allow at least one origin.');
    }
    for (const origin of this.corsOrigins) {
      try {
        const parsed = new URL(origin);
        if (parsed.origin !== origin || parsed.pathname !== '/') {
          throw new Error('invalid origin');
        }
      } catch {
        throw new Error(`CORS_ORIGIN entries must be bare origins without paths: received "${origin}".`);
      }
    }
  }
}
