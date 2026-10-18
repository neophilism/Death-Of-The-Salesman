import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 7000);
  try { await exited; } finally { clearTimeout(timer); }
}
test('built shell starts without credentials, serves web/API and releases both ports', { timeout: 20000 }, async () => {
  const web = await reservePort(), api = await reservePort();
  const webPort = web.address().port, apiPort = api.address().port;
  await Promise.all([new Promise(r => web.close(r)), new Promise(r => api.close(r))]);
  const child = spawn(process.execPath, ['scripts/run-shell.mjs', 'start'], {
    env: { PATH: process.env.PATH, WEB_PORT: String(webPort), API_PORT: String(apiPort), NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      assert.equal(child.exitCode, null, output);
      try {
        const [page, health] = await Promise.all([
          fetch(`http://127.0.0.1:${webPort}`, { signal: AbortSignal.timeout(500) }),
          fetch(`http://127.0.0.1:${apiPort}/health`, { signal: AbortSignal.timeout(500) })
        ]);
        if (page.ok && health.ok) {
          const html = await page.text();
          assert.match(html, /Offline application shell/);
          assert.match(html, /No agents connected/);
          assert.doesNotMatch(html, /OPENAI_API_KEY|ANTHROPIC_API_KEY/);
          assert.equal(page.headers.get('x-powered-by'), null);
          assert.equal((await health.json()).integrationsEnabled, false);
          ready = true; break;
        }
      } catch (error) { if (error instanceof assert.AssertionError) throw error; }
      await delay(100);
    }
    assert.ok(ready, output);
    assert.equal((await fetch(`http://127.0.0.1:${webPort}/missing`)).status, 404);
  } finally { await stop(child); }
  assert.equal(child.exitCode, 0, output);
  // Binding the exact ports proves the runner did not orphan its API or web server.
  for (const port of [webPort, apiPort]) {
    const server = createServer();
    server.listen(port, '127.0.0.1');
    await once(server, 'listening');
    await new Promise(resolve => server.close(resolve));
  }
});
test('invalid runner port exits before opening services', async () => {
  const child = spawn(process.execPath, ['scripts/run-shell.mjs', 'start'], { env: { API_PORT: '-1' }, stdio: 'ignore' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
});
