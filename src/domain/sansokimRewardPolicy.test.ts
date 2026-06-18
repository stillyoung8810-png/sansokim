/// <reference types="jest" />

import { SANSOKIM_POLICY } from "./sansokimPolicy";
import {
  accrueBoxes,
  applyBoostAfterRewardAd,
  applyBoxOpenRewardSuccess,
  createInitialRewardState,
  getBoxOpenRewardDecision,
  rolloverDailyState,
  type RewardState,
} from "./sansokimRewardPolicy";

const HOUR_MS = 60 * 60 * 1_000;

function createRewardState(overrides: Partial<RewardState> = {}): RewardState {
  return {
    ...createInitialRewardState(0),
    ...overrides,
  };
}

describe("sansokimRewardPolicy", () => {
  it("creates an initial reward state with empty boxes and daily counters", () => {
    const state = createInitialRewardState(0);

    expect(state.availableBoxCount).toBe(0);
    expect(state.dailyPaidTossPoint).toBe(0);
    expect(state.dailyBoostUsedCount).toBe(0);
    expect(state.boostEndsAtMs).toBeNull();
    expect(state.completedRewardKeys).toEqual([]);
  });

  it("accrues one box after one hour", () => {
    const state = accrueBoxes(createInitialRewardState(0), HOUR_MS);

    expect(state.availableBoxCount).toBe(1);
    expect(state.accrualRemainderBoxUnits).toBe(0);
  });

  it("caps offline accrual at 100 hours", () => {
    const state = accrueBoxes(createInitialRewardState(0), 101 * HOUR_MS);

    expect(state.availableBoxCount).toBe(100);
  });

  it("does not store more than 200 boxes", () => {
    const state = accrueBoxes(
      createRewardState({ availableBoxCount: 199 }),
      10 * HOUR_MS,
    );

    expect(state.availableBoxCount).toBe(SANSOKIM_POLICY.maxStoredBoxCount);
    expect(state.accrualRemainderBoxUnits).toBe(0);
  });

  it("accrues boxes twice as fast while boost is active", () => {
    const boostResult = applyBoostAfterRewardAd(createInitialRewardState(0), 0);
    if (boostResult.type !== "applied") {
      throw new Error("Boost should be applied");
    }

    const state = accrueBoxes(boostResult.state, 2 * HOUR_MS);

    expect(state.availableBoxCount).toBe(4);
  });

  it("extends an active boost by another two hours", () => {
    const firstBoostResult = applyBoostAfterRewardAd(
      createInitialRewardState(0),
      0,
    );
    if (firstBoostResult.type !== "applied") {
      throw new Error("First boost should be applied");
    }

    const secondBoostResult = applyBoostAfterRewardAd(
      firstBoostResult.state,
      HOUR_MS,
    );

    expect(secondBoostResult.type).toBe("applied");
    if (secondBoostResult.type !== "applied") {
      throw new Error("Second boost should be applied");
    }
    expect(secondBoostResult.state.boostEndsAtMs).toBe(4 * HOUR_MS);
    expect(secondBoostResult.state.dailyBoostUsedCount).toBe(2);
  });

  it("blocks boost after the daily boost limit is reached", () => {
    const result = applyBoostAfterRewardAd(
      createRewardState({
        dailyBoostUsedCount: SANSOKIM_POLICY.maxDailyBoostUseCount,
      }),
      0,
    );

    expect(result).toEqual({
      type: "blocked",
      reason: "dailyLimitReached",
    });
  });

  it("resets daily paid points and boost count when the KST date changes", () => {
    const state = rolloverDailyState(
      createRewardState({
        stateDateKst: "2026-06-18",
        dailyPaidTossPoint: 50,
        dailyBoostUsedCount: 7,
      }),
      "2026-06-19",
    );

    expect(state.stateDateKst).toBe("2026-06-19");
    expect(state.dailyPaidTossPoint).toBe(0);
    expect(state.dailyBoostUsedCount).toBe(0);
  });

  it("blocks box open reward when there are no boxes", () => {
    const result = applyBoxOpenRewardSuccess({
      state: createRewardState({ availableBoxCount: 0 }),
      tossSuccessKey: "success-1",
    });

    expect(result.type).toBe("blocked");
    if (result.type !== "blocked") {
      throw new Error("Reward should be blocked");
    }
    expect(result.reason).toBe("emptyBox");
  });

  it("blocks box open reward when the daily point limit is reached", () => {
    const decision = getBoxOpenRewardDecision(
      createRewardState({
        availableBoxCount: 1,
        dailyPaidTossPoint: SANSOKIM_POLICY.maxDailyTossPoint,
      }),
    );

    expect(decision).toEqual({
      type: "blocked",
      reason: "dailyLimitReached",
    });
  });

  it("does not apply the same reward success key twice", () => {
    const originalState = createRewardState({
      availableBoxCount: 1,
      completedRewardKeys: ["success-1"],
    });
    const result = applyBoxOpenRewardSuccess({
      state: originalState,
      tossSuccessKey: "success-1",
    });

    expect(result).toEqual({
      type: "blocked",
      reason: "duplicateReward",
      state: originalState,
    });
  });

  it("keeps only the newest completed reward keys up to the policy limit", () => {
    const existingKeys = Array.from(
      { length: SANSOKIM_POLICY.maxCompletedRewardKeyCount },
      (_unused, index) => `success-${index}`,
    );
    const result = applyBoxOpenRewardSuccess({
      state: createRewardState({
        availableBoxCount: 1,
        completedRewardKeys: existingKeys,
      }),
      tossSuccessKey: "success-new",
    });

    expect(result.type).toBe("applied");
    if (result.type !== "applied") {
      throw new Error("Reward should be applied");
    }
    expect(result.state.completedRewardKeys).toHaveLength(
      SANSOKIM_POLICY.maxCompletedRewardKeyCount,
    );
    expect(result.state.completedRewardKeys[0]).toBe("success-1");
    expect(
      result.state.completedRewardKeys[
        SANSOKIM_POLICY.maxCompletedRewardKeyCount - 1
      ],
    ).toBe("success-new");
  });
});
