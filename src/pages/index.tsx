import { createRoute } from "@granite-js/react-native";
import { Txt } from "@toss/tds-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { createTossPointPromotionGateway } from "../adapters/tossPointPromotionGateway";
import type { TossPointPromotionGateway } from "../adapters/tossPointPromotionGateway";
import { createTossInterstitialAdGateway } from "../adapters/tossInterstitialAdGateway";
import { createTossRewardAdGateway } from "../adapters/tossRewardAdGateway";
import {
  getSansokimRuntimePromotionCode,
  sansokimPromotionConfig,
} from "../constants/sansokimPromotionConfig";
import { sansokimRewardAdConfig } from "../constants/sansokimRewardAds";
import { HomeScreen } from "../components/HomeScreen";
import { PointScreen } from "../components/PointScreen";
import {
  createInitialRewardAppState,
  createInitialStoredRewardState,
  finishBoostRequestWithGateway,
  finishBoxOpenOpportunityRequestWithGateway,
  getRewardAppStorageSnapshot,
  initializeRewardAppState,
  openHomeScreen,
  openPointScreen,
  refreshRewardAppState,
  startBoostRequest,
  startBoxOpenOpportunityRequest,
  submitAttendanceForBoxReward,
  tapBoxForPayoutWithGateway,
  type RewardAppState,
} from "../rewardApp";
import { getCurrentAnonymousKeyResult } from "../rewardIdentity";
import {
  clearBoxOpenOpportunity,
  readBoxOpenOpportunity,
  writeBoxOpenOpportunity,
} from "../storage/boxOpenOpportunityStorage";
import { readRewardState, writeRewardState } from "../storage/rewardStateStorage";

export const Route = createRoute("/", {
  component: Page,
});

