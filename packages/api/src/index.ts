import { createServer } from "node:http";
import type { HealthReport } from "@dots/domain";

export const healthReport = (): HealthReport => ({ service: "api", status: "ok" });

export const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(healthReport()));
    return;
  }
  response.writeHead(404).end();
});

if (process.env.NODE_ENV !== "test") {
  const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
  server.listen(port, "127.0.0.1", () => console.log(`API listening on http://127.0.0.1:${port}`));
}
