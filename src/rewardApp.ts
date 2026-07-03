import {
  applyBoxTap,
  createBoxOpenOpportunity,
  createInitialBoxOpenTapState,
  getActiveBoxOpenOpportunity,
  type BoxOpenOpportunity,
  type BoxOpenTapResult,
  type BoxOpenTapState,
} from "./domain/boxOpenOpportunity";
import { SANSOKIM_POLICY } from "./domain/sansokimPolicy";
import {
  accrueBoxes,
  applyAttendanceBoxReward,
  applyBoostAfterRewardAd,
  applyBoxOpenRewardSuccess,
  createInitialRewardState,
  getBoxOpenRewardDecision,
  getKstDateString,
  rolloverDailyState,
  type RewardState,
  type StoredRewardState,
} from "./domain/sansokimRewardPolicy";

type RewardAdGateway = {
  readonly load: () => Promise<{ readonly type: "loaded" } | { readonly type: "failed" }>;
  readonly show: () => Promise<
    | { readonly type: "earnedReward" }
    | { readonly type: "dismissed" }
    | { readonly type: "failed" }
  >;
};

type TossPointPromotionGateway = {
  readonly grantTossPoint: (
    amount: number,
  ) => Promise<
    | { readonly type: "success"; readonly tossSuccessKey: string }
    | { readonly type: "failed"; readonly reason: string }
  >;
};

export const MOCK_SANSOKIM_ANONYMOUS_HASH = "mock-sansokim-user";

export type Screen = "home" | "point";
export type RestoreStatus = "loading" | "ready";

export type RewardAppState = {
  readonly restoreStatus: RestoreStatus;
  readonly currentScreen: Screen;
  readonly rewardState: StoredRewardState;
  readonly boxOpenOpportunity: BoxOpenOpportunity | null;
  readonly boxOpenTapState: BoxOpenTapState;
  readonly isBoxOpenOpportunityRequesting: boolean;
  readonly isBoostRequesting: boolean;
  readonly isBoxOpenCrediting: boolean;
  readonly isAttendanceSubmitting: boolean;
  readonly bannerMessage: string | null;
};

export type RewardAppStorage = {
  readonly rewardState: {
    readonly read: () => Promise<unknown | null>;
    readonly write: (state: StoredRewardState) => Promise<void>;
  };
  readonly boxOpenOpportunity: {
    readonly read: () => Promise<unknown | null>;
    readonly write: (opportunity: BoxOpenOpportunity) => Promise<void>;
    readonly clear: () => Promise<void>;
  };
};

export type RewardAppStorageSnapshot = {
  readonly rewardState: StoredRewardState | null;
  readonly boxOpenOpportunity: BoxOpenOpportunity | null;
};

export type MockBoxOpenOpportunityResult =
  | { readonly type: "granted"; readonly state: RewardAppState }
  | { readonly type: "blocked"; readonly reason: "alreadyActive"; readonly state: RewardAppState };

export type MockBoostResult =
  | { readonly type: "applied"; readonly state: RewardAppState }
  | { readonly type: "blocked"; readonly reason: "dailyLimitReached"; readonly state: RewardAppState };

export type RewardAdRequestStartResult =
  | { readonly type: "started"; readonly state: RewardAppState }
  | {
      readonly type: "blocked";
      readonly reason: "alreadyActive" | "busy";
      readonly state: RewardAppState;
    };

export type GatewayBoxOpenOpportunityResult =
  | { readonly type: "granted"; readonly state: RewardAppState }
  | {
      readonly type: "failed";
      readonly reason: "adLoadFailed" | "adNotCompleted";
      readonly state: RewardAppState;
    };

export type GatewayBoostResult =
  | { readonly type: "applied"; readonly state: RewardAppState }
  | {
      readonly type: "blocked";
      readonly reason: "dailyLimitReached";
      readonly state: RewardAppState;
    }
  | {
      readonly type: "failed";
      readonly reason: "adLoadFailed" | "adNotCompleted";
      readonly state: RewardAppState;
    };

export type AttendanceBoxRewardSubmitResult =
  | { readonly type: "applied"; readonly state: RewardAppState }
  | {
      readonly type: "blocked";
      readonly reason: "busy" | "alreadyAttended" | "boxStorageFull";
      readonly state: RewardAppState;
    };

