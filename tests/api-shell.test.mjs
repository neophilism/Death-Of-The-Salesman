import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../apps/api/dist/server.js';

test('health is narrow and other routes are blocked', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    const health = await fetch(url + '/health');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal((await health.json()).status, 'ok');
    assert.equal((await fetch(url + '/admin')).status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

