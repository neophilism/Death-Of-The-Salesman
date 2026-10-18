import http from 'node:http';

export function createServer() {
  return http.createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404, {'content-type': 'application/json', 'cache-control': 'no-store'});
      response.end('{"error":"not_found"}');
      return;
    }
    response.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
    response.end('{"status":"ok","service":"dots-api"}');
  });
}
if (process.argv[1]?.endsWith('server.mjs')) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  createServer().listen(port, '127.0.0.1');
}