export type RewardAppBoxTapResult =
  | {
      readonly type: "accepted" | "ignored" | "expired";
      readonly tapResult: BoxOpenTapResult;
      readonly state: RewardAppState;
    }
  | {
      readonly type: "completed";
      readonly rewardResult:
        | { readonly type: "success" }
        | {
            readonly type: "blocked";
            readonly reason:
              | "busy"
              | "noOpportunity"
              | "emptyBox"
              | "dailyLimitReached"
              | "duplicateReward"
              | "promotionFailed";
          };
      readonly state: RewardAppState;
    };

export function createStoredRewardState(params: {
  readonly anonymousHash: string;
  readonly rewardState: RewardState;
  readonly savedAt: string;
}): StoredRewardState {
  return {
    ...params.rewardState,
    anonymousHash: params.anonymousHash,
    lastSavedAt: params.savedAt,
  };
}

export function createInitialStoredRewardState(params: {
  readonly anonymousHash?: string;
  readonly nowMs: number;
  readonly savedAt?: string;
}): StoredRewardState {
  return createStoredRewardState({
    anonymousHash: params.anonymousHash ?? MOCK_SANSOKIM_ANONYMOUS_HASH,
    rewardState: createInitialRewardState(params.nowMs),
    savedAt: params.savedAt ?? new Date(params.nowMs).toISOString(),
  });
}

export function createInitialRewardAppState(params: {
  readonly rewardState: StoredRewardState;
  readonly boxOpenOpportunity?: BoxOpenOpportunity | null;
  readonly restoreStatus?: RestoreStatus;
}): RewardAppState {
  return {
    restoreStatus: params.restoreStatus ?? "ready",
    currentScreen: "home",
    rewardState: params.rewardState,
    boxOpenOpportunity: params.boxOpenOpportunity ?? null,
    boxOpenTapState: createInitialBoxOpenTapState(),
    isBoxOpenOpportunityRequesting: false,
    isBoostRequesting: false,
    isBoxOpenCrediting: false,
    isAttendanceSubmitting: false,
    bannerMessage: null,
  };
}

export function restoreRewardAppState(params: {
  readonly rawRewardState: unknown;
  readonly rawBoxOpenOpportunity: unknown;
  readonly anonymousHash?: string;
  readonly nowMs: number;
  readonly savedAt?: string;
}): RewardAppState {
  const anonymousHash = params.anonymousHash ?? MOCK_SANSOKIM_ANONYMOUS_HASH;
  const savedAt = params.savedAt ?? new Date(params.nowMs).toISOString();
  const rewardState = refreshStoredRewardState(
    restoreStoredRewardState({
      rawValue: params.rawRewardState,
      anonymousHash,
      nowMs: params.nowMs,
      savedAt,
    }),
    params.nowMs,
    savedAt,
  );
  const boxOpenOpportunity = restoreBoxOpenOpportunity({
    rawValue: params.rawBoxOpenOpportunity,
    anonymousHash,
    nowMs: params.nowMs,
  });

  return createInitialRewardAppState({
    rewardState,
    boxOpenOpportunity,
    restoreStatus: "ready",
  });
}

export async function initializeRewardAppState(params: {
  readonly storage: RewardAppStorage;
  readonly nowMs?: number;
  readonly anonymousHash?: string;
}): Promise<RewardAppState> {
  const nowMs = params.nowMs ?? Date.now();
  const [rawRewardState, rawBoxOpenOpportunity] = await Promise.all([
    params.storage.rewardState.read(),
    params.storage.boxOpenOpportunity.read(),
  ]);
  const state = restoreRewardAppState({
    rawRewardState,
    rawBoxOpenOpportunity,
    anonymousHash: params.anonymousHash,
    nowMs,
  });

  await params.storage.rewardState.write(state.rewardState);
  if (state.boxOpenOpportunity == null && rawBoxOpenOpportunity != null) {
    await params.storage.boxOpenOpportunity.clear();
  }

  return state;
}

