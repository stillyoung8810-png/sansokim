export const SANSOKIM_POLICY = {
  boxAccrualIntervalMs: 60 * 60 * 1_000,
  maxOfflineAccrualMs: 100 * 60 * 60 * 1_000,
  maxStoredBoxCount: 1000,
  boxTapRequiredCount: 4,
  boxTapMinIntervalMs: 300,
  boxTapSessionExpiresInMs: 10_000,
  tossPointPerBoxOpen: 1,
  maxDailyTossPoint: 300,
  boostMultiplier: 2,
  boostDurationMs: 4 * 60 * 60 * 1_000,
  maxDailyBoostUseCount: 12,
  maxCompletedRewardKeyCount: 1_000,
} as const;
