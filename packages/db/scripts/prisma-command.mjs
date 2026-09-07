import { spawn } from 'node:child_process';
import { loadEnvironment } from '@arati/config/load-env.mjs';

await loadEnvironment();

const command = process.platform === 'win32'
  ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'prisma.cmd', ...process.argv.slice(2)]]
  : ['prisma', process.argv.slice(2)];
const child = spawn(command[0], command[1], {
  env: process.env,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
