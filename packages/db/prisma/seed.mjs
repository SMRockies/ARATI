import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { loadEnvironment } from '@arati/config/load-env.mjs';

await loadEnvironment();
const prisma = new PrismaClient();

try {
  const organization = await prisma.organization.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      code: 'DEMO',
      name: 'Demo Distribution Co.',
      timezone: 'Asia/Kolkata'
    }
  });

  const branch = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'MAIN'
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'MAIN',
      name: 'Main Branch'
    }
  });

  const mainWarehouse = await prisma.warehouse.upsert({
    where: {
      branchId_code: {
        branchId: branch.id,
        code: 'MAIN'
      }
    },
    update: {},
    create: {
      branchId: branch.id,
      code: 'MAIN',
      name: 'Main Warehouse'
    }
  });

  const permissionDescriptions = {
    'branch.read': 'Read branches within the assigned organization scope',
    'user.read': 'Read users within the assigned organization scope',
    'user.create': 'Create users with permissions no greater than the caller',
    'catalog.read': 'Read product categories, brands, products, and variants',
    'catalog.write': 'Create and edit catalogue masters without publishing',
    'catalog.publish': 'Publish or unpublish catalogue products for the market',
    'inventory.read': 'Read stock balances, ledger movements, and availability explanations',
    'inventory.write': 'Post receipts, issues, transfers, reservations, and releases',
    'inventory.adjust': 'Post stock adjustments and damage write-offs',
  };
  for (const [code, description] of Object.entries(permissionDescriptions)) {
    await prisma.permission.upsert({ where: { code }, update: { description }, create: { code, description } });
  }

  const adminRole = await prisma.role.upsert({
    where: { code: 'ORG_ADMIN' },
    update: { name: 'Organization administrator', isSystem: true },
    create: { code: 'ORG_ADMIN', name: 'Organization administrator', isSystem: true },
  });
  const managerRole = await prisma.role.upsert({
    where: { code: 'BRANCH_MANAGER' },
    update: { name: 'Branch manager', isSystem: true },
    create: { code: 'BRANCH_MANAGER', name: 'Branch manager', isSystem: true },
  });
  const staffRole = await prisma.role.upsert({
    where: { code: 'BRANCH_STAFF' },
    update: { name: 'Branch staff', isSystem: true },
    create: { code: 'BRANCH_STAFF', name: 'Branch staff', isSystem: true },
  });

  for (const [role, permissions] of [
    [adminRole, Object.keys(permissionDescriptions)],
    [
      managerRole,
      [
        'branch.read',
        'user.read',
        'user.create',
        'catalog.read',
        'catalog.write',
        'inventory.read',
        'inventory.write',
      ],
    ],
    [staffRole, ['branch.read', 'catalog.read', 'inventory.read']],
  ]) {
    for (const permissionCode of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionCode: { roleId: role.id, permissionCode } },
        update: {},
        create: { roleId: role.id, permissionCode },
      });
    }
  }

  const categoryFixtures = [
    { code: 'REFRIGERATION', name: 'Refrigeration Equipment', slug: 'refrigeration-equipment', description: 'Display coolers, chillers, and visi coolers.' },
    { code: 'COLD-STORAGE', name: 'Cold Storage', slug: 'cold-storage', description: 'Cold rooms and bulk storage equipment.' },
    { code: 'SPARE-PARTS', name: 'Spare Parts', slug: 'spare-parts', description: 'Service parts and accessories.' },
  ];
  const categories = {};
  for (const fixture of categoryFixtures) {
    categories[fixture.code] = await prisma.productCategory.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: fixture.code } },
      update: {},
      create: { organizationId: organization.id, ...fixture },
    });
  }

  const brand = await prisma.productBrand.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'ARATI' } },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ARATI',
      name: 'Arati Refrigeration',
      slug: 'arati-refrigeration',
      description: 'Arati refrigeration equipment and spares.',
    },
  });

  const productFixtures = [
    {
      code: 'VISI-500',
      name: 'Arati Visi 500L Display Cooler',
      slug: 'arati-visi-500l-display-cooler',
      categoryCode: 'REFRIGERATION',
      lifecycleStatus: 'ACTIVE',
      isPublished: true,
      summary: '500 litre display cooler with double-glazed sliding doors.',
      description: 'A 500 litre visi cooler for retail beverage and dairy display, with adjustable shelves and a lockable sliding door.',
      specifications: [
        { name: 'Capacity', value: '500 L' },
        { name: 'Type', value: 'Display cooler' },
        { name: 'Doors', value: 'Double-glazed sliding' },
      ],
      sku: 'VISI-500-PCS',
      variantName: '500 L display cooler',
    },
    {
      code: 'COLD-1000',
      name: 'Arati Cold Room 1000 cu ft',
      slug: 'arati-cold-room-1000-cu-ft',
      categoryCode: 'COLD-STORAGE',
      lifecycleStatus: 'DRAFT',
      isPublished: false,
      summary: 'Modular cold room for bulk dairy and produce storage.',
      description: 'Prefabricated cold room panels with a 1000 cubic foot footprint, installed and commissioned by the Arati service team.',
      specifications: [
        { name: 'Volume', value: '1000 cu ft' },
        { name: 'Panel', value: 'PUF insulated' },
      ],
      sku: 'COLD-1000-PCS',
      variantName: '1000 cu ft cold room',
    },
    {
      code: 'GASKET-1200',
      name: 'Arati Door Gasket 1200 mm',
      slug: 'arati-door-gasket-1200-mm',
      categoryCode: 'SPARE-PARTS',
      lifecycleStatus: 'ACTIVE',
      isPublished: true,
      summary: 'Replacement magnetic door gasket for 1200 mm cooler doors.',
      description: 'Magnetic gasket profile supplied per metre for service replacements on Arati 1200 mm cooler doors.',
      specifications: [{ name: 'Length', value: '1200 mm' }],
      sku: 'GASKET-1200-MTR',
      variantName: '1200 mm gasket (per metre)',
    },
  ];
  for (const fixture of productFixtures) {
    const product = await prisma.product.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: fixture.code } },
      update: {},
      create: {
        organizationId: organization.id,
        categoryId: categories[fixture.categoryCode].id,
        brandId: brand.id,
        code: fixture.code,
        name: fixture.name,
        slug: fixture.slug,
        lifecycleStatus: fixture.lifecycleStatus,
        isPublished: fixture.isPublished,
        publishedAt: fixture.isPublished ? new Date() : null,
        trackingMode: 'QUANTITY',
        summary: fixture.summary,
        description: fixture.description,
        specifications: fixture.specifications,
      },
    });
    await prisma.productVariant.upsert({
      where: { organizationId_sku: { organizationId: organization.id, sku: fixture.sku } },
      update: {},
      create: {
        organizationId: organization.id,
        productId: product.id,
        sku: fixture.sku,
        name: fixture.variantName,
        unitOfMeasure: fixture.sku.endsWith('-MTR') ? 'MTR' : 'PCS',
      },
    });
  }

  // Deterministic opening stock posted through the ledger, so the balance and
  // the movement history always agree and the market label is reproducible.
  const openingStock = [
    { sku: 'VISI-500-PCS', quantity: 25 },
    { sku: 'GASKET-1200-MTR', quantity: 40 },
    { sku: 'COLD-1000-PCS', quantity: 0 },
  ];
  for (const entry of openingStock) {
    if (entry.quantity === 0) continue;
    const idempotencyKey = `seed:opening:${organization.code}:${entry.sku}`;
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { organizationId_sku: { organizationId: organization.id, sku: entry.sku } },
    });
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.inventoryPosting.findFirst({
        where: { organizationId: organization.id, idempotencyKey },
        select: { id: true },
      });
      if (existing) return;
      const posting = await transaction.inventoryPosting.create({
        data: {
          organizationId: organization.id,
          type: 'RECEIPT',
          idempotencyKey,
          referenceType: 'seed',
          reason: 'Deterministic demo opening stock',
        },
      });
      await transaction.stockBalance.createMany({
        data: [{ organizationId: organization.id, warehouseId: mainWarehouse.id, variantId: variant.id }],
        skipDuplicates: true,
      });
      await transaction.stockBalance.update({
        where: { warehouseId_variantId: { warehouseId: mainWarehouse.id, variantId: variant.id } },
        data: { onHand: { increment: entry.quantity }, version: { increment: 1 } },
      });
      await transaction.inventoryMovement.create({
        data: {
          postingId: posting.id,
          organizationId: organization.id,
          warehouseId: mainWarehouse.id,
          variantId: variant.id,
          type: 'RECEIPT',
          bucket: 'ON_HAND',
          quantity: entry.quantity,
          referenceType: 'seed',
          reason: 'Deterministic demo opening stock',
        },
      });
    });
  }

  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (bootstrapEmail || bootstrapPassword) {
    if (!bootstrapEmail || !bootstrapPassword || bootstrapPassword.length < 12) {
      throw new Error('Set both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters), or neither.');
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Bootstrap administrator credentials must not be used in production.');
    }
    const passwordHash = await argon2.hash(bootstrapPassword, { type: argon2.argon2id });
    const admin = await prisma.user.upsert({
      where: { email: bootstrapEmail },
      update: { displayName: 'Demo Organization Administrator', isActive: true },
      create: { email: bootstrapEmail, passwordHash, displayName: 'Demo Organization Administrator' },
    });
    const existingAdminMembership = await prisma.organizationMembership.findFirst({
      where: { userId: admin.id, organizationId: organization.id, branchId: null },
      select: { id: true },
    });
    if (existingAdminMembership) {
      await prisma.organizationMembership.update({
        where: { id: existingAdminMembership.id },
        data: { roleId: adminRole.id, isActive: true },
      });
    } else {
      await prisma.organizationMembership.create({
        data: { userId: admin.id, organizationId: organization.id, roleId: adminRole.id },
      });
    }
    console.log(`Seeded bootstrap administrator ${bootstrapEmail} for ${organization.code}.`);
  }

  console.log(
    `Seeded organization ${organization.code}: identity roles, permissions, demo catalogue masters, and opening stock.`,
  );
} finally {
  await prisma.$disconnect();
}
