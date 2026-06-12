export const FEATURE_FLAG_ENV_KEYS = [
  "ENABLE_CREDITS",
  "ENABLE_DRM",
  "ENABLE_PAYMENTS",
  "ENABLE_FREE_ECONOMY",
  "ENABLE_PRICE_DECAY",
  "ENABLE_AI_AGENTS",
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_ENV_KEYS)[number];
export type FeatureFlags = Record<FeatureFlagName, boolean> &
  Record<string, boolean>;

export type ProcessEnv = Record<string, string | undefined>;

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off"]);

const globalWithProcess = globalThis as typeof globalThis & {
  process?: { env?: ProcessEnv };
};

export function parseEnvBoolean(
  value: string | undefined,
  defaultValue = false,
): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
}

export function readFeatureFlags(
  env: ProcessEnv = globalWithProcess.process?.env ?? {},
): FeatureFlags {
  const flags: FeatureFlags = {} as FeatureFlags;

  for (const key of FEATURE_FLAG_ENV_KEYS) {
    flags[key] = parseEnvBoolean(env[key]);
  }

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("ENABLE_") && !(key in flags)) {
      flags[key] = parseEnvBoolean(value);
    }
  }

  return flags;
}

export const featureFlags = readFeatureFlags();