function Page() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [appState, setAppState] = useState<RewardAppState>(() =>
    createInitialRewardAppState({
      rewardState: createInitialStoredRewardState({ nowMs: Date.now() }),
      restoreStatus: "loading",
    }),
  );
  const actionInFlightRef = useRef(false);
  const boxOpenOpportunityRewardAdGatewayRef = useRef(
    createTossRewardAdGateway(
      sansokimRewardAdConfig.boxOpenOpportunityAdGroupIds,
    ),
  );
  const boostRewardAdGatewayRef = useRef(
    createTossRewardAdGateway(sansokimRewardAdConfig.boostAdGroupId),
  );
  const attendanceInterstitialAdGatewayRef = useRef(
    createTossInterstitialAdGateway(),
  );
  const promotionGatewayRef = useRef<TossPointPromotionGateway>(
    createPromotionGateway(),
  );

  const applyAndPersistState = useCallback(async (nextState: RewardAppState) => {
    setAppState(nextState);

    try {
      await persistRewardAppState(nextState);
    } catch {
      setAppState({
        ...nextState,
        bannerMessage: "상태 저장에 실패했어요. 잠시 후 다시 시도해 주세요.",
      });
    }
  }, []);

  const refreshWithCurrentTime = useCallback(async () => {
    const currentNowMs = Date.now();
    setNowMs(currentNowMs);
    await applyAndPersistState(refreshRewardAppState(appState, currentNowMs));
  }, [appState, applyAndPersistState]);

  const preloadBoxOpenOpportunityRewardAd = useCallback(() => {
    void boxOpenOpportunityRewardAdGatewayRef.current.preloadNext();
  }, []);

  const preloadAttendanceInterstitialAd = useCallback(() => {
    void attendanceInterstitialAdGatewayRef.current.preloadNext();
  }, []);

  const showAttendanceInterstitialAfterReward = useCallback(async () => {
    const preloadResult =
      await attendanceInterstitialAdGatewayRef.current.preloadNext();

    if (preloadResult.type !== "loaded") {
      return;
    }

    await attendanceInterstitialAdGatewayRef.current.showPreloaded();
  }, []);

  const handleGrantBoxOpenOpportunity = useCallback(async () => {
    if (actionInFlightRef.current) {
      return;
    }

    const currentNowMs = Date.now();
    const startResult = startBoxOpenOpportunityRequest(appState, currentNowMs);
    setNowMs(currentNowMs);

    if (startResult.type === "blocked") {
      await applyAndPersistState(startResult.state);
      return;
    }

    actionInFlightRef.current = true;
    setAppState(startResult.state);

    try {
      const result = await finishBoxOpenOpportunityRequestWithGateway({
        state: startResult.state,
        rewardAdGateway: boxOpenOpportunityRewardAdGatewayRef.current,
        nowMs: currentNowMs,
      });
      await applyAndPersistState(result.state);
    } finally {
      actionInFlightRef.current = false;
    }
  }, [appState, applyAndPersistState]);

  const handleApplyBoost = useCallback(async () => {
    if (actionInFlightRef.current) {
      return;
    }

    const currentNowMs = Date.now();
    const startResult = startBoostRequest(appState, currentNowMs);
    setNowMs(currentNowMs);

    if (startResult.type === "blocked") {
      await applyAndPersistState(startResult.state);
      return;
    }

    actionInFlightRef.current = true;
    setAppState(startResult.state);

    try {
      const result = await finishBoostRequestWithGateway({
        state: startResult.state,
        rewardAdGateway: boostRewardAdGatewayRef.current,
        nowMs: currentNowMs,
      });
      await applyAndPersistState(result.state);
    } finally {
      actionInFlightRef.current = false;
    }
  }, [appState, applyAndPersistState]);

  const handleTapBox = useCallback(async () => {
    if (actionInFlightRef.current) {
      return;
    }

    const currentNowMs = Date.now();
    setNowMs(currentNowMs);

    actionInFlightRef.current = true;

    try {
      const result = await tapBoxForPayoutWithGateway({
        state: appState,
        promotionGateway: promotionGatewayRef.current,
        tappedAtMs: currentNowMs,
      });
      await applyAndPersistState(result.state);
    } finally {
      actionInFlightRef.current = false;
    }
  }, [appState, applyAndPersistState]);

  const handleSubmitAttendance = useCallback(async () => {
    if (actionInFlightRef.current) {
      return;
    }

    const currentNowMs = Date.now();
    setNowMs(currentNowMs);
    actionInFlightRef.current = true;
    setAppState({
      ...appState,
      isAttendanceSubmitting: true,
      bannerMessage: null,
    });

    try {
      const result = submitAttendanceForBoxReward(appState, currentNowMs);
      await applyAndPersistState(result.state);
      if (result.type === "applied") {
        await showAttendanceInterstitialAfterReward();
      }
    } finally {
      actionInFlightRef.current = false;
    }
  }, [appState, applyAndPersistState, showAttendanceInterstitialAfterReward]);

  useEffect(() => {
    let isActive = true;

    async function restoreState() {
      const currentNowMs = Date.now();
      setNowMs(currentNowMs);

      try {
        const anonymousKeyResult = await getCurrentAnonymousKeyResult();
        const restoredState = await initializeRewardAppState({
          storage: rewardAppStorage,
          nowMs: currentNowMs,
          anonymousHash:
            anonymousKeyResult.type === "success"
              ? anonymousKeyResult.hash
              : undefined,
        });

        if (isActive) {
          setAppState(
            anonymousKeyResult.type === "success"
              ? restoredState
              : {
                  ...restoredState,
                  bannerMessage:
                    "사용자 식별 정보를 확인하지 못해 로컬 상태로 시작했어요.",
                },
          );
        }
      } catch {
        if (isActive) {
          setAppState({
            ...createInitialRewardAppState({
              rewardState: createInitialStoredRewardState({
                nowMs: currentNowMs,
              }),
            }),
            bannerMessage: "저장된 상태를 불러오지 못해 새로 시작했어요.",
          });
        }
      }
    }

    void restoreState();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentNowMs = Date.now();
      setNowMs(currentNowMs);
      setAppState((currentState) =>
        currentState.restoreStatus === "ready"
          ? refreshRewardAppState(currentState, currentNowMs)
          : currentState,
      );
    }, 30_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (
      appState.restoreStatus !== "ready" ||
      appState.currentScreen !== "home" ||
      appState.boxOpenOpportunity != null ||
      appState.isBoxOpenOpportunityRequesting
    ) {
      return;
    }

    preloadBoxOpenOpportunityRewardAd();
  }, [
    appState.boxOpenOpportunity,
    appState.currentScreen,
    appState.isBoxOpenOpportunityRequesting,
    appState.restoreStatus,
    preloadBoxOpenOpportunityRewardAd,
  ]);

  useEffect(() => {
    if (
      appState.restoreStatus !== "ready" ||
      appState.currentScreen !== "point" ||
      appState.rewardState.attendedDatesKst.includes(
        appState.rewardState.stateDateKst,
      )
    ) {
      return;
    }

    preloadAttendanceInterstitialAd();
  }, [
    appState.currentScreen,
    appState.restoreStatus,
    appState.rewardState.attendedDatesKst,
    appState.rewardState.stateDateKst,
    preloadAttendanceInterstitialAd,
  ]);

  useEffect(() => {
    return () => {
      boxOpenOpportunityRewardAdGatewayRef.current.dispose();
      boostRewardAdGatewayRef.current.dispose();
      attendanceInterstitialAdGatewayRef.current.dispose();
    };
  }, []);

  const readyContent =
    appState.currentScreen === "point" ? (
      <PointScreen
        appState={appState}
        onBack={() => setAppState(openHomeScreen(appState))}
        onRequestAttendance={handleSubmitAttendance}
      />
    ) : (
      <HomeScreen
        appState={appState}
        nowMs={nowMs}
        onOpenPointScreen={() => setAppState(openPointScreen(appState))}
        onRefresh={refreshWithCurrentTime}
        onRequestBoxOpenOpportunity={handleGrantBoxOpenOpportunity}
        onRequestBoost={handleApplyBoost}
        onTapBox={handleTapBox}
      />
    );

  return (
    <View style={styles.root}>
      {appState.bannerMessage == null ? null : (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{appState.bannerMessage}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Txt style={styles.title}>
            어차피 마시는 공기, 포인트까지
          </Txt>
        </View>

        {appState.restoreStatus === "loading" ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>산소킴 상태를 불러오고 있어요.</Text>
          </View>
        ) : (
          readyContent
        )}
      </ScrollView>
    </View>
  );
}