export function refreshRewardAppState(
  state: RewardAppState,
  nowMs: number,
): RewardAppState {
  const rewardState = refreshStoredRewardState(
    state.rewardState,
    nowMs,
    new Date(nowMs).toISOString(),
  );
  const boxOpenOpportunity = getActiveBoxOpenOpportunity(
    state.boxOpenOpportunity,
    nowMs,
  );

  return {
    ...state,
    rewardState,
    boxOpenOpportunity,
    boxOpenTapState:
      boxOpenOpportunity == null
        ? createInitialBoxOpenTapState()
        : state.boxOpenTapState,
  };
}

export function openHomeScreen(state: RewardAppState): RewardAppState {
  return {
    ...state,
    currentScreen: "home",
    bannerMessage: null,
  };
}

export function openPointScreen(state: RewardAppState): RewardAppState {
  return {
    ...state,
    currentScreen: "point",
    bannerMessage: null,
  };
}

export function submitAttendanceForBoxReward(
  state: RewardAppState,
  nowMs: number,
): AttendanceBoxRewardSubmitResult {
  const refreshedState = refreshRewardAppState(state, nowMs);

  if (
    isRewardAdBusy(refreshedState) ||
    refreshedState.isBoxOpenCrediting ||
    refreshedState.isAttendanceSubmitting
  ) {
    return {
      type: "blocked",
      reason: "busy",
      state: {
        ...refreshedState,
        bannerMessage: "이미 처리 중인 요청이 있어요.",
      },
    };
  }

  const attendanceResult = applyAttendanceBoxReward(
    refreshedState.rewardState,
    nowMs,
  );

  if (attendanceResult.type === "blocked") {
    return {
      type: "blocked",
      reason: attendanceResult.reason,
      state: {
        ...refreshedState,
        rewardState: toStoredRewardState({
          previousState: refreshedState.rewardState,
          rewardState: attendanceResult.state,
          savedAt: new Date(nowMs).toISOString(),
        }),
        bannerMessage: getAttendanceBlockedMessage(attendanceResult.reason),
      },
    };
  }

  return {
    type: "applied",
    state: {
      ...refreshedState,
      rewardState: toStoredRewardState({
        previousState: refreshedState.rewardState,
        rewardState: attendanceResult.state,
        savedAt: new Date(nowMs).toISOString(),
      }),
      bannerMessage: "출석 완료! 산소 상자 1개가 추가됐어요.",
    },
  };
}

export function startBoxOpenOpportunityRequest(
  state: RewardAppState,
  nowMs: number,
): RewardAdRequestStartResult {
  const refreshedState = refreshRewardAppState(state, nowMs);

  if (isRewardAdBusy(refreshedState) || refreshedState.isBoxOpenCrediting) {
    return {
      type: "blocked",
      reason: "busy",
      state: {
        ...refreshedState,
        bannerMessage: "이미 처리 중인 요청이 있어요.",
      },
    };
  }

  if (refreshedState.boxOpenOpportunity != null) {
    return {
      type: "blocked",
      reason: "alreadyActive",
      state: {
        ...refreshedState,
        bannerMessage: "이미 사용할 수 있는 상자 열기 기회가 있어요.",
      },
    };
  }

  return {
    type: "started",
    state: {
      ...refreshedState,
      isBoxOpenOpportunityRequesting: true,
      bannerMessage: null,
    },
  };
}

export async function finishBoxOpenOpportunityRequestWithGateway(params: {
  readonly state: RewardAppState;
  readonly rewardAdGateway: RewardAdGateway;
  readonly nowMs: number;
}): Promise<GatewayBoxOpenOpportunityResult> {
  const adResult = await showRewardAdForReward(params.rewardAdGateway);

  if (adResult.type === "failed") {
    return {
      type: "failed",
      reason: adResult.reason,
      state: {
        ...params.state,
        isBoxOpenOpportunityRequesting: false,
        bannerMessage:
          adResult.reason === "adLoadFailed"
            ? "광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            : "광고 시청이 완료되지 않았어요.",
      },
    };
  }

  return {
    type: "granted",
    state: {
      ...params.state,
      boxOpenOpportunity: createBoxOpenOpportunity({
        anonymousHash: params.state.rewardState.anonymousHash,
        nowMs: params.nowMs,
      }),
      boxOpenTapState: createInitialBoxOpenTapState(),
      isBoxOpenOpportunityRequesting: false,
      bannerMessage: "상자 열기 기회가 준비됐어요.",
    },
  };
}

