export const SERVICE_NAMES = ["web", "api", "worker"] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface HealthReport {
  readonly service: ServiceName;
  readonly status: "ok" | "disabled";
}

export * from "./contracts.js";
export * from "./fixtures.js";

