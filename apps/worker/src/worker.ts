export const workerStatus = Object.freeze({ state: 'inactive', mode: 'offline', integrationsEnabled: false } as const);
/** This shell has no queue, provider adapters, timers, or dispatch capability. */
export function describeWorker(): string { return JSON.stringify(workerStatus); }