export function startBoostRequest(
  state: RewardAppState,
  nowMs: number,
): RewardAdRequestStartResult {
  const refreshedState = refreshRewardAppState(state, nowMs);

  if (isRewardAdBusy(refreshedState) || refreshedState.isBoxOpenCrediting) {
    return {
      type: "blocked",
      reason: "busy",
      state: {
        ...refreshedState,
        bannerMessage: "이미 처리 중인 요청이 있어요.",
      },
    };
  }

  return {
    type: "started",
    state: {
      ...refreshedState,
      isBoostRequesting: true,
      bannerMessage: null,
    },
  };
}

export async function finishBoostRequestWithGateway(params: {
  readonly state: RewardAppState;
  readonly rewardAdGateway: RewardAdGateway;
  readonly nowMs: number;
}): Promise<GatewayBoostResult> {
  const adResult = await showRewardAdForReward(params.rewardAdGateway);

  if (adResult.type === "failed") {
    return {
      type: "failed",
      reason: adResult.reason,
      state: {
        ...params.state,
        isBoostRequesting: false,
        bannerMessage:
          adResult.reason === "adLoadFailed"
            ? "광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            : "광고 시청이 완료되지 않았어요.",
      },
    };
  }

  const boostResult = applyBoostAfterRewardAd(
    params.state.rewardState,
    params.nowMs,
  );

  if (boostResult.type === "blocked") {
    return {
      type: "blocked",
      reason: boostResult.reason,
      state: {
        ...params.state,
        isBoostRequesting: false,
        bannerMessage: "오늘 받을 수 있는 부스트를 모두 받았어요.",
      },
    };
  }

  return {
    type: "applied",
    state: {
      ...params.state,
      rewardState: toStoredRewardState({
        previousState: params.state.rewardState,
        rewardState: boostResult.state,
        savedAt: new Date(params.nowMs).toISOString(),
      }),
      isBoostRequesting: false,
      bannerMessage: "2시간 부스트가 적용됐어요.",
    },
  };
}

export function grantMockBoxOpenOpportunity(
  state: RewardAppState,
  nowMs: number,
): MockBoxOpenOpportunityResult {
  const refreshedState = refreshRewardAppState(state, nowMs);

  if (refreshedState.boxOpenOpportunity != null) {
    return {
      type: "blocked",
      reason: "alreadyActive",
      state: {
        ...refreshedState,
        bannerMessage: "이미 사용할 수 있는 상자 열기 기회가 있어요.",
      },
    };
  }

  return {
    type: "granted",
    state: {
      ...refreshedState,
      boxOpenOpportunity: createBoxOpenOpportunity({
        anonymousHash: refreshedState.rewardState.anonymousHash,
        nowMs,
      }),
      boxOpenTapState: createInitialBoxOpenTapState(),
      bannerMessage: "상자 열기 기회가 준비됐어요.",
    },
  };
}

export function applyMockBoost(
  state: RewardAppState,
  nowMs: number,
): MockBoostResult {
  const result = applyBoostAfterRewardAd(state.rewardState, nowMs);

  if (result.type === "blocked") {
    return {
      type: "blocked",
      reason: result.reason,
      state: {
        ...refreshRewardAppState(state, nowMs),
        bannerMessage: "오늘 받을 수 있는 부스트를 모두 받았어요.",
      },
    };
  }

  return {
    type: "applied",
    state: {
      ...state,
      rewardState: toStoredRewardState({
        previousState: state.rewardState,
        rewardState: result.state,
        savedAt: new Date(nowMs).toISOString(),
      }),
      bannerMessage: "2시간 부스트가 적용됐어요.",
    },
  };
}

