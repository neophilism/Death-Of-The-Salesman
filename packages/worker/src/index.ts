import type { HealthReport } from "@dots/domain";

export const healthReport = (): HealthReport => ({ service: "worker", status: "disabled" });

if (process.env.NODE_ENV !== "test") {
  console.log("Worker initialized in disabled mode; no jobs or paid integrations were started.");
}
