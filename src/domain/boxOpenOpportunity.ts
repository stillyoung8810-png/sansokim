import { SANSOKIM_POLICY } from "./sansokimPolicy";

const BOX_OPEN_OPPORTUNITY_EXPIRES_IN_MS = 24 * 60 * 60 * 1_000;

export type BoxOpenOpportunity = {
  readonly anonymousHash: string;
  readonly idempotencyKey: string;
  readonly earnedAtMs: number;
  readonly expiresAtMs: number;
};

export type BoxOpenTapState = {
  readonly validTapCount: number;
  readonly firstTapAtMs: number | null;
  readonly lastAcceptedTapAtMs: number | null;
};

export type BoxOpenTapResult =
  | { readonly type: "accepted"; readonly state: BoxOpenTapState }
  | {
      readonly type: "ignored";
      readonly reason: "tooFast";
      readonly state: BoxOpenTapState;
    }
  | { readonly type: "expired"; readonly state: BoxOpenTapState }
  | { readonly type: "completed"; readonly state: BoxOpenTapState };

export function createInitialBoxOpenTapState(): BoxOpenTapState {
  return {
    validTapCount: 0,
    firstTapAtMs: null,
    lastAcceptedTapAtMs: null,
  };
}

export function applyBoxTap(
  state: BoxOpenTapState,
  tappedAtMs: number,
): BoxOpenTapResult {
  if (!Number.isFinite(tappedAtMs)) {
    return { type: "ignored", reason: "tooFast", state };
  }

  const resetState = createInitialBoxOpenTapState();
  const hasStarted = state.firstTapAtMs != null;

  if (
    hasStarted &&
    tappedAtMs - state.firstTapAtMs >=
      SANSOKIM_POLICY.boxTapSessionExpiresInMs
  ) {
    return {
      type: "expired",
      state: {
        ...resetState,
        validTapCount: 1,
        firstTapAtMs: tappedAtMs,
        lastAcceptedTapAtMs: tappedAtMs,
      },
    };
  }

  if (
    state.lastAcceptedTapAtMs != null &&
    tappedAtMs - state.lastAcceptedTapAtMs <
      SANSOKIM_POLICY.boxTapMinIntervalMs
  ) {
    return { type: "ignored", reason: "tooFast", state };
  }

  const nextTapCount = state.validTapCount + 1;
  const nextState = {
    validTapCount: nextTapCount,
    firstTapAtMs: state.firstTapAtMs ?? tappedAtMs,
    lastAcceptedTapAtMs: tappedAtMs,
  };

  if (nextTapCount >= SANSOKIM_POLICY.boxTapRequiredCount) {
    return { type: "completed", state: resetState };
  }

  return { type: "accepted", state: nextState };
}

export function createBoxOpenOpportunity(params: {
  readonly anonymousHash: string;
  readonly nowMs: number;
}): BoxOpenOpportunity {
  return {
    anonymousHash: params.anonymousHash,
    idempotencyKey: `sansokim:box-open:${params.anonymousHash}:${params.nowMs}`,
    earnedAtMs: params.nowMs,
    expiresAtMs: params.nowMs + BOX_OPEN_OPPORTUNITY_EXPIRES_IN_MS,
  };
}

export function isBoxOpenOpportunityExpired(
  opportunity: BoxOpenOpportunity,
  nowMs: number,
): boolean {
  return !Number.isFinite(nowMs) || opportunity.expiresAtMs <= nowMs;
}

export function getActiveBoxOpenOpportunity(
  opportunity: BoxOpenOpportunity | null,
  nowMs: number,
): BoxOpenOpportunity | null {
  if (opportunity == null) {
    return null;
  }

  if (isBoxOpenOpportunityExpired(opportunity, nowMs)) {
    return null;
  }

  return opportunity;
}
