import { IsOptional, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../catalog/catalog.dto.js';
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from '../catalog/slug.js';

/**
 * Query contract for the public product list. It deliberately reuses the
 * bounded pagination DTO (page ≥ 1, 1 ≤ limit ≤ 100, q ≤ 120 chars) and adds
 * only the two storefront navigation filters, addressed by public slug — the
 * ERP's internal ids are never part of the public contract. The global
 * ValidationPipe rejects any other parameter (`forbidNonWhitelisted`), so
 * unsupported filters fail loudly instead of being silently ignored.
 */
export class MarketProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: 'category must be a lowercase hyphenated slug.' })
  @MaxLength(MAX_SLUG_LENGTH)
  category?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN, { message: 'brand must be a lowercase hyphenated slug.' })
  @MaxLength(MAX_SLUG_LENGTH)
  brand?: string;
}
