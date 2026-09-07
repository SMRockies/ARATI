import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;

function startServer() {
  const mainFile = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const child = spawn(process.execPath, [mainFile], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, API_PORT: String(port), DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/not_ready' },
    stdio: 'pipe'
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  child.on('error', (error) => process.stderr.write(`${error.stack}\n`));
  child.on('exit', (code, signal) => process.stderr.write(`API child exited code=${code} signal=${signal}\n`));
  return child;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await fetch(`${baseUrl}/health`);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('API did not start within 3 seconds.');
}

test('API health and error contracts', async (t) => {
  const server = startServer();
  t.after(() => server.kill());
  const health = await waitForServer();
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  assert.match(health.headers.get('x-request-id'), /^req_/);
  const ready = await fetch(`${baseUrl}/ready`);
  assert.equal(ready.status, 503);
  assert.equal((await ready.json()).error.code, 'DATABASE_NOT_READY');
  const missingResponse = await fetch(`${baseUrl}/missing`);
  assert.equal(missingResponse.status, 404);
  const missing = await missingResponse.json();
  assert.equal(missing.error.code, 'NOT_FOUND');
  assert.match(missing.error.requestId, /^req_/);
});
