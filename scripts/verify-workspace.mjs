import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const root = process.cwd();
const { values } = parseArgs({
  options: {
    all: { type: 'boolean' },
    build: { type: 'boolean' },
    lint: { type: 'boolean' },
    typecheck: { type: 'boolean' }
  }
});

const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  '.env.example',
  'docker-compose.yml',
  'README.md',
  'FOLDER_DESIGN.md',
  'CHANGELOG.md',
  '.github/workflows/ci.yml',
  'packages/config/package.json',
  'packages/config/src/load-env.mjs',
  'packages/db/package.json',
  'packages/db/prisma/schema.prisma',
  'packages/db/prisma/migrations/migration_lock.toml',
  'packages/db/prisma/migrations/20260906120000_initial_foundation/migration.sql'
];

const requiredDirectories = ['apps', 'packages', 'infra', 'scripts'];

async function exists(relativePath) {
  try {
    await access(join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

for (const relativePath of [...requiredFiles, ...requiredDirectories]) {
  if (!(await exists(relativePath))) {
    throw new Error(`Missing required Phase 0.1 path: ${relativePath}`);
  }
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const environment = await readFile(join(root, '.env.example'), 'utf8');
const compose = await readFile(join(root, 'docker-compose.yml'), 'utf8');

for (const script of ['setup', 'dev', 'build', 'lint', 'typecheck', 'test', 'verify']) {
  if (!packageJson.scripts?.[script]) {
    throw new Error(`Missing root script: ${script}`);
  }
}

for (const variable of ['NODE_ENV', 'DATABASE_URL', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']) {
  if (!environment.includes(`${variable}=`)) {
    throw new Error(`Missing environment variable template: ${variable}`);
  }
}

if (!compose.includes('postgres:16-alpine') || !compose.includes('healthcheck:')) {
  throw new Error('Docker Compose must define PostgreSQL and a healthcheck.');
}

const requestedChecks = values.all ? ['lint', 'typecheck', 'build'] : Object.entries(values)
  .filter(([, enabled]) => enabled)
  .map(([name]) => name);

console.log(`Phase 0.1 workspace validation passed${requestedChecks.length ? ` (${requestedChecks.join(', ')})` : ''}.`);
