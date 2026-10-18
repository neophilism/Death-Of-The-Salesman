export type AppEnvironment = "development" | "test" | "staging" | "production";

export interface AdapterConfiguration {
  readonly enabled: boolean;
  readonly credential?: string;
}

export interface RuntimeConfiguration {
  readonly environment: AppEnvironment;
  readonly paidSpendLimitCents: number;
  readonly ownerSpendAuthorizationId?: string;
  readonly modelApi: AdapterConfiguration;
  readonly emailDelivery: AdapterConfiguration;
}

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const environments = new Set<AppEnvironment>([
  "development",
  "test",
  "staging",
  "production",
]);

const optional = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const parseBoolean = (name: string, value: string | undefined): boolean => {
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be exactly "true" or "false"`);
};

const parseSpendLimit = (value: string | undefined): number => {
  if (value === undefined || value === "") return 0;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("PAID_SPEND_LIMIT_CENTS must be a non-negative integer");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("PAID_SPEND_LIMIT_CENTS exceeds the safe integer range");
  }
  return parsed;
};

const requireEnabledAdapter = (
  name: string,
  adapter: AdapterConfiguration,
  spendLimit: number,
  authorizationId: string | undefined,
): void => {
  if (!adapter.enabled) return;
  if (!adapter.credential) throw new Error(`${name} is enabled without its credential`);
  if (spendLimit === 0) throw new Error(`${name} is enabled while paid spend remains disabled`);
  if (!authorizationId) throw new Error(`${name} is enabled without owner spend authorization`);
};

export const loadRuntimeConfiguration = (
  source: EnvironmentSource = process.env,
): RuntimeConfiguration => {
  const environmentValue = optional(source.APP_ENV) ?? "development";
  if (!environments.has(environmentValue as AppEnvironment)) {
    throw new Error("APP_ENV must be development, test, staging, or production");
  }
  const environment = environmentValue as AppEnvironment;
  const paidSpendLimitCents = parseSpendLimit(source.PAID_SPEND_LIMIT_CENTS);
  const ownerSpendAuthorizationId = optional(source.OWNER_SPEND_AUTHORIZATION_ID);
  const modelApi = Object.freeze({
    enabled: parseBoolean("MODEL_API_ENABLED", source.MODEL_API_ENABLED),
    credential: optional(source.MODEL_API_KEY),
  });
  const emailDelivery = Object.freeze({
    enabled: parseBoolean("EMAIL_DELIVERY_ENABLED", source.EMAIL_DELIVERY_ENABLED),
    credential: optional(source.EMAIL_DELIVERY_TOKEN),
  });

  requireEnabledAdapter("MODEL_API", modelApi, paidSpendLimitCents, ownerSpendAuthorizationId);
  requireEnabledAdapter("EMAIL_DELIVERY", emailDelivery, paidSpendLimitCents, ownerSpendAuthorizationId);
  if (environment === "production" && paidSpendLimitCents > 0 && !ownerSpendAuthorizationId) {
    throw new Error("production spend requires OWNER_SPEND_AUTHORIZATION_ID");
  }

  return Object.freeze({
    environment,
    paidSpendLimitCents,
    ownerSpendAuthorizationId,
    modelApi,
    emailDelivery,
  });
};
