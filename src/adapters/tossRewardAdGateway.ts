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
  readonly preloadNext: () => Promise<RewardAdLoadResult>;
  readonly showPreloaded: () => Promise<RewardedAdResult>;
  readonly dispose: () => void;
};

type RewardAdGatewayState =
  | { readonly type: "idle" }
  | {
      readonly type: "loading";
      readonly promise: Promise<RewardAdLoadResult>;
      readonly cancel: () => void;
    }
  | { readonly type: "loaded"; readonly adGroupId: string }
  | {
      readonly type: "showing";
      readonly adGroupId: string;
      readonly cancel: () => void;
    };

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

type NonEmptyRewardAdGroupIds = readonly [string, ...string[]];

const REWARD_AD_PRELOAD_TIMEOUT_MS = 15_000;

export function createTossRewardAdGateway(
  adGroupIds: string | readonly string[],
): RewardAdGateway {
  let state: RewardAdGatewayState = { type: "idle" };
  let nextAdGroupIndex = 0;
  const normalizedAdGroupIds = normalizeRewardAdGroupIds(adGroupIds);

  function clearActiveRegistration() {
    switch (state.type) {
      case "loading":
      case "showing":
        state.cancel();
        return;
      case "loaded":
      case "idle":
        state = { type: "idle" };
        return;
      default:
        return assertNever(state);
    }
  }

  return {
    load(): Promise<RewardAdLoadResult> {
      return this.preloadNext();
    },
    show(): Promise<RewardedAdResult> {
      return this.showPreloaded();
    },
    preloadNext(): Promise<RewardAdLoadResult> {
      if (state.type === "loading") {
        return state.promise;
      }

      if (state.type === "loaded") {
        return Promise.resolve({ type: "loaded" });
      }

      if (state.type === "showing") {
        return Promise.resolve({ type: "failed" });
      }

      if (loadFullScreenAd.isSupported() !== true) {
        return Promise.resolve({ type: "failed" });
      }

      const adGroupId = getRewardAdGroupId(
        normalizedAdGroupIds,
        nextAdGroupIndex,
      );
      const deferred = createDeferred<RewardAdLoadResult>();
      let isSettled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let unregister: (() => void) | null = null;
      const cleanup = () => {
        if (timeoutId != null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        unregister?.();
        unregister = null;
      };
      const settle = (result: RewardAdLoadResult) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        cleanup();
        state =
          result.type === "loaded"
            ? { type: "loaded", adGroupId }
            : { type: "idle" };
        deferred.resolve(result);
      };

      state = {
        type: "loading",
        promise: deferred.promise,
        cancel: () => settle({ type: "failed" }),
      };

      try {
        timeoutId = setTimeout(() => {
          settle({ type: "failed" });
        }, REWARD_AD_PRELOAD_TIMEOUT_MS);
        unregister = loadFullScreenAd({
          options: { adGroupId },
          onEvent: (event) => {
            if (event.type === "loaded") {
              settle({ type: "loaded" });
            }
          },
          onError: () => settle({ type: "failed" }),
        });

        if (isSettled) {
          cleanup();
        }
      } catch {
        settle({ type: "failed" });
      }

      return deferred.promise;
    },
    showPreloaded(): Promise<RewardedAdResult> {
      if (state.type !== "loaded") {
        return Promise.resolve({ type: "failed" });
      }

      const currentAdGroupId = state.adGroupId;
      const deferred = createDeferred<RewardedAdResult>();
      let isSettled = false;
      let unregister: (() => void) | null = null;
      const cleanup = () => {
        unregister?.();
        unregister = null;
      };
      const settle = (result: RewardedAdResult) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        cleanup();
        if (result.type === "earnedReward") {
          nextAdGroupIndex =
            (nextAdGroupIndex + 1) % normalizedAdGroupIds.length;
        }
        state = { type: "idle" };
        deferred.resolve(result);
      };

      state = {
        type: "showing",
        adGroupId: currentAdGroupId,
        cancel: () => settle({ type: "failed" }),
      };

      if (showFullScreenAd.isSupported() !== true) {
        settle({ type: "failed" });
        return deferred.promise;
      }

      try {
        unregister = showFullScreenAd({
          options: { adGroupId: currentAdGroupId },
          onEvent: (event) => {
            const result = toRewardedAdResult(event);
            if (result != null) {
              settle(result);
            }
          },
          onError: () => settle({ type: "failed" }),
        });

        if (isSettled) {
          cleanup();
        }
      } catch {
        settle({ type: "failed" });
      }

      return deferred.promise;
    },
    dispose(): void {
      clearActiveRegistration();
    },
  };
}

function normalizeRewardAdGroupIds(
  adGroupIds: string | readonly string[],
): NonEmptyRewardAdGroupIds {
  if (typeof adGroupIds === "string") {
    return [adGroupIds];
  }

  if (adGroupIds.length === 0) {
    throw new Error("Reward ad group ids must not be empty");
  }

  return adGroupIds as NonEmptyRewardAdGroupIds;
}

function getRewardAdGroupId(
  adGroupIds: NonEmptyRewardAdGroupIds,
  index: number,
): string {
  return adGroupIds[index % adGroupIds.length] ?? adGroupIds[0];
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

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  if (resolvePromise == null) {
    throw new Error("Deferred resolver was not initialized");
  }

  return {
    promise,
    resolve: resolvePromise,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