export function tapBoxForMockPayout(
  state: RewardAppState,
  tappedAtMs: number,
): RewardAppBoxTapResult {
  if (state.isBoxOpenCrediting) {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: "busy" },
      state: {
        ...state,
        bannerMessage: "토스 포인트를 지급하고 있어요.",
      },
    };
  }

  const refreshedState = refreshRewardAppState(state, tappedAtMs);
  const tapResult = applyBoxTap(refreshedState.boxOpenTapState, tappedAtMs);

  if (tapResult.type !== "completed") {
    return {
      type: tapResult.type,
      tapResult,
      state: {
        ...refreshedState,
        boxOpenTapState: tapResult.state,
        bannerMessage:
          tapResult.type === "ignored"
            ? "천천히 한 번씩 터치해 주세요."
            : null,
      },
    };
  }

  if (refreshedState.boxOpenOpportunity == null) {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: "noOpportunity" },
      state: {
        ...refreshedState,
        boxOpenTapState: tapResult.state,
        bannerMessage: "상자 열기 기회를 받아주세요.",
      },
    };
  }

  const rewardResult = applyBoxOpenRewardSuccess({
    state: refreshedState.rewardState,
    tossSuccessKey: createMockTossSuccessKey({
      opportunity: refreshedState.boxOpenOpportunity,
    }),
  });

  if (rewardResult.type === "blocked") {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: rewardResult.reason },
      state: {
        ...refreshedState,
        boxOpenTapState: tapResult.state,
        bannerMessage: getBoxOpenBlockedMessage(rewardResult.reason),
      },
    };
  }

  return {
    type: "completed",
    rewardResult: { type: "success" },
    state: {
      ...refreshedState,
      rewardState: toStoredRewardState({
        previousState: refreshedState.rewardState,
        rewardState: rewardResult.state,
        savedAt: new Date(tappedAtMs).toISOString(),
      }),
      boxOpenOpportunity: null,
      boxOpenTapState: tapResult.state,
      bannerMessage: "토스 포인트 1원이 지급됐어요.",
    },
  };
}

export async function tapBoxForPayoutWithGateway(params: {
  readonly state: RewardAppState;
  readonly promotionGateway: TossPointPromotionGateway;
  readonly tappedAtMs: number;
}): Promise<RewardAppBoxTapResult> {
  if (params.state.isBoxOpenCrediting) {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: "busy" },
      state: {
        ...params.state,
        bannerMessage: "토스 포인트를 지급하고 있어요.",
      },
    };
  }

  const refreshedState = refreshRewardAppState(
    params.state,
    params.tappedAtMs,
  );
  const tapResult = applyBoxTap(
    refreshedState.boxOpenTapState,
    params.tappedAtMs,
  );

  if (tapResult.type !== "completed") {
    return {
      type: tapResult.type,
      tapResult,
      state: {
        ...refreshedState,
        boxOpenTapState: tapResult.state,
        bannerMessage:
          tapResult.type === "ignored"
            ? "천천히 한 번씩 터치해 주세요."
            : null,
      },
    };
  }

  if (refreshedState.boxOpenOpportunity == null) {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: "noOpportunity" },
      state: {
        ...refreshedState,
        boxOpenTapState: tapResult.state,
        bannerMessage: "상자 열기 기회를 받아주세요.",
      },
    };
  }

  const decision = getBoxOpenRewardDecision(refreshedState.rewardState);
  if (decision.type === "blocked") {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: decision.reason },
      state: {
        ...refreshedState,
        boxOpenTapState: tapResult.state,
        bannerMessage: getBoxOpenBlockedMessage(decision.reason),
      },
    };
  }

  const creditingState = {
    ...refreshedState,
    boxOpenTapState: tapResult.state,
    isBoxOpenCrediting: true,
    bannerMessage: "토스 포인트를 지급하고 있어요.",
  };
  const grantResult = await params.promotionGateway.grantTossPoint(
    SANSOKIM_POLICY.tossPointPerBoxOpen,
  );

  if (grantResult.type === "failed") {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: "promotionFailed" },
      state: {
        ...creditingState,
        isBoxOpenCrediting: false,
        bannerMessage: getPromotionFailureMessage(grantResult.reason),
      },
    };
  }

  const rewardResult = applyBoxOpenRewardSuccess({
    state: refreshedState.rewardState,
    tossSuccessKey: grantResult.tossSuccessKey,
  });

  if (rewardResult.type === "blocked") {
    return {
      type: "completed",
      rewardResult: { type: "blocked", reason: rewardResult.reason },
      state: {
        ...creditingState,
        isBoxOpenCrediting: false,
        bannerMessage: getBoxOpenBlockedMessage(rewardResult.reason),
      },
    };
  }

  return {
    type: "completed",
    rewardResult: { type: "success" },
    state: {
      ...creditingState,
      rewardState: toStoredRewardState({
        previousState: refreshedState.rewardState,
        rewardState: rewardResult.state,
        savedAt: new Date(params.tappedAtMs).toISOString(),
      }),
      boxOpenOpportunity: null,
      isBoxOpenCrediting: false,
      bannerMessage: "토스 포인트 1원이 지급됐어요.",
    },
  };
}

