import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductLifecycleStatus, ProductTrackingMode } from '@prisma/client';
import { MAX_PAGE_LIMIT } from './catalog.rules.js';
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from './slug.js';

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/u;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const UNIT_PATTERN = /^[A-Za-z0-9]+$/u;
const IMAGE_URL_PATTERN = /^(?:https?:\/\/\S+|\/\S*)$/u;

function toBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number;
}

export class CatalogListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class ProductListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsEnum(ProductLifecycleStatus)
  lifecycleStatus?: ProductLifecycleStatus;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isPublished?: boolean;
}

export class CreateCategoryDto {
  @IsString()
  @Length(1, 60)
  @Matches(CODE_PATTERN, { message: 'code must be uppercase letters, digits, hyphen, or underscore.' })
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase words separated by single hyphens.' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBrandDto {
  @IsString()
  @Length(1, 60)
  @Matches(CODE_PATTERN, { message: 'code must be uppercase letters, digits, hyphen, or underscore.' })
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase words separated by single hyphens.' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SpecificationDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsString()
  @Length(1, 200)
  value!: string;
}

export class CreateProductDto {
  @IsString()
  @Length(1, 60)
  @Matches(CODE_PATTERN, { message: 'code must be uppercase letters, digits, hyphen, or underscore.' })
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase words separated by single hyphens.' })
  slug?: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsOptional()
  @IsEnum(ProductTrackingMode)
  trackingMode?: ProductTrackingMode;

  /** Out-of-stock products may either invite enquiries or read as unavailable. */
  @IsOptional()
  @IsBoolean()
  isEnquiryAllowed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SpecificationDto)
  specifications?: SpecificationDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(IMAGE_URL_PATTERN, { message: 'imageUrl must be an absolute http(s) URL or a root-relative path.' })
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageAlt?: string | null;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsOptional()
  @IsEnum(ProductTrackingMode)
  trackingMode?: ProductTrackingMode;

  @IsOptional()
  @IsBoolean()
  isEnquiryAllowed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SpecificationDto)
  specifications?: SpecificationDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(IMAGE_URL_PATTERN, { message: 'imageUrl must be an absolute http(s) URL or a root-relative path.' })
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageAlt?: string | null;
}

export class CreateVariantDto {
  @IsString()
  @Length(1, 80)
  @Matches(SKU_PATTERN, { message: 'sku may contain letters, digits, dot, underscore, and hyphen.' })
  sku!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Matches(UNIT_PATTERN, { message: 'unitOfMeasure may contain letters and digits.' })
  unitOfMeasure?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Matches(UNIT_PATTERN, { message: 'unitOfMeasure may contain letters and digits.' })
  unitOfMeasure?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
