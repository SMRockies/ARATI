import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermission } from '../auth/auth.decorators.js';
import type { AuthContext } from '../auth/auth.types.js';
import {
  CatalogListQueryDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  PaginationQueryDto,
  ProductListQueryDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

@Controller('api/v1/organizations/:organizationId/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ------------------------------------------------------------------ categories

  @Get('categories')
  @RequirePermission('catalog.read')
  listCategories(@Param('organizationId') organizationId: string, @Query() query: CatalogListQueryDto) {
    return this.catalog.listCategories(organizationId, query);
  }

  @Post('categories')
  @RequirePermission('catalog.write')
  createCategory(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.createCategory(request.auth!.userId, organizationId, body);
  }

  @Patch('categories/:categoryId')
  @RequirePermission('catalog.write')
  updateCategory(
    @Param('organizationId') organizationId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.updateCategory(request.auth!.userId, organizationId, categoryId, body);
  }

  // ---------------------------------------------------------------------- brands

  @Get('brands')
  @RequirePermission('catalog.read')
  listBrands(@Param('organizationId') organizationId: string, @Query() query: CatalogListQueryDto) {
    return this.catalog.listBrands(organizationId, query);
  }

  @Post('brands')
  @RequirePermission('catalog.write')
  createBrand(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateBrandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.createBrand(request.auth!.userId, organizationId, body);
  }

  @Patch('brands/:brandId')
  @RequirePermission('catalog.write')
  updateBrand(
    @Param('organizationId') organizationId: string,
    @Param('brandId') brandId: string,
    @Body() body: UpdateBrandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.updateBrand(request.auth!.userId, organizationId, brandId, body);
  }

  // -------------------------------------------------------------------- products

  @Get('products')
  @RequirePermission('catalog.read')
  listProducts(@Param('organizationId') organizationId: string, @Query() query: ProductListQueryDto) {
    return this.catalog.listProducts(organizationId, query);
  }

  @Post('products')
  @RequirePermission('catalog.write')
  createProduct(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateProductDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.createProduct(request.auth!.userId, organizationId, body);
  }

  @Get('products/:productId')
  @RequirePermission('catalog.read')
  getProduct(@Param('organizationId') organizationId: string, @Param('productId') productId: string) {
    return this.catalog.getProduct(organizationId, productId);
  }

  @Patch('products/:productId')
  @RequirePermission('catalog.write')
  updateProduct(
    @Param('organizationId') organizationId: string,
    @Param('productId') productId: string,
    @Body() body: UpdateProductDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.updateProduct(request.auth!.userId, organizationId, productId, body);
  }

  @Post('products/:productId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.write')
  activateProduct(
    @Param('organizationId') organizationId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.activateProduct(request.auth!.userId, organizationId, productId);
  }

  @Post('products/:productId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.write')
  deactivateProduct(
    @Param('organizationId') organizationId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.deactivateProduct(request.auth!.userId, organizationId, productId);
  }

  @Post('products/:productId/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.publish')
  publishProduct(
    @Param('organizationId') organizationId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.publishProduct(request.auth!.userId, organizationId, productId);
  }

  @Post('products/:productId/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('catalog.publish')
  unpublishProduct(
    @Param('organizationId') organizationId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.unpublishProduct(request.auth!.userId, organizationId, productId);
  }

  // -------------------------------------------------------------------- variants

  @Post('products/:productId/variants')
  @RequirePermission('catalog.write')
  createVariant(
    @Param('organizationId') organizationId: string,
    @Param('productId') productId: string,
    @Body() body: CreateVariantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.createVariant(request.auth!.userId, organizationId, productId, body);
  }

  @Patch('variants/:variantId')
  @RequirePermission('catalog.write')
  updateVariant(
    @Param('organizationId') organizationId: string,
    @Param('variantId') variantId: string,
    @Body() body: UpdateVariantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.catalog.updateVariant(request.auth!.userId, organizationId, variantId, body);
  }

  // ------------------------------------------------------------- market preview

  /** Authenticated preview of the public market projection (published and active only). */
  @Get('market-preview')
  @RequirePermission('catalog.read')
  marketPreview(@Param('organizationId') organizationId: string, @Query() query: PaginationQueryDto) {
    return this.catalog.marketPreview(organizationId, query);
  }
}
