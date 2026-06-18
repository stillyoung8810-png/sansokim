/// <reference types="jest" />

import {
  applyBoxTap,
  createBoxOpenOpportunity,
  createInitialBoxOpenTapState,
  getActiveBoxOpenOpportunity,
} from "./boxOpenOpportunity";

describe("boxOpenOpportunity", () => {
  it("returns completed only after four accepted taps", () => {
    const firstResult = applyBoxTap(createInitialBoxOpenTapState(), 0);
    expect(firstResult.type).toBe("accepted");
    if (firstResult.type !== "accepted") {
      throw new Error("First tap should be accepted");
    }

    const secondResult = applyBoxTap(firstResult.state, 300);
    expect(secondResult.type).toBe("accepted");
    if (secondResult.type !== "accepted") {
      throw new Error("Second tap should be accepted");
    }

    const thirdResult = applyBoxTap(secondResult.state, 600);
    expect(thirdResult.type).toBe("accepted");
    if (thirdResult.type !== "accepted") {
      throw new Error("Third tap should be accepted");
    }

    const fourthResult = applyBoxTap(thirdResult.state, 900);

    expect(fourthResult).toEqual({
      type: "completed",
      state: createInitialBoxOpenTapState(),
    });
  });

  it("ignores taps that are too fast", () => {
    const firstResult = applyBoxTap(createInitialBoxOpenTapState(), 0);
    if (firstResult.type !== "accepted") {
      throw new Error("First tap should be accepted");
    }

    const secondResult = applyBoxTap(firstResult.state, 299);

    expect(secondResult).toEqual({
      type: "ignored",
      reason: "tooFast",
      state: firstResult.state,
    });
  });

  it("starts a new tap session after ten seconds", () => {
    const firstResult = applyBoxTap(createInitialBoxOpenTapState(), 0);
    if (firstResult.type !== "accepted") {
      throw new Error("First tap should be accepted");
    }

    const secondResult = applyBoxTap(firstResult.state, 10_000);

    expect(secondResult).toEqual({
      type: "expired",
      state: {
        validTapCount: 1,
        firstTapAtMs: 10_000,
        lastAcceptedTapAtMs: 10_000,
      },
    });
  });

  it("creates a box open opportunity with a stable idempotency key", () => {
    const opportunity = createBoxOpenOpportunity({
      anonymousHash: "hash-1",
      nowMs: 1_000,
    });

    expect(opportunity).toEqual({
      anonymousHash: "hash-1",
      idempotencyKey: "sansokim:box-open:hash-1:1000",
      earnedAtMs: 1_000,
      expiresAtMs: 24 * 60 * 60 * 1_000 + 1_000,
    });
  });

  it("returns null for expired box open opportunities", () => {
    const opportunity = createBoxOpenOpportunity({
      anonymousHash: "hash-1",
      nowMs: 1_000,
    });

    expect(getActiveBoxOpenOpportunity(opportunity, opportunity.expiresAtMs)).toBeNull();
  });
});
