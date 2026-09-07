import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('root scripts cover the Phase 0.1 workflow', () => {
  for (const script of ['setup', 'dev', 'build', 'lint', 'typecheck', 'test', 'verify']) {
    assert.equal(typeof packageJson.scripts[script], 'string');
  }
});
