import { PrismaClient } from '@prisma/client';
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

  await prisma.warehouse.upsert({
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

  console.log(`Seeded organization ${organization.code}.`);
} finally {
  await prisma.$disconnect();
}
