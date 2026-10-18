import { createServer, parsePort } from './server.js';
const server = createServer();
server.listen(parsePort(process.env.PORT), '127.0.0.1', () => console.log('dots-api listening', server.address()));
server.on('error', (error: Error) => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
