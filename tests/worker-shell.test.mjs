import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { workerStatus } from '../apps/worker/dist/worker.js';
import { parsePort } from '../apps/api/dist/server.js';
test('worker explicitly reports offline and terminates without dispatch', () => {
  const child = spawnSync(process.execPath, ['apps/worker/dist/main.js'], { encoding: 'utf8', timeout: 2000 });
  assert.equal(child.status, 0);
  assert.deepEqual(JSON.parse(child.stdout), workerStatus);
  assert.equal(workerStatus.integrationsEnabled, false);
  assert.equal(workerStatus.state, 'inactive');
});
test('API rejects ambiguous and unsafe ports', () => {
  for (const port of ['', '-1', '65536', 'abc', '1.2', '1e3', ' 3001', 'Infinity']) assert.throws(() => parsePort(port));
  assert.equal(parsePort(), 3001);
  assert.equal(parsePort('0'), 0);
  assert.equal(parsePort('65535'), 65535);
});
