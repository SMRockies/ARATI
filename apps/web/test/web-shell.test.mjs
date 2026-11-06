import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const runtimeConfig = await readFile(new URL('../src/lib/runtime-config.ts', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const consolePage = await readFile(new URL('../src/app/catalog/page.tsx', import.meta.url), 'utf8');
const loginPage = await readFile(new URL('../src/app/login/page.tsx', import.meta.url), 'utf8');
const apiClient = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const hints = await readFile(new URL('../src/lib/catalog-hints.ts', import.meta.url), 'utf8');

test('frontend shell has the Phase 0.4 startup contract', () => {
  assert.match(page, /Arjun/);
  assert.match(page, /Quick actions/);
  assert.match(page, /apiBaseUrl/);
  assert.match(runtimeConfig, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(runtimeConfig, /localhost:3001/);
  assert.match(stylesheet, /@media \(max-width: 620px\)/);
});

test('operator console drives the authenticated catalogue API', () => {
  assert.match(consolePage, /apiSend\('PATCH'/);
  assert.match(consolePage, /products\/\$\{product\.id\}\/\$\{action\}/);
  assert.match(consolePage, /'unpublish' : 'publish'/);
  assert.match(consolePage, /market-preview/);
  assert.match(loginPage, /password/);
  assert.match(apiClient, /credentials: 'include'/);
  assert.match(apiClient, /NEXT_PUBLIC_STOREFRONT_BASE_URL|getStorefrontBaseUrl/);
});

test('console tells the operator which input changes which storefront display', () => {
  // Every editable field must carry a storefront effect, and the legend must be rendered.
  for (const field of ['name', 'summary', 'description', 'brand', 'category', 'specifications', 'isEnquiryAllowed']) {
    assert.match(hints, new RegExp(`field: '${field}'`));
  }
  assert.match(hints, /storefront|Card title|detail page/i);
  assert.match(consolePage, /FIELD_HINTS/);
  assert.match(consolePage, /Live preview/);
  assert.match(consolePage, /describeChanges/);
});