export function getRewardAppStorageSnapshot(
  state: RewardAppState,
): RewardAppStorageSnapshot {
  return {
    rewardState: state.rewardState,
    boxOpenOpportunity: state.boxOpenOpportunity,
  };
}

async function showRewardAdForReward(
  rewardAdGateway: RewardAdGateway,
): Promise<
  | { readonly type: "earnedReward" }
  | { readonly type: "failed"; readonly reason: "adLoadFailed" | "adNotCompleted" }
> {
  const loadResult = await rewardAdGateway.load();

  if (loadResult.type !== "loaded") {
    return { type: "failed", reason: "adLoadFailed" };
  }

  const showResult = await rewardAdGateway.show();

  if (showResult.type !== "earnedReward") {
    return { type: "failed", reason: "adNotCompleted" };
  }

  return { type: "earnedReward" };
}

function isRewardAdBusy(state: RewardAppState): boolean {
  return state.isBoxOpenOpportunityRequesting || state.isBoostRequesting;
}

function restoreStoredRewardState(params: {
  readonly rawValue: unknown;
  readonly anonymousHash: string;
  readonly nowMs: number;
  readonly savedAt: string;
}): StoredRewardState {
  if (!isRecord(params.rawValue)) {
    return createInitialStoredRewardState({
      anonymousHash: params.anonymousHash,
      nowMs: params.nowMs,
      savedAt: params.savedAt,
    });
  }

  if (params.rawValue.anonymousHash !== params.anonymousHash) {
    return createInitialStoredRewardState({
      anonymousHash: params.anonymousHash,
      nowMs: params.nowMs,
      savedAt: params.savedAt,
    });
  }

  return {
    ...sanitizeRewardState(params.rawValue, params.nowMs),
    anonymousHash: params.anonymousHash,
    lastSavedAt: sanitizeString(params.rawValue.lastSavedAt, params.savedAt),
  };
}

function restoreBoxOpenOpportunity(params: {
  readonly rawValue: unknown;
  readonly anonymousHash: string;
  readonly nowMs: number;
}): BoxOpenOpportunity | null {
  if (!isRecord(params.rawValue)) {
    return null;
  }

  if (params.rawValue.anonymousHash !== params.anonymousHash) {
    return null;
  }

  const opportunity: BoxOpenOpportunity = {
    anonymousHash: params.anonymousHash,
    idempotencyKey: sanitizeString(params.rawValue.idempotencyKey, ""),
    earnedAtMs: sanitizeFiniteNumber(params.rawValue.earnedAtMs, params.nowMs),
    expiresAtMs: sanitizeFiniteNumber(params.rawValue.expiresAtMs, params.nowMs),
  };

  if (opportunity.idempotencyKey === "") {
    return null;
  }

  return getActiveBoxOpenOpportunity(opportunity, params.nowMs);
}

function refreshStoredRewardState(
  state: StoredRewardState,
  nowMs: number,
  savedAt: string,
): StoredRewardState {
  const rolledOverState = rolloverDailyState(state, getKstDateString(nowMs));
  const accruedState = accrueBoxes(rolledOverState, nowMs);

  return toStoredRewardState({
    previousState: state,
    rewardState: accruedState,
    savedAt,
  });
}

function toStoredRewardState(params: {
  readonly previousState: StoredRewardState;
  readonly rewardState: RewardState;
  readonly savedAt: string;
}): StoredRewardState {
  return {
    ...params.rewardState,
    anonymousHash: params.previousState.anonymousHash,
    lastSavedAt: params.savedAt,
  };
}

