import { createServer as createHttpServer } from 'node:http';
export function createServer() {
  return createHttpServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404);
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    response.writeHead(200);
    response.end(JSON.stringify({ status: 'ok', service: 'dots-api', mode: 'offline', integrationsEnabled: false }));
  });
}
export function parsePort(value: string = '3001'): number {
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer from 0 to 65535');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  return port;
}
