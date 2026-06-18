/// <reference types="jest" />

import { createBoxOpenOpportunity } from "./domain/boxOpenOpportunity";
import { SANSOKIM_POLICY } from "./domain/sansokimPolicy";
import {
  applyMockBoost,
  createInitialRewardAppState,
  createInitialStoredRewardState,
  finishBoostRequestWithGateway,
  finishBoxOpenOpportunityRequestWithGateway,
  grantMockBoxOpenOpportunity,
  restoreRewardAppState,
  startBoostRequest,
  startBoxOpenOpportunityRequest,
  tapBoxForPayoutWithGateway,
  tapBoxForMockPayout,
  type RewardAppState,
} from "./rewardApp";

function createReadyState(params: {
  readonly nowMs?: number;
  readonly availableBoxCount?: number;
  readonly dailyPaidTossPoint?: number;
  readonly hasOpportunity?: boolean;
}): RewardAppState {
  const nowMs = params.nowMs ?? 0;
  const rewardState = {
    ...createInitialStoredRewardState({ nowMs }),
    availableBoxCount: params.availableBoxCount ?? 0,
    dailyPaidTossPoint: params.dailyPaidTossPoint ?? 0,
  };

  return createInitialRewardAppState({
    rewardState,
    boxOpenOpportunity:
      params.hasOpportunity === true
        ? createBoxOpenOpportunity({
            anonymousHash: rewardState.anonymousHash,
            nowMs,
          })
        : null,
  });
}

function tapFourTimes(state: RewardAppState): ReturnType<typeof tapBoxForMockPayout> {
  const firstTap = tapBoxForMockPayout(state, 0);
  const secondTap = tapBoxForMockPayout(firstTap.state, 300);
  const thirdTap = tapBoxForMockPayout(secondTap.state, 600);

  return tapBoxForMockPayout(thirdTap.state, 900);
}

async function tapFourTimesWithGateway(
  state: RewardAppState,
  promotionGateway: {
    readonly grantTossPoint: (
      amount: number,
    ) => Promise<
      | { readonly type: "success"; readonly tossSuccessKey: string }
      | { readonly type: "failed"; readonly reason: string }
    >;
  },
): Promise<Awaited<ReturnType<typeof tapBoxForPayoutWithGateway>>> {
  const firstTap = await tapBoxForPayoutWithGateway({
    state,
    promotionGateway,
    tappedAtMs: 0,
  });
  const secondTap = await tapBoxForPayoutWithGateway({
    state: firstTap.state,
    promotionGateway,
    tappedAtMs: 300,
  });
  const thirdTap = await tapBoxForPayoutWithGateway({
    state: secondTap.state,
    promotionGateway,
    tappedAtMs: 600,
  });

  return tapBoxForPayoutWithGateway({
    state: thirdTap.state,
    promotionGateway,
    tappedAtMs: 900,
  });
}

function createRewardAdGateway(params: {
  readonly loadType?: "loaded" | "failed";
  readonly showType?: "earnedReward" | "dismissed" | "failed";
}) {
  return {
    load: jest.fn(async () => ({ type: params.loadType ?? "loaded" }) as const),
    show: jest.fn(async () => ({ type: params.showType ?? "earnedReward" }) as const),
  };
}

function createPromotionGateway(
  result:
    | { readonly type: "success"; readonly tossSuccessKey: string }
    | { readonly type: "failed"; readonly reason: string },
) {
  return {
    grantTossPoint: jest.fn(async () => result),
  };
}

