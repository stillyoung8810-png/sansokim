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
  readonly options?: { readonly adGroupId: string };
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

  it("preloads then shows a rewarded ad successfully", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "loaded" });
      return jest.fn();
    });
    showFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "userEarnedReward" });
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway("ad-group-1");

    await expect(gateway.preloadNext()).resolves.toEqual({ type: "loaded" });
    await expect(gateway.showPreloaded()).resolves.toEqual({
      type: "earnedReward",
    });
  });

  it("rotates rewarded ad group ids after earned rewards", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "loaded" });
      return jest.fn();
    });
    showFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "userEarnedReward" });
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway(["ad-group-1", "ad-group-2"]);

    await expect(gateway.preloadNext()).resolves.toEqual({ type: "loaded" });
    expect(getLoadedAdGroupId(0)).toBe("ad-group-1");
    await expect(gateway.showPreloaded()).resolves.toEqual({
      type: "earnedReward",
    });

    await expect(gateway.preloadNext()).resolves.toEqual({ type: "loaded" });
    expect(getLoadedAdGroupId(1)).toBe("ad-group-2");
    await expect(gateway.showPreloaded()).resolves.toEqual({
      type: "earnedReward",
    });

    await expect(gateway.preloadNext()).resolves.toEqual({ type: "loaded" });
    expect(getLoadedAdGroupId(2)).toBe("ad-group-1");
  });

  it("reuses an in-flight reward ad load", async () => {
    const loadHandlerRef: { current?: FullScreenAdHandler } = {};
    loadFullScreenAdMock.mockImplementation((handler) => {
      loadHandlerRef.current = handler;
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway("ad-group-1");

    const firstLoad = gateway.preloadNext();
    const secondLoad = gateway.preloadNext();

    expect(loadFullScreenAdMock).toHaveBeenCalledTimes(1);
    const loadHandler = loadHandlerRef.current;
    if (loadHandler == null) {
      throw new Error("loadFullScreenAd was not called");
    }
    loadHandler.onEvent({ type: "loaded" });

    await expect(firstLoad).resolves.toEqual({ type: "loaded" });
    await expect(secondLoad).resolves.toEqual({ type: "loaded" });
    await expect(gateway.preloadNext()).resolves.toEqual({ type: "loaded" });
    expect(loadFullScreenAdMock).toHaveBeenCalledTimes(1);
  });

  it("does not show before a rewarded ad is loaded", async () => {
    const gateway = createTossRewardAdGateway("ad-group-1");

    await expect(gateway.showPreloaded()).resolves.toEqual({ type: "failed" });
    expect(showFullScreenAdMock).not.toHaveBeenCalled();
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

    await gateway.preloadNext();
    await expect(gateway.showPreloaded()).resolves.toEqual({
      type: "dismissed",
    });
  });

  it("keeps the current rewarded ad group id when the ad is dismissed", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "loaded" });
      return jest.fn();
    });
    showFullScreenAdMock.mockImplementation((handler) => {
      handler.onEvent({ type: "dismissed" });
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway(["ad-group-1", "ad-group-2"]);

    await expect(gateway.preloadNext()).resolves.toEqual({ type: "loaded" });
    expect(getLoadedAdGroupId(0)).toBe("ad-group-1");
    await expect(gateway.showPreloaded()).resolves.toEqual({
      type: "dismissed",
    });

    await expect(gateway.preloadNext()).resolves.toEqual({ type: "loaded" });
    expect(getLoadedAdGroupId(1)).toBe("ad-group-1");
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

    await gateway.preloadNext();
    await expect(gateway.showPreloaded()).resolves.toEqual({ type: "failed" });
  });

  it("fails when loading errors", async () => {
    loadFullScreenAdMock.mockImplementation((handler) => {
      handler.onError();
      return jest.fn();
    });
    const gateway = createTossRewardAdGateway("ad-group-1");

    await expect(gateway.preloadNext()).resolves.toEqual({ type: "failed" });
    await expect(gateway.showPreloaded()).resolves.toEqual({ type: "failed" });
  });
});

function getLoadedAdGroupId(callIndex: number): string {
  const params = loadFullScreenAdMock.mock.calls[callIndex]?.[0];
  const adGroupId = params?.options?.adGroupId;

  if (adGroupId == null) {
    throw new Error("loadFullScreenAd was not called with an ad group id");
  }

  return adGroupId;
}
