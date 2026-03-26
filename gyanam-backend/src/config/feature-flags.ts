export const FEATURE_FLAGS = {
  guidedModeEnabled: true,
  recoveryModeEnabled: true,
  instrumentationEnabled: true,
  premiumEntitlementsEnabled: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag];
}
