-- Phase 2 catalogue masters: categories, brands, products, and variants.
CREATE TYPE "ProductLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "ProductTrackingMode" AS ENUM ('QUANTITY', 'SERIAL', 'BATCH', 'HYBRID');

CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_brands" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "product_brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "brandId" UUID,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "lifecycleStatus" "ProductLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(6),
    "trackingMode" "ProductTrackingMode" NOT NULL DEFAULT 'QUANTITY',
    "summary" VARCHAR(400),
    "description" TEXT,
    "specifications" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "imageUrl" VARCHAR(2048),
    "imageAlt" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "unitOfMeasure" VARCHAR(20) NOT NULL DEFAULT 'PCS',
    "attributes" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_categories_organizationId_code_key" ON "product_categories"("organizationId", "code");
CREATE UNIQUE INDEX "product_categories_organizationId_slug_key" ON "product_categories"("organizationId", "slug");
CREATE INDEX "product_categories_organizationId_isActive_idx" ON "product_categories"("organizationId", "isActive");
CREATE UNIQUE INDEX "product_brands_organizationId_code_key" ON "product_brands"("organizationId", "code");
CREATE UNIQUE INDEX "product_brands_organizationId_slug_key" ON "product_brands"("organizationId", "slug");
CREATE INDEX "product_brands_organizationId_isActive_idx" ON "product_brands"("organizationId", "isActive");
CREATE UNIQUE INDEX "products_organizationId_code_key" ON "products"("organizationId", "code");
CREATE UNIQUE INDEX "products_organizationId_slug_key" ON "products"("organizationId", "slug");
CREATE INDEX "products_organizationId_lifecycleStatus_isPublished_idx" ON "products"("organizationId", "lifecycleStatus", "isPublished");
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX "products_brandId_idx" ON "products"("brandId");
CREATE UNIQUE INDEX "product_variants_organizationId_sku_key" ON "product_variants"("organizationId", "sku");
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "product_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