async function persistRewardAppState(state: RewardAppState): Promise<void> {
  const snapshot = getRewardAppStorageSnapshot(state);

  if (snapshot.rewardState != null) {
    await writeRewardState(snapshot.rewardState);
  }

  if (snapshot.boxOpenOpportunity == null) {
    await clearBoxOpenOpportunity();
    return;
  }

  await writeBoxOpenOpportunity(snapshot.boxOpenOpportunity);
}

function createPromotionGateway(): TossPointPromotionGateway {
  const promotionCode = getSansokimRuntimePromotionCode(
    sansokimPromotionConfig,
  );

  if (promotionCode == null) {
    return {
      async grantTossPoint() {
        return { type: "failed", reason: "promotionError" };
      },
    };
  }

  return createTossPointPromotionGateway({ promotionCode });
}

const rewardAppStorage = {
  rewardState: {
    read: readRewardState,
    write: writeRewardState,
  },
  boxOpenOpportunity: {
    read: readBoxOpenOpportunity,
    write: writeBoxOpenOpportunity,
    clear: clearBoxOpenOpportunity,
  },
} as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F2F4F6",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#191F28",
    lineHeight: 36,
    textAlign: "center",
  },
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#E8F3FF",
    marginTop: 14,
    marginHorizontal: 20,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1B64DA",
    fontWeight: "800",
  },
  loadingCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4E5968",
  },
});
