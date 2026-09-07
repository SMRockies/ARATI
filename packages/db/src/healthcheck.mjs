import { PrismaClient } from '@prisma/client';
import { loadEnvironment } from '@arati/config/load-env.mjs';

await loadEnvironment();
const prisma = new PrismaClient();

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log(JSON.stringify({ status: 'ready', database: 'postgresql' }));
} catch (error) {
  console.error(JSON.stringify({ status: 'not_ready', database: 'postgresql', error: error.message }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
