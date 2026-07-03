/// <reference types="jest" />

import { SANSOKIM_POLICY } from "./sansokimPolicy";
import {
  accrueBoxes,
  applyAttendanceBoxReward,
  applyBoostAfterRewardAd,
  applyBoxOpenRewardSuccess,
  createInitialRewardState,
  getBoxOpenRewardDecision,
  getNextBoxAccrualProgress,
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
    expect(state.attendedDatesKst).toEqual([]);
    expect(state.boostEndsAtMs).toBeNull();
    expect(state.completedRewardKeys).toEqual([]);
  });

  it("accrues one box after one hour", () => {
    const state = accrueBoxes(createInitialRewardState(0), HOUR_MS);

    expect(state.availableBoxCount).toBe(1);
    expect(state.accrualRemainderBoxUnits).toBe(0);
  });

  it("returns next box accrual progress from elapsed time", () => {
    expect(getNextBoxAccrualProgress(createInitialRewardState(0), 0)).toBe(0);

    const halfHourState = accrueBoxes(
      createInitialRewardState(0),
      HOUR_MS / 2,
    );
    expect(getNextBoxAccrualProgress(halfHourState, HOUR_MS / 2)).toBe(0.5);

    const almostOneHourState = accrueBoxes(
      createInitialRewardState(0),
      HOUR_MS - 1,
    );
    expect(
      getNextBoxAccrualProgress(almostOneHourState, HOUR_MS - 1),
    ).toBeCloseTo(1, 5);

    const oneHourState = accrueBoxes(createInitialRewardState(0), HOUR_MS);
    expect(getNextBoxAccrualProgress(oneHourState, HOUR_MS)).toBe(0);
  });

  it("returns full progress when box storage is full", () => {
    expect(
      getNextBoxAccrualProgress(
        createRewardState({
          availableBoxCount: SANSOKIM_POLICY.maxStoredBoxCount,
        }),
        0,
      ),
    ).toBe(1);
  });

  it("accrues next box progress twice as fast while boost is active", () => {
    const boostResult = applyBoostAfterRewardAd(createInitialRewardState(0), 0);
    if (boostResult.type !== "applied") {
      throw new Error("Boost should be applied");
    }

    const boostedState = accrueBoxes(boostResult.state, HOUR_MS / 4);
    expect(getNextBoxAccrualProgress(boostedState, HOUR_MS / 4)).toBe(0.5);
  });

  it("caps offline accrual at 100 hours", () => {
    const state = accrueBoxes(createInitialRewardState(0), 101 * HOUR_MS);

    expect(state.availableBoxCount).toBe(100);
  });

  it("does not store more than the policy max box count", () => {
    const state = accrueBoxes(
      createRewardState({ availableBoxCount: 999 }),
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
        attendedDatesKst: ["2026-06-18"],
      }),
      "2026-06-19",
    );

    expect(state.stateDateKst).toBe("2026-06-19");
    expect(state.dailyPaidTossPoint).toBe(0);
    expect(state.dailyBoostUsedCount).toBe(0);
    expect(state.attendedDatesKst).toEqual(["2026-06-18"]);
  });

  it("resets attendance dates when the KST month changes", () => {
    const state = rolloverDailyState(
      createRewardState({
        stateDateKst: "2026-06-30",
        attendedDatesKst: ["2026-06-30"],
      }),
      "2026-07-01",
    );

    expect(state.attendedDatesKst).toEqual([]);
  });

  it("grants one box and marks attendance once per KST day", () => {
    const result = applyAttendanceBoxReward(createRewardState(), 0);

    expect(result.type).toBe("applied");
    if (result.type !== "applied") {
      throw new Error("Attendance should be applied");
    }
    expect(result.state.availableBoxCount).toBe(1);
    expect(result.state.attendedDatesKst).toEqual(["1970-01-01"]);
  });

  it("blocks duplicate attendance without adding boxes", () => {
    const result = applyAttendanceBoxReward(
      createRewardState({
        availableBoxCount: 3,
        attendedDatesKst: ["1970-01-01"],
      }),
      0,
    );

    expect(result.type).toBe("blocked");
    if (result.type !== "blocked") {
      throw new Error("Attendance should be blocked");
    }
    expect(result.reason).toBe("alreadyAttended");
    expect(result.state.availableBoxCount).toBe(3);
    expect(result.state.attendedDatesKst).toEqual(["1970-01-01"]);
  });

  it("blocks attendance when box storage is full without marking attendance", () => {
    const result = applyAttendanceBoxReward(
      createRewardState({
        availableBoxCount: SANSOKIM_POLICY.maxStoredBoxCount,
      }),
      0,
    );

    expect(result.type).toBe("blocked");
    if (result.type !== "blocked") {
      throw new Error("Attendance should be blocked");
    }
    expect(result.reason).toBe("boxStorageFull");
    expect(result.state.availableBoxCount).toBe(SANSOKIM_POLICY.maxStoredBoxCount);
    expect(result.state.attendedDatesKst).toEqual([]);
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
