import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = join(packageRoot, '..', '..');

export async function loadEnvironment() {
  const candidates = [join(repositoryRoot, '.env'), join(repositoryRoot, '.env.example')];

  for (const path of candidates) {
    try {
      await access(path);
      const contents = await readFile(path, 'utf8');
      for (const line of contents.split(/\r?\n/u)) {
        const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/u);
        if (match && process.env[match[1]] === undefined) {
          process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, '');
        }
      }
      return path;
    } catch {
      // Try the next environment source.
    }
  }

  throw new Error('No .env or .env.example file is available.');
}