function sanitizeRewardState(rawValue: Record<string, unknown>, nowMs: number): RewardState {
  const fallbackState = createInitialRewardState(nowMs);

  return {
    stateDateKst: sanitizeString(rawValue.stateDateKst, getKstDateString(nowMs)),
    availableBoxCount: clampInteger(
      rawValue.availableBoxCount,
      0,
      SANSOKIM_POLICY.maxStoredBoxCount,
      fallbackState.availableBoxCount,
    ),
    dailyPaidTossPoint: clampInteger(
      rawValue.dailyPaidTossPoint,
      0,
      SANSOKIM_POLICY.maxDailyTossPoint,
      fallbackState.dailyPaidTossPoint,
    ),
    dailyBoostUsedCount: clampInteger(
      rawValue.dailyBoostUsedCount,
      0,
      SANSOKIM_POLICY.maxDailyBoostUseCount,
      fallbackState.dailyBoostUsedCount,
    ),
    attendedDatesKst: sanitizeAttendedDatesKst(
      rawValue.attendedDatesKst,
      sanitizeString(rawValue.stateDateKst, getKstDateString(nowMs)),
    ),
    lastAccruedAtMs: sanitizeFiniteNumber(rawValue.lastAccruedAtMs, nowMs),
    boostEndsAtMs: sanitizeNullableFiniteNumber(rawValue.boostEndsAtMs),
    accrualRemainderBoxUnits: clampNumber(
      rawValue.accrualRemainderBoxUnits,
      0,
      1,
      fallbackState.accrualRemainderBoxUnits,
    ),
    completedRewardKeys: sanitizeCompletedRewardKeys(rawValue.completedRewardKeys),
  };
}

function sanitizeCompletedRewardKeys(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((key): key is string => typeof key === "string" && key !== "")
    .slice(-SANSOKIM_POLICY.maxCompletedRewardKeyCount);
}

function sanitizeAttendedDatesKst(
  value: unknown,
  stateDateKst: string,
): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const stateYearMonth = stateDateKst.slice(0, 7);
  const uniqueDates = new Set(
    value.filter(
      (date): date is string =>
        typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        date.slice(0, 7) === stateYearMonth,
    ),
  );

  return [...uniqueDates].sort();
}

function createMockTossSuccessKey(params: {
  readonly opportunity: BoxOpenOpportunity;
}): string {
  return `sansokim:mock-toss-point:${params.opportunity.idempotencyKey}`;
}

function getBoxOpenBlockedMessage(
  reason: "emptyBox" | "dailyLimitReached" | "duplicateReward",
): string {
  switch (reason) {
    case "emptyBox":
      return "보유한 산소 상자가 없어요.";
    case "dailyLimitReached":
      return "오늘 받을 수 있는 토스 포인트를 모두 받았어요.";
    case "duplicateReward":
      return "이미 처리된 상자 열기예요.";
    default:
      return assertNever(reason);
  }
}

function getAttendanceBlockedMessage(
  reason: "alreadyAttended" | "boxStorageFull",
): string {
  switch (reason) {
    case "alreadyAttended":
      return "오늘은 이미 출석했어요.";
    case "boxStorageFull":
      return "보유 상자가 가득 차서 출석 보상을 받을 수 없어요.";
    default:
      return assertNever(reason);
  }
}

function getPromotionFailureMessage(reason: string): string {
  if (reason === "budgetExhausted") {
    return "본 프로모션은 예산 소진 등으로 중단될 수 있어요.";
  }

  return "토스 포인트 지급을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function sanitizeString(value: unknown, fallbackValue: string): string {
  return typeof value === "string" && value !== "" ? value : fallbackValue;
}

function sanitizeFiniteNumber(value: unknown, fallbackValue: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallbackValue;
}

function sanitizeNullableFiniteNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  return sanitizeFiniteNumber(value, 0);
}

function clampInteger(
  value: unknown,
  minValue: number,
  maxValue: number,
  fallbackValue: number,
): number {
  return Math.floor(clampNumber(value, minValue, maxValue, fallbackValue));
}

function clampNumber(
  value: unknown,
  minValue: number,
  maxValue: number,
  fallbackValue: number,
): number {
  const numberValue = sanitizeFiniteNumber(value, fallbackValue);

  return Math.min(maxValue, Math.max(minValue, numberValue));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
