import { SANSOKIM_POLICY } from "./sansokimPolicy";

const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

export type RewardState = {
  readonly stateDateKst: string;
  readonly availableBoxCount: number;
  readonly dailyPaidTossPoint: number;
  readonly dailyBoostUsedCount: number;
  readonly attendedDatesKst: readonly string[];
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

export type AttendanceBoxRewardResult =
  | { readonly type: "applied"; readonly state: RewardState }
  | {
      readonly type: "blocked";
      readonly reason: "alreadyAttended" | "boxStorageFull";
      readonly state: RewardState;
    };

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
    attendedDatesKst: [],
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
    attendedDatesKst: isSameKstMonth(state.stateDateKst, currentDateKst)
      ? state.attendedDatesKst
      : filterAttendanceDatesForMonth(state.attendedDatesKst, currentDateKst),
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

export function getNextBoxAccrualIntervalMs(
  state: RewardState,
  nowMs: number,
): number | null {
  if (state.availableBoxCount >= SANSOKIM_POLICY.maxStoredBoxCount) {
    return null;
  }

  const isBoosted = state.boostEndsAtMs != null && state.boostEndsAtMs > nowMs;
  return isBoosted
    ? SANSOKIM_POLICY.boxAccrualIntervalMs / SANSOKIM_POLICY.boostMultiplier
    : SANSOKIM_POLICY.boxAccrualIntervalMs;
}

export function getNextBoxAccrualProgress(
  state: RewardState,
  nowMs: number,
): number {
  const intervalMs = getNextBoxAccrualIntervalMs(state, nowMs);
  if (intervalMs == null) {
    return 1;
  }

  const remainingMs = getNextBoxRemainingMs(state, nowMs);

  return Math.min(1, Math.max(0, 1 - remainingMs / intervalMs));
}

export function getNextBoxRemainingMs(
  state: RewardState,
  nowMs: number,
): number {
  const intervalMs = getNextBoxAccrualIntervalMs(state, nowMs);
  if (intervalMs == null) {
    return 0;
  }

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

export function applyAttendanceBoxReward(
  state: RewardState,
  nowMs: number,
): AttendanceBoxRewardResult {
  const currentDateKst = getKstDateString(nowMs);
  const rolledOverState = rolloverDailyState(state, currentDateKst);
  const accruedState = accrueBoxes(rolledOverState, nowMs);

  if (accruedState.attendedDatesKst.includes(currentDateKst)) {
    return {
      type: "blocked",
      reason: "alreadyAttended",
      state: accruedState,
    };
  }

  if (accruedState.availableBoxCount >= SANSOKIM_POLICY.maxStoredBoxCount) {
    return {
      type: "blocked",
      reason: "boxStorageFull",
      state: accruedState,
    };
  }

  return {
    type: "applied",
    state: {
      ...accruedState,
      availableBoxCount: accruedState.availableBoxCount + 1,
      attendedDatesKst: appendAttendanceDate(
        accruedState.attendedDatesKst,
        currentDateKst,
      ),
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

function appendAttendanceDate(
  dates: readonly string[],
  dateKst: string,
): readonly string[] {
  if (dates.includes(dateKst)) {
    return dates;
  }

  return [...dates, dateKst];
}

function isSameKstMonth(leftDateKst: string, rightDateKst: string): boolean {
  return leftDateKst.slice(0, 7) === rightDateKst.slice(0, 7);
}

function filterAttendanceDatesForMonth(
  dates: readonly string[],
  currentDateKst: string,
): readonly string[] {
  const currentYearMonth = currentDateKst.slice(0, 7);

  return dates.filter((dateKst) => dateKst.slice(0, 7) === currentYearMonth);
}
