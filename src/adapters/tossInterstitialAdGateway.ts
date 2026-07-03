import {
  loadFullScreenAd,
  showFullScreenAd,
  type ShowFullScreenAdEvent,
} from "@apps-in-toss/framework";

import {
  SANSOKIM_ATTENDANCE_INTERSTITIAL_AD_GROUP_ID_PLACEHOLDER,
  SANSOKIM_INTERSTITIAL_AD_PRELOAD_TIMEOUT_MS,
  SANSOKIM_INTERSTITIAL_AD_SHOW_SETTLE_TIMEOUT_MS,
  sansokimInterstitialAdConfig,
} from "../constants/sansokimInterstitialAds";

export type InterstitialAdPreloadResult =
  | { readonly type: "loaded"; readonly adGroupId: string }
  | { readonly type: "failed"; readonly adGroupId: string | null }
  | { readonly type: "skipped"; readonly reason: "placeholderAdGroupId" };

export type InterstitialAdResult =
  | { readonly type: "dismissed"; readonly adGroupId: string }
  | { readonly type: "failed"; readonly adGroupId: string | null }
  | { readonly type: "timeout"; readonly adGroupId: string }
  | { readonly type: "skipped"; readonly reason: "placeholderAdGroupId" };

export type InterstitialAdGateway = {
  readonly preloadNext: () => Promise<InterstitialAdPreloadResult>;
  readonly showPreloaded: () => Promise<InterstitialAdResult>;
  readonly dispose: () => void;
};

export type CreateTossInterstitialAdGatewayParams = {
  readonly adGroupIds?: readonly string[];
};

type InterstitialGatewayState =
  | { readonly type: "idle" }
  | {
      readonly type: "loading";
      readonly adGroupId: string;
      readonly promise: Promise<InterstitialAdPreloadResult>;
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

export function createTossInterstitialAdGateway(
  params: CreateTossInterstitialAdGatewayParams = {},
): InterstitialAdGateway {
  let state: InterstitialGatewayState = { type: "idle" };
  let nextAdGroupIndex = 0;
  const adGroupIds = params.adGroupIds ?? [
    sansokimInterstitialAdConfig.attendanceAdGroupId,
  ];

  function getNextApprovedAdGroupId(): string | null {
    const approvedAdGroupIds = adGroupIds.filter(
      (adGroupId) => !isInterstitialPlaceholderAdGroupId(adGroupId),
    );
    const adGroupCount = approvedAdGroupIds.length;

    if (adGroupCount === 0) {
      return null;
    }

    const adGroupId = approvedAdGroupIds[nextAdGroupIndex % adGroupCount];
    nextAdGroupIndex += 1;

    return adGroupId ?? null;
  }

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
    preloadNext(): Promise<InterstitialAdPreloadResult> {
      if (state.type === "loading") {
        return state.promise;
      }

      if (state.type === "loaded") {
        return Promise.resolve({
          type: "loaded",
          adGroupId: state.adGroupId,
        });
      }

      if (state.type === "showing") {
        return Promise.resolve({ type: "failed", adGroupId: state.adGroupId });
      }

      const adGroupId = getNextApprovedAdGroupId();
      if (adGroupId == null) {
        return Promise.resolve({
          type: "skipped",
          reason: "placeholderAdGroupId",
        });
      }

      if (loadFullScreenAd.isSupported() !== true) {
        return Promise.resolve({ type: "failed", adGroupId });
      }

      const deferred = createDeferred<InterstitialAdPreloadResult>();
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
      const settle = (result: InterstitialAdPreloadResult) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        cleanup();
        state =
          result.type === "loaded"
            ? { type: "loaded", adGroupId: result.adGroupId }
            : { type: "idle" };
        deferred.resolve(result);
      };

      state = {
        type: "loading",
        adGroupId,
        promise: deferred.promise,
        cancel: () => settle({ type: "failed", adGroupId }),
      };

      try {
        timeoutId = setTimeout(() => {
          settle({ type: "failed", adGroupId });
        }, SANSOKIM_INTERSTITIAL_AD_PRELOAD_TIMEOUT_MS);
        unregister = loadFullScreenAd({
          options: { adGroupId },
          onEvent: (event) => {
            if (event.type === "loaded") {
              settle({ type: "loaded", adGroupId });
            }
          },
          onError: () => settle({ type: "failed", adGroupId }),
        });

        if (isSettled) {
          cleanup();
        }
      } catch {
        settle({ type: "failed", adGroupId });
      }

      return deferred.promise;
    },
    showPreloaded(): Promise<InterstitialAdResult> {
      if (state.type !== "loaded") {
        return Promise.resolve({
          type: "failed",
          adGroupId:
            state.type === "loading" || state.type === "showing"
              ? state.adGroupId
              : null,
        });
      }

      const adGroupId = state.adGroupId;
      const deferred = createDeferred<InterstitialAdResult>();
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
      const settle = (result: InterstitialAdResult) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        cleanup();
        state = { type: "idle" };
        deferred.resolve(result);
      };
      const startSettleTimeout = () => {
        if (timeoutId != null) {
          return;
        }

        timeoutId = setTimeout(() => {
          settle({ type: "timeout", adGroupId });
        }, SANSOKIM_INTERSTITIAL_AD_SHOW_SETTLE_TIMEOUT_MS);
      };

      state = {
        type: "showing",
        adGroupId,
        cancel: () => settle({ type: "failed", adGroupId }),
      };

      if (showFullScreenAd.isSupported() !== true) {
        settle({ type: "failed", adGroupId });
        return deferred.promise;
      }

      try {
        unregister = showFullScreenAd({
          options: { adGroupId },
          onEvent: (event) => {
            handleShowEvent({
              event,
              adGroupId,
              settle,
              startSettleTimeout,
            });
          },
          onError: () => settle({ type: "failed", adGroupId }),
        });

        if (isSettled) {
          cleanup();
        }
      } catch {
        settle({ type: "failed", adGroupId });
      }

      return deferred.promise;
    },
    dispose(): void {
      clearActiveRegistration();
    },
  };
}

export function isInterstitialPlaceholderAdGroupId(adGroupId: string): boolean {
  return adGroupId === SANSOKIM_ATTENDANCE_INTERSTITIAL_AD_GROUP_ID_PLACEHOLDER;
}

function handleShowEvent(params: {
  readonly event: ShowFullScreenAdEvent | { readonly type: string };
  readonly adGroupId: string;
  readonly settle: (result: InterstitialAdResult) => void;
  readonly startSettleTimeout: () => void;
}) {
  switch (params.event.type) {
    case "show":
    case "impression":
      params.startSettleTimeout();
      return;
    case "dismissed":
      params.settle({ type: "dismissed", adGroupId: params.adGroupId });
      return;
    case "failedToShow":
      params.settle({ type: "failed", adGroupId: params.adGroupId });
      return;
    default:
      return;
  }
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
