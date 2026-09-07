import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const runtimeConfig = await readFile(new URL('../src/lib/runtime-config.ts', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('frontend shell has the Phase 0.4 startup contract', () => {
  assert.match(page, /Arjun/);
  assert.match(page, /Quick actions/);
  assert.match(page, /apiBaseUrl/);
  assert.match(runtimeConfig, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(runtimeConfig, /localhost:3001/);
  assert.match(stylesheet, /@media \(max-width: 620px\)/);
});
