import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { MarketProductQueryDto } from './market.dto.js';
import { MarketRateLimitGuard } from './market.rate-limit.js';
import { MarketService } from './market.service.js';
import { MARKET_CACHE_CONTROL } from './market.rules.js';

/**
 * Public, read-only market API (`/api/v1/market/*`).
 *
 * - `@Public()` opts the routes out of session authentication; no cookie or
 *   permission is required (and none is accepted as meaningful).
 * - `MarketRateLimitGuard` bounds abuse per client address.
 * - Every response carries an explicit public cache policy so CDN/browser
 *   caching is intentional rather than incidental; private ERP routes stay
 *   `private, no-store`.
 * - Only GET routes exist: there is deliberately no write path here, so the
 *   storefront physically cannot mutate ERP state through this controller.
 */
@Public()
@UseGuards(MarketRateLimitGuard)
@Controller('api/v1/market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('products')
  @Header('Cache-Control', MARKET_CACHE_CONTROL)
  listProducts(@Query() query: MarketProductQueryDto) {
    return this.market.listProducts(query);
  }

  @Get('products/:slug')
  @Header('Cache-Control', MARKET_CACHE_CONTROL)
  getProduct(@Param('slug') slug: string) {
    return this.market.getProduct(slug);
  }

  @Get('brands')
  @Header('Cache-Control', MARKET_CACHE_CONTROL)
  listBrands(@Query() query: MarketProductQueryDto) {
    return this.market.listBrands(query);
  }

  @Get('categories')
  @Header('Cache-Control', MARKET_CACHE_CONTROL)
  listCategories(@Query() query: MarketProductQueryDto) {
    return this.market.listCategories(query);
  }
}