describe("rewardApp", () => {
  it("creates an initial state when storage is empty", () => {
    const state = restoreRewardAppState({
      rawRewardState: null,
      rawBoxOpenOpportunity: null,
      nowMs: 0,
    });

    expect(state.restoreStatus).toBe("ready");
    expect(state.rewardState.anonymousHash).toBe("mock-sansokim-user");
    expect(state.rewardState.availableBoxCount).toBe(0);
    expect(state.rewardState.dailyPaidTossPoint).toBe(0);
    expect(state.boxOpenOpportunity).toBeNull();
  });

  it("grants a mock box open opportunity", () => {
    const result = grantMockBoxOpenOpportunity(createReadyState({}), 1_000);

    expect(result.type).toBe("granted");
    expect(result.state.boxOpenOpportunity).toMatchObject({
      anonymousHash: "mock-sansokim-user",
      idempotencyKey: "sansokim:box-open:mock-sansokim-user:1000",
      earnedAtMs: 1_000,
    });
  });

  it("applies a mock two-hour boost", () => {
    const result = applyMockBoost(createReadyState({}), 1_000);

    expect(result.type).toBe("applied");
    expect(result.state.rewardState.dailyBoostUsedCount).toBe(1);
    expect(result.state.rewardState.boostEndsAtMs).toBe(
      1_000 + SANSOKIM_POLICY.boostDurationMs,
    );
  });

  it("applies payout after four box taps and consumes only after success", () => {
    const state = createReadyState({
      availableBoxCount: 1,
      hasOpportunity: true,
    });
    const result = tapFourTimes(state);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.rewardResult).toEqual({ type: "success" });
    expect(result.state.rewardState.availableBoxCount).toBe(0);
    expect(result.state.rewardState.dailyPaidTossPoint).toBe(1);
    expect(result.state.boxOpenOpportunity).toBeNull();
  });

  it("keeps boxes and opportunity when payout is blocked by empty boxes", () => {
    const state = createReadyState({
      availableBoxCount: 0,
      hasOpportunity: true,
    });
    const result = tapFourTimes(state);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.rewardResult).toEqual({
      type: "blocked",
      reason: "emptyBox",
    });
    expect(result.state.rewardState.availableBoxCount).toBe(0);
    expect(result.state.boxOpenOpportunity).toEqual(state.boxOpenOpportunity);
  });

  it("blocks payout at the daily point limit without consuming opportunity", () => {
    const state = createReadyState({
      availableBoxCount: 1,
      dailyPaidTossPoint: SANSOKIM_POLICY.maxDailyTossPoint,
      hasOpportunity: true,
    });
    const result = tapFourTimes(state);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.rewardResult).toEqual({
      type: "blocked",
      reason: "dailyLimitReached",
    });
    expect(result.state.rewardState.availableBoxCount).toBe(1);
    expect(result.state.boxOpenOpportunity).toEqual(state.boxOpenOpportunity);
  });

  it("keeps opportunity state unchanged when reward ad loading fails", async () => {
    const startResult = startBoxOpenOpportunityRequest(createReadyState({}), 0);
    if (startResult.type !== "started") {
      throw new Error("Request should start");
    }
    const result = await finishBoxOpenOpportunityRequestWithGateway({
      state: startResult.state,
      rewardAdGateway: createRewardAdGateway({ loadType: "failed" }),
      nowMs: 0,
    });

    expect(result.type).toBe("failed");
    expect(result.state.boxOpenOpportunity).toBeNull();
    expect(result.state.isBoxOpenOpportunityRequesting).toBe(false);
  });

  it("does not apply boost when reward ad is not completed", async () => {
    const startResult = startBoostRequest(createReadyState({}), 0);
    if (startResult.type !== "started") {
      throw new Error("Boost request should start");
    }
    const result = await finishBoostRequestWithGateway({
      state: startResult.state,
      rewardAdGateway: createRewardAdGateway({ showType: "dismissed" }),
      nowMs: 0,
    });

    expect(result.type).toBe("failed");
    expect(result.state.rewardState.dailyBoostUsedCount).toBe(0);
    expect(result.state.rewardState.boostEndsAtMs).toBeNull();
    expect(result.state.isBoostRequesting).toBe(false);
  });

  it("keeps boxes and opportunity when promotion payout fails", async () => {
    const state = createReadyState({
      availableBoxCount: 1,
      hasOpportunity: true,
    });
    const promotionGateway = createPromotionGateway({
      type: "failed",
      reason: "promotionError",
    });
    const result = await tapFourTimesWithGateway(state, promotionGateway);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.rewardResult).toEqual({
      type: "blocked",
      reason: "promotionFailed",
    });
    expect(result.state.rewardState.availableBoxCount).toBe(1);
    expect(result.state.rewardState.dailyPaidTossPoint).toBe(0);
    expect(result.state.boxOpenOpportunity).toEqual(state.boxOpenOpportunity);
  });

  it("shows a budget exhausted message without consuming boxes or opportunity", async () => {
    const state = createReadyState({
      availableBoxCount: 1,
      hasOpportunity: true,
    });
    const promotionGateway = createPromotionGateway({
      type: "failed",
      reason: "budgetExhausted",
    });
    const result = await tapFourTimesWithGateway(state, promotionGateway);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.state.bannerMessage).toBe(
      "본 프로모션은 예산 소진 등으로 중단될 수 있어요.",
    );
    expect(result.state.rewardState.availableBoxCount).toBe(1);
    expect(result.state.boxOpenOpportunity).toEqual(state.boxOpenOpportunity);
  });

  it("does not call promotion gateway when there are no boxes", async () => {
    const state = createReadyState({
      availableBoxCount: 0,
      hasOpportunity: true,
    });
    const promotionGateway = createPromotionGateway({
      type: "success",
      tossSuccessKey: "success-1",
    });
    const result = await tapFourTimesWithGateway(state, promotionGateway);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.rewardResult).toEqual({
      type: "blocked",
      reason: "emptyBox",
    });
    expect(promotionGateway.grantTossPoint).not.toHaveBeenCalled();
    expect(result.state.rewardState.availableBoxCount).toBe(0);
    expect(result.state.boxOpenOpportunity).toEqual(state.boxOpenOpportunity);
  });

  it("does not call promotion gateway when the daily limit is reached", async () => {
    const state = createReadyState({
      availableBoxCount: 1,
      dailyPaidTossPoint: SANSOKIM_POLICY.maxDailyTossPoint,
      hasOpportunity: true,
    });
    const promotionGateway = createPromotionGateway({
      type: "success",
      tossSuccessKey: "success-1",
    });
    const result = await tapFourTimesWithGateway(state, promotionGateway);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.rewardResult).toEqual({
      type: "blocked",
      reason: "dailyLimitReached",
    });
    expect(promotionGateway.grantTossPoint).not.toHaveBeenCalled();
    expect(result.state.rewardState.availableBoxCount).toBe(1);
    expect(result.state.boxOpenOpportunity).toEqual(state.boxOpenOpportunity);
  });

  it("does not call promotion gateway when there is no box open opportunity", async () => {
    const state = createReadyState({
      availableBoxCount: 1,
      hasOpportunity: false,
    });
    const promotionGateway = createPromotionGateway({
      type: "success",
      tossSuccessKey: "success-1",
    });
    const result = await tapFourTimesWithGateway(state, promotionGateway);

    expect(result.type).toBe("accepted");
    expect(promotionGateway.grantTossPoint).not.toHaveBeenCalled();
    expect(result.state.rewardState.availableBoxCount).toBe(1);
    expect(result.state.boxOpenOpportunity).toBeNull();
  });

  it("consumes a box and opportunity only when promotion payout succeeds", async () => {
    const state = createReadyState({
      availableBoxCount: 1,
      hasOpportunity: true,
    });
    const promotionGateway = createPromotionGateway({
      type: "success",
      tossSuccessKey: "success-1",
    });
    const result = await tapFourTimesWithGateway(state, promotionGateway);

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Box open should be completed");
    }
    expect(result.rewardResult).toEqual({ type: "success" });
    expect(result.state.rewardState.availableBoxCount).toBe(0);
    expect(result.state.rewardState.dailyPaidTossPoint).toBe(1);
    expect(result.state.boxOpenOpportunity).toBeNull();
  });

  it("blocks duplicate payout calls while crediting is in progress", async () => {
    const state = {
      ...createReadyState({
        availableBoxCount: 1,
        hasOpportunity: true,
      }),
      isBoxOpenCrediting: true,
    };
    const promotionGateway = createPromotionGateway({
      type: "success",
      tossSuccessKey: "success-1",
    });
    const result = await tapBoxForPayoutWithGateway({
      state,
      promotionGateway,
      tappedAtMs: 0,
    });

    expect(result.type).toBe("completed");
    if (result.type !== "completed") {
      throw new Error("Duplicate payout should be blocked");
    }
    expect(result.rewardResult).toEqual({
      type: "blocked",
      reason: "busy",
    });
    expect(promotionGateway.grantTossPoint).not.toHaveBeenCalled();
  });
});
