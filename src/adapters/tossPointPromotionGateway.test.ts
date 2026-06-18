/// <reference types="jest" />

jest.mock("@apps-in-toss/framework", () => ({
  grantPromotionReward: jest.fn(),
}));

import { grantPromotionReward } from "@apps-in-toss/framework";

import {
  createTossPointPromotionGateway,
  toTossPointGrantResult,
} from "./tossPointPromotionGateway";

const grantPromotionRewardMock = grantPromotionReward as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>;

describe("tossPointPromotionGateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes success key results", () => {
    expect(toTossPointGrantResult({ key: "key-1" })).toEqual({
      type: "success",
      tossSuccessKey: "key-1",
    });
    expect(toTossPointGrantResult({ successKey: "key-2" })).toEqual({
      type: "success",
      tossSuccessKey: "key-2",
    });
  });

  it("normalizes budget exhausted error codes", () => {
    expect(toTossPointGrantResult({ errorCode: "4109" })).toEqual({
      type: "failed",
      reason: "budgetExhausted",
    });
    expect(toTossPointGrantResult({ errorCode: "4112" })).toEqual({
      type: "failed",
      reason: "budgetExhausted",
    });
  });

  it("normalizes promotion errors and ambiguous results", () => {
    expect(toTossPointGrantResult({ errorCode: "4000" })).toEqual({
      type: "failed",
      reason: "promotionError",
    });
    expect(toTossPointGrantResult("ERROR")).toEqual({
      type: "failed",
      reason: "ambiguousUnknown",
    });
    expect(toTossPointGrantResult(undefined)).toEqual({
      type: "failed",
      reason: "unsupportedVersion",
    });
  });

  it("calls grantPromotionReward for a one-point payout", async () => {
    grantPromotionRewardMock.mockResolvedValue({ key: "success-1" });
    const gateway = createTossPointPromotionGateway({
      promotionCode: "TEST_CODE",
    });

    await expect(gateway.grantTossPoint(1)).resolves.toEqual({
      type: "success",
      tossSuccessKey: "success-1",
    });
    expect(grantPromotionRewardMock).toHaveBeenCalledWith({
      params: {
        promotionCode: "TEST_CODE",
        amount: 1,
      },
    });
  });

  it("blocks non-policy payout amounts before calling the SDK", async () => {
    const gateway = createTossPointPromotionGateway({
      promotionCode: "TEST_CODE",
    });

    await expect(gateway.grantTossPoint(2)).resolves.toEqual({
      type: "failed",
      reason: "promotionError",
    });
    expect(grantPromotionRewardMock).not.toHaveBeenCalled();
  });
});
