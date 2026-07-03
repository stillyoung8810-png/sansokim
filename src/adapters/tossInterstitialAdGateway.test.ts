/// <reference types="jest" />

jest.mock("@apps-in-toss/framework", () => ({
  loadFullScreenAd: Object.assign(jest.fn(), { isSupported: jest.fn() }),
  showFullScreenAd: Object.assign(jest.fn(), { isSupported: jest.fn() }),
}));

import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/framework";

import { SANSOKIM_ATTENDANCE_INTERSTITIAL_AD_GROUP_ID_PLACEHOLDER } from "../constants/sansokimInterstitialAds";
import {
  createTossInterstitialAdGateway,
  isInterstitialPlaceholderAdGroupId,
} from "./tossInterstitialAdGateway";

type FullScreenAdHandler = {
  readonly options: { readonly adGroupId: string };
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

describe("tossInterstitialAdGateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadFullScreenAdMock.isSupported.mockReturnValue(true);
    showFullScreenAdMock.isSupported.mockReturnValue(true);
  });

  it("skips loading while the attendance ad group ID is a placeholder", async () => {
    const gateway = createTossInterstitialAdGateway({
      adGroupIds: [SANSOKIM_ATTENDANCE_INTERSTITIAL_AD_GROUP_ID_PLACEHOLDER],
    });

    await expect(gateway.preloadNext()).resolves.toEqual({
      type: "skipped",
      reason: "placeholderAdGroupId",
    });

    expect(loadFullScreenAdMock).not.toHaveBeenCalled();
    expect(showFullScreenAdMock).not.toHaveBeenCalled();
  });

  it("identifies the configured placeholder ad group ID", () => {
    expect(
      isInterstitialPlaceholderAdGroupId(
        SANSOKIM_ATTENDANCE_INTERSTITIAL_AD_GROUP_ID_PLACEHOLDER,
      ),
    ).toBe(true);
    expect(isInterstitialPlaceholderAdGroupId("ait.v2.live.approved")).toBe(
      false,
    );
  });

  it("loads and shows an approved interstitial ad", async () => {
    const loadParamsRef: { current?: FullScreenAdHandler } = {};
    const showParamsRef: { current?: FullScreenAdHandler } = {};
    const unregisterLoad = jest.fn();
    const unregisterShow = jest.fn();
    loadFullScreenAdMock.mockImplementation((handler) => {
      loadParamsRef.current = handler;
      return unregisterLoad;
    });
    showFullScreenAdMock.mockImplementation((handler) => {
      showParamsRef.current = handler;
      return unregisterShow;
    });

    const gateway = createTossInterstitialAdGateway({
      adGroupIds: ["ait.v2.live.approved"],
    });
    const preloadPromise = gateway.preloadNext();
    const loadParams = loadParamsRef.current;
    if (loadParams == null) {
      throw new Error("loadFullScreenAd was not called");
    }
    loadParams.onEvent({ type: "loaded" });

    await expect(preloadPromise).resolves.toEqual({
      type: "loaded",
      adGroupId: "ait.v2.live.approved",
    });

    const showPromise = gateway.showPreloaded();
    const showParams = showParamsRef.current;
    if (showParams == null) {
      throw new Error("showFullScreenAd was not called");
    }
    showParams.onEvent({ type: "dismissed" });

    await expect(showPromise).resolves.toEqual({
      type: "dismissed",
      adGroupId: "ait.v2.live.approved",
    });
    expect(loadParams.options.adGroupId).toBe("ait.v2.live.approved");
    expect(showParams.options.adGroupId).toBe("ait.v2.live.approved");
    expect(unregisterLoad).toHaveBeenCalledTimes(1);
    expect(unregisterShow).toHaveBeenCalledTimes(1);
  });

  it("reuses an in-flight preload promise", async () => {
    const loadParamsRef: { current?: FullScreenAdHandler } = {};
    loadFullScreenAdMock.mockImplementation((handler) => {
      loadParamsRef.current = handler;
      return jest.fn();
    });
    const gateway = createTossInterstitialAdGateway({
      adGroupIds: ["ait.v2.live.approved"],
    });

    const firstPreload = gateway.preloadNext();
    const secondPreload = gateway.preloadNext();
    const loadParams = loadParamsRef.current;
    if (loadParams == null) {
      throw new Error("loadFullScreenAd was not called");
    }
    loadParams.onEvent({ type: "loaded" });

    expect(secondPreload).toBe(firstPreload);
    await expect(firstPreload).resolves.toEqual({
      type: "loaded",
      adGroupId: "ait.v2.live.approved",
    });
    expect(loadFullScreenAdMock).toHaveBeenCalledTimes(1);
  });

  it("does not call show before an ad is loaded", async () => {
    const gateway = createTossInterstitialAdGateway({
      adGroupIds: ["ait.v2.live.approved"],
    });

    await expect(gateway.showPreloaded()).resolves.toEqual({
      type: "failed",
      adGroupId: null,
    });
    expect(showFullScreenAdMock).not.toHaveBeenCalled();
  });
});
