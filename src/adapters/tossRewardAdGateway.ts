import {
  loadFullScreenAd,
  showFullScreenAd,
  type ShowFullScreenAdEvent,
} from "@apps-in-toss/framework";

export type RewardAdLoadResult =
  | { readonly type: "loaded" }
  | { readonly type: "failed" };

export type RewardedAdResult =
  | { readonly type: "earnedReward" }
  | { readonly type: "dismissed" }
  | { readonly type: "failed" };

export type RewardAdGateway = {
  readonly load: () => Promise<RewardAdLoadResult>;
  readonly show: () => Promise<RewardedAdResult>;
};

export function createTossRewardAdGateway(adGroupId: string): RewardAdGateway {
  let loadedAdGroupId: string | null = null;
  let loadingPromise: Promise<RewardAdLoadResult> | null = null;

  return {
    async load(): Promise<RewardAdLoadResult> {
      if (loadedAdGroupId != null) {
        return { type: "loaded" };
      }

      if (loadingPromise != null) {
        return loadingPromise;
      }

      loadingPromise = loadTossRewardAd(adGroupId)
        .then((result) => {
          loadedAdGroupId = result.type === "loaded" ? adGroupId : null;

          return result;
        })
        .finally(() => {
          loadingPromise = null;
        });

      return loadingPromise;
    },
    async show(): Promise<RewardedAdResult> {
      if (loadedAdGroupId == null) {
        return { type: "failed" };
      }

      const currentAdGroupId = loadedAdGroupId;
      loadedAdGroupId = null;

      return showTossRewardAd(currentAdGroupId);
    },
  };
}

function loadTossRewardAd(adGroupId: string): Promise<RewardAdLoadResult> {
  return new Promise((resolve) => {
    let isSettled = false;
    let unregister: () => void = () => undefined;
    const settle = (result: RewardAdLoadResult) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      unregister();
      resolve(result);
    };

    if (loadFullScreenAd.isSupported() !== true) {
      settle({ type: "failed" });
      return;
    }

    try {
      unregister = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === "loaded") {
            settle({ type: "loaded" });
          }
        },
        onError: () => settle({ type: "failed" }),
      });
    } catch {
      settle({ type: "failed" });
    }
  });
}

function showTossRewardAd(adGroupId: string): Promise<RewardedAdResult> {
  return new Promise((resolve) => {
    let isSettled = false;
    let unregister: () => void = () => undefined;
    const settle = (result: RewardedAdResult) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      unregister();
      resolve(result);
    };

    if (showFullScreenAd.isSupported() !== true) {
      settle({ type: "failed" });
      return;
    }

    try {
      unregister = showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          const result = toRewardedAdResult(event);
          if (result != null) {
            settle(result);
          }
        },
        onError: () => settle({ type: "failed" }),
      });
    } catch {
      settle({ type: "failed" });
    }
  });
}

export function toRewardedAdResult(
  event: ShowFullScreenAdEvent | { readonly type: string },
): RewardedAdResult | null {
  if (event.type === "userEarnedReward") {
    return { type: "earnedReward" };
  }

  if (event.type === "dismissed") {
    return { type: "dismissed" };
  }

  if (event.type === "failedToShow") {
    return { type: "failed" };
  }

  return null;
}
