/// <reference types="jest" />

jest.mock("@apps-in-toss/framework", () => ({
  loadFullScreenAd: Object.assign(jest.fn(), { isSupported: jest.fn() }),
  showFullScreenAd: Object.assign(jest.fn(), { isSupported: jest.fn() }),
}));

import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/framework";

import {
  createTossRewardAdGateway,
  toRewardedAdResult,
} from "./tossRewardAdGateway";

type FullScreenAdHandler = {
  readonly onEvent: (event: { readonly type: string }) => void;
  readonly onError: () => void;
};

const loadFullScreenAdMock = loadFullScreenAd as unknown as jest.MockedFunction<
  (handler: FullScreenAdHandler) => () => void
> & {
  readonly isSupported: jest.Mock<boolean, []>;
};
const showFullScreenAdMock = showFullScreenAd as unknown as jest.MockedFunction<
  (handler: FullScreenAdHandler) => () => void
> & {
  readonly isSupported: jest.Mock<boolean, []>;
};

describe("tossRewardAdGateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadFullScreenAdMock.isSupported.mockReturnValue(true);
    showFullScreenAdMock.isSupported.mockReturnValue(true);
  });

  it("maps only userEarnedReward to earnedReward", () => {
    expect(toRewardedAdResult({ type: "userEarnedReward" })).toEqual({
      type: "earnedReward",
    });
    expect(toRewardedAdResult({ type: "dismissed" })).toEqual({
      type: "dismissed",
    });
    expect(toRewardedAdResult({ type: "failedToShow" })).toEqual({
      type: "failed",
    });
  });

  it("loads then shows a rewarded ad successfully", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "loaded" });
      return jest.fn();
    });
    showFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "userEarnedReward" });
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway("ad-group-1");

    await expect(gateway.load()).resolves.toEqual({ type: "loaded" });
    await expect(gateway.show()).resolves.toEqual({ type: "earnedReward" });
  });

  it("treats dismissed ads as non-success", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "loaded" });
      return jest.fn();
    });
    showFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "dismissed" });
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway("ad-group-1");

    await gateway.load();
    await expect(gateway.show()).resolves.toEqual({ type: "dismissed" });
  });

  it("treats failedToShow as failed", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "loaded" });
      return jest.fn();
    });
    showFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "failedToShow" });
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway("ad-group-1");

    await gateway.load();
    await expect(gateway.show()).resolves.toEqual({ type: "failed" });
  });

  it("fails when loading errors", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onError();
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway("ad-group-1");

    await expect(gateway.load()).resolves.toEqual({ type: "failed" });
    await expect(gateway.show()).resolves.toEqual({ type: "failed" });
  });
});
