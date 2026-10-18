import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parsePort } from '../apps/api/dist/server.js';
const mode = process.argv[2];
if (!['dev', 'start'].includes(mode)) throw new Error('Expected dev or start');
const apiPort = parsePort(process.env.API_PORT ?? '3001');
const webPort = parsePort(process.env.WEB_PORT ?? '3000');
const children = [
  spawn(process.execPath, ['apps/api/dist/main.js'], { stdio: 'inherit', env: { ...process.env, PORT: String(apiPort) } }),
  spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), mode, '--hostname', '127.0.0.1', '--port', String(webPort)], { cwd: 'apps/web', stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } })
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 5000).unref();
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', (code, signal) => { if (!stopping) stop(code ?? (signal ? 1 : 0)); });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
