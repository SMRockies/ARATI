import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { InventoryBucket } from '@prisma/client';
import { MAX_PAGE_LIMIT } from '../catalog/catalog.rules.js';

const MAX_QUANTITY = 1_000_000;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:/-]{8,200}$/u;
const REFERENCE_TYPE_PATTERN = /^[a-z][a-z0-9._-]{0,39}$/u;

export class InventoryLineDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

export class SignedInventoryLineDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @NotEquals(0)
  @Min(-MAX_QUANTITY)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

export class InventoryQueryDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

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

export class MovementQueryDto extends InventoryQueryDto {
  @IsOptional()
  @IsUUID()
  postingId?: string;

  @IsOptional()
  @IsEnum(InventoryBucket)
  bucket?: InventoryBucket;
}

export class ReceiptDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(IDEMPOTENCY_PATTERN, { message: 'idempotencyKey must be 8-200 letters, digits, dot, colon, slash, underscore, or hyphen.' })
  idempotencyKey?: string;
}

export class ReceiptVariantQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** Shared body for receipts, issues, reservations, and reservation releases. */
export class WarehousePostingDto {
  @IsUUID()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  lines!: InventoryLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(REFERENCE_TYPE_PATTERN, { message: 'referenceType must be lowercase words, digits, dot, underscore, or hyphen.' })
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(IDEMPOTENCY_PATTERN, { message: 'idempotencyKey must be 8-200 letters, digits, dot, colon, slash, underscore, or hyphen.' })
  idempotencyKey?: string;
}

export class TransferDto {
  @IsUUID()
  fromWarehouseId!: string;

  @IsUUID()
  toWarehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  lines!: InventoryLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(REFERENCE_TYPE_PATTERN, { message: 'referenceType must be lowercase words, digits, dot, underscore, or hyphen.' })
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(IDEMPOTENCY_PATTERN, { message: 'idempotencyKey must be 8-200 letters, digits, dot, colon, slash, underscore, or hyphen.' })
  idempotencyKey?: string;
}

/** Adjustments carry a signed quantity and always require a written reason. */
export class AdjustmentDto {
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @Length(3, 500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SignedInventoryLineDto)
  lines!: SignedInventoryLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(IDEMPOTENCY_PATTERN, { message: 'idempotencyKey must be 8-200 letters, digits, dot, colon, slash, underscore, or hyphen.' })
  idempotencyKey?: string;
}

/** Damage write-offs require a reason and reduce sellable stock immediately. */
export class DamageDto {
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @Length(3, 500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  lines!: InventoryLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(IDEMPOTENCY_PATTERN, { message: 'idempotencyKey must be 8-200 letters, digits, dot, colon, slash, underscore, or hyphen.' })
  idempotencyKey?: string;
}
