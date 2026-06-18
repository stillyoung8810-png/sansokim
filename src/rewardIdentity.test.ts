/// <reference types="jest" />

jest.mock("@apps-in-toss/framework", () => ({
  getAnonymousKey: jest.fn(),
}));

import {
  getCurrentAnonymousKeyResult,
  toAnonymousKeyResult,
} from "./rewardIdentity";

describe("rewardIdentity", () => {
  it("normalizes HASH result to success", () => {
    expect(toAnonymousKeyResult({ type: "HASH", hash: "hash-1" })).toEqual({
      type: "success",
      hash: "hash-1",
    });
  });

  it("normalizes invalid category result", () => {
    expect(toAnonymousKeyResult("INVALID_CATEGORY")).toEqual({
      type: "unavailable",
      reason: "invalidCategory",
    });
  });

  it("normalizes ERROR result", () => {
    expect(toAnonymousKeyResult("ERROR")).toEqual({
      type: "unavailable",
      reason: "error",
    });
  });

  it("normalizes undefined result to unsupportedVersion", () => {
    expect(toAnonymousKeyResult(undefined)).toEqual({
      type: "unavailable",
      reason: "unsupportedVersion",
    });
  });

  it("normalizes unexpected values to unknownError", () => {
    expect(toAnonymousKeyResult({ type: "OTHER" })).toEqual({
      type: "unavailable",
      reason: "unknownError",
    });
  });

  it("returns unknownError when the gateway throws", async () => {
    await expect(
      getCurrentAnonymousKeyResult(async () => {
        throw new Error("failed");
      }),
    ).resolves.toEqual({
      type: "unavailable",
      reason: "unknownError",
    });
  });
});
