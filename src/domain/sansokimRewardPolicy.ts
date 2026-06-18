import { SANSOKIM_POLICY } from "./sansokimPolicy";

const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

export type RewardState = {
  readonly stateDateKst: string;
  readonly availableBoxCount: number;
  readonly dailyPaidTossPoint: number;
  readonly dailyBoostUsedCount: number;
  readonly lastAccruedAtMs: number;
  readonly boostEndsAtMs: number | null;
  readonly accrualRemainderBoxUnits: number;
  readonly completedRewardKeys: readonly string[];
};

export type StoredRewardState = RewardState & {
  readonly anonymousHash: string;
  readonly lastSavedAt: string;
};

export type BoostApplyResult =
  | { readonly type: "applied"; readonly state: RewardState }
  | { readonly type: "blocked"; readonly reason: "dailyLimitReached" };

export type BoxOpenRewardDecision =
  | { readonly type: "ready"; readonly amount: number }
  | {
      readonly type: "blocked";
      readonly reason: "emptyBox" | "dailyLimitReached";
    };

export type BoxOpenRewardSuccessResult =
  | { readonly type: "applied"; readonly state: RewardState }
  | {
      readonly type: "blocked";
      readonly reason: "emptyBox" | "dailyLimitReached" | "duplicateReward";
      readonly state: RewardState;
    };

export function getKstDateString(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function createInitialRewardState(
  nowMs: number = Date.now(),
): RewardState {
  return {
    stateDateKst: getKstDateString(nowMs),
    availableBoxCount: 0,
    dailyPaidTossPoint: 0,
    dailyBoostUsedCount: 0,
    lastAccruedAtMs: nowMs,
    boostEndsAtMs: null,
    accrualRemainderBoxUnits: 0,
    completedRewardKeys: [],
  };
}

export function rolloverDailyState(
  state: RewardState,
  currentDateKst: string,
): RewardState {
  if (state.stateDateKst === currentDateKst) {
    return state;
  }

  return {
    ...state,
    stateDateKst: currentDateKst,
    dailyPaidTossPoint: 0,
    dailyBoostUsedCount: 0,
  };
}

export function accrueBoxes(state: RewardState, nowMs: number): RewardState {
  if (!Number.isFinite(nowMs) || nowMs <= state.lastAccruedAtMs) {
    return state;
  }

  const cappedNowMs = Math.min(
    nowMs,
    state.lastAccruedAtMs + SANSOKIM_POLICY.maxOfflineAccrualMs,
  );
  const elapsedMs = Math.max(0, cappedNowMs - state.lastAccruedAtMs);
  const boostEndsAtMs = state.boostEndsAtMs ?? 0;
  const boostedMs = Math.max(
    0,
    Math.min(cappedNowMs, boostEndsAtMs) - state.lastAccruedAtMs,
  );
  const normalMs = Math.max(0, elapsedMs - boostedMs);
  const earnedBoxUnits =
    normalMs / SANSOKIM_POLICY.boxAccrualIntervalMs +
    (boostedMs / SANSOKIM_POLICY.boxAccrualIntervalMs) *
      SANSOKIM_POLICY.boostMultiplier +
    state.accrualRemainderBoxUnits;
  const earnedBoxCount = Math.floor(earnedBoxUnits);
  const nextBoxCount = Math.min(
    SANSOKIM_POLICY.maxStoredBoxCount,
    state.availableBoxCount + earnedBoxCount,
  );
  const isBoxStorageFull = nextBoxCount >= SANSOKIM_POLICY.maxStoredBoxCount;

  return {
    ...state,
    availableBoxCount: nextBoxCount,
    accrualRemainderBoxUnits: isBoxStorageFull
      ? 0
      : earnedBoxUnits - earnedBoxCount,
    lastAccruedAtMs: nowMs,
  };
}

export function getNextBoxRemainingMs(
  state: RewardState,
  nowMs: number,
): number {
  if (state.availableBoxCount >= SANSOKIM_POLICY.maxStoredBoxCount) {
    return 0;
  }

  const isBoosted = state.boostEndsAtMs != null && state.boostEndsAtMs > nowMs;
  const intervalMs = isBoosted
    ? SANSOKIM_POLICY.boxAccrualIntervalMs / SANSOKIM_POLICY.boostMultiplier
    : SANSOKIM_POLICY.boxAccrualIntervalMs;
  const remainderMs = state.accrualRemainderBoxUnits * intervalMs;

  return Math.max(0, intervalMs - remainderMs);
}

export function applyBoostAfterRewardAd(
  state: RewardState,
  nowMs: number,
): BoostApplyResult {
  const rolledOverState = rolloverDailyState(state, getKstDateString(nowMs));
  const accruedState = accrueBoxes(rolledOverState, nowMs);

  if (
    accruedState.dailyBoostUsedCount >= SANSOKIM_POLICY.maxDailyBoostUseCount
  ) {
    return { type: "blocked", reason: "dailyLimitReached" };
  }

  const currentBoostEnd = accruedState.boostEndsAtMs ?? nowMs;
  const extensionBaseMs = Math.max(nowMs, currentBoostEnd);

  return {
    type: "applied",
    state: {
      ...accruedState,
      boostEndsAtMs: extensionBaseMs + SANSOKIM_POLICY.boostDurationMs,
      dailyBoostUsedCount: accruedState.dailyBoostUsedCount + 1,
      lastAccruedAtMs: nowMs,
    },
  };
}

export function getBoxOpenRewardDecision(
  state: RewardState,
): BoxOpenRewardDecision {
  if (state.availableBoxCount <= 0) {
    return { type: "blocked", reason: "emptyBox" };
  }

  if (
    state.dailyPaidTossPoint + SANSOKIM_POLICY.tossPointPerBoxOpen >
    SANSOKIM_POLICY.maxDailyTossPoint
  ) {
    return { type: "blocked", reason: "dailyLimitReached" };
  }

  return {
    type: "ready",
    amount: SANSOKIM_POLICY.tossPointPerBoxOpen,
  };
}

export function applyBoxOpenRewardSuccess(params: {
  readonly state: RewardState;
  readonly tossSuccessKey: string;
}): BoxOpenRewardSuccessResult {
  if (params.state.completedRewardKeys.includes(params.tossSuccessKey)) {
    return {
      type: "blocked",
      reason: "duplicateReward",
      state: params.state,
    };
  }

  const decision = getBoxOpenRewardDecision(params.state);
  if (decision.type === "blocked") {
    return {
      type: "blocked",
      reason: decision.reason,
      state: params.state,
    };
  }

  return {
    type: "applied",
    state: {
      ...params.state,
      availableBoxCount: params.state.availableBoxCount - 1,
      dailyPaidTossPoint: params.state.dailyPaidTossPoint + decision.amount,
      completedRewardKeys: appendCompletedRewardKey(
        params.state.completedRewardKeys,
        params.tossSuccessKey,
      ),
    },
  };
}

function appendCompletedRewardKey(
  keys: readonly string[],
  key: string,
): readonly string[] {
  return [...keys, key].slice(-SANSOKIM_POLICY.maxCompletedRewardKeyCount);
}
