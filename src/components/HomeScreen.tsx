import { InlineAd } from "@apps-in-toss/framework";
import React, { useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, type ViewStyle, View } from "react-native";

import {
  SANSOKIM_HOME_BOX_IMAGE_BANNER_AD_GROUP_ID,
  SANSOKIM_HOME_IMAGE_BANNER_HEIGHT,
  SANSOKIM_HOME_STATUS_PHRASE_BANNER_AD_GROUP_ID,
} from "../constants/sansokimBannerAds";
import { SANSOKIM_POLICY } from "../domain/sansokimPolicy";
import {
  getNextBoxAccrualProgress,
  getNextBoxRemainingMs,
} from "../domain/sansokimRewardPolicy";
import type { RewardAppState } from "../rewardApp";
import { ProgressGauge } from "./ProgressGauge";
import { RewardBox, type RewardBoxHandle } from "./RewardBox";

type HomeScreenProps = {
  readonly appState: RewardAppState;
  readonly nowMs: number;
  readonly onOpenPointScreen: () => void;
  readonly onRefresh: () => void;
  readonly onRequestBoxOpenOpportunity: () => void;
  readonly onRequestBoost: () => void;
  readonly onTapBox: () => void;
};

type HomeBannerAdCardProps = {
  readonly adGroupId: string;
  readonly slotStyle?: ViewStyle;
};

export function HomeScreen({
  appState,
  nowMs,
  onOpenPointScreen,
  onRefresh,
  onRequestBoxOpenOpportunity,
  onRequestBoost,
  onTapBox,
}: HomeScreenProps) {
  const rewardBoxRef = useRef<RewardBoxHandle>(null);
  const rewardState = appState.rewardState;
  const hasOpportunity = appState.boxOpenOpportunity != null;
  const isAdRequesting =
    appState.isBoxOpenOpportunityRequesting || appState.isBoostRequesting;
  const isBoxEnabled =
    hasOpportunity &&
    rewardState.availableBoxCount > 0 &&
    !isAdRequesting &&
    !appState.isBoxOpenCrediting;
  const isOpportunityButtonDisabled = hasOpportunity || isAdRequesting;
  const isBoostButtonDisabled = isAdRequesting || appState.isBoxOpenCrediting;
  const nextBoxRemainingMs = getNextBoxRemainingMs(rewardState, nowMs);
  const nextBoxAccrualProgress = getNextBoxAccrualProgress(rewardState, nowMs);
  const boostRemainingMs =
    rewardState.boostEndsAtMs == null
      ? 0
      : Math.max(0, rewardState.boostEndsAtMs - nowMs);
  const boostStatus =
    boostRemainingMs > 0
      ? `부스트 2배 · ${formatDuration(boostRemainingMs)} 남음`
      : "부스트 대기 중";
  const opportunityStatus = hasOpportunity
    ? "상자 열기 기회 1회 보유"
    : "상자 열기 기회를 받아주세요";
  const boxHelpText = getBoxHelpText({
    hasOpportunity,
    availableBoxCount: rewardState.availableBoxCount,
    dailyPaidTossPoint: rewardState.dailyPaidTossPoint,
  });
  const handleRewardBoxPress = useCallback(() => {
    rewardBoxRef.current?.animateBoxTap();
    onTapBox();
  }, [onTapBox]);

  return (
    <View style={styles.section}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>🫧 오늘의 산소</Text>
            <Text style={styles.heroTitle}>
              다음 상자까지 {formatDuration(nextBoxRemainingMs)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="화면 갱신"
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.refreshButtonText}>갱신</Text>
          </Pressable>
        </View>
        <ProgressGauge
          progress={nextBoxAccrualProgress}
          style={styles.heroGauge}
        />
        <Text style={styles.heroDescription}>
          현재 산소 상자가 차곡차곡 쌓이고 있어요
        </Text>
      </View>

      <HomeBannerAdCard adGroupId={SANSOKIM_HOME_STATUS_PHRASE_BANNER_AD_GROUP_ID} />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>산소 상자</Text>
            <Text style={styles.cardDescription}>{opportunityStatus}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="포인트 내역"
            onPress={onOpenPointScreen}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>포인트 내역</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.boxArea,
            styles.boxAreaEnabled,
          ]}
        >
          <RewardBox
            ref={rewardBoxRef}
            disabled={!isBoxEnabled}
            showPing={hasOpportunity}
            onPress={handleRewardBoxPress}
          />
          <Text style={styles.boxCountText}>x{rewardState.availableBoxCount}</Text>
          <Text style={styles.boxHelpText}>{boxHelpText}</Text>
        </View>
      </View>

      <HomeBannerAdCard
        adGroupId={SANSOKIM_HOME_BOX_IMAGE_BANNER_AD_GROUP_ID}
        slotStyle={styles.imageBannerSlot}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>상자와 부스트</Text>
        <Text style={styles.cardDescription}>
          상자 1개를 열면 토스 포인트 1원이 지급돼요
        </Text>
        <Text style={styles.cardDescription}>
          {`오늘은 최대 ${SANSOKIM_POLICY.maxDailyTossPoint}원까지 받을 수 있어요`}
        </Text>
        <Text style={styles.boostText}>{boostStatus}</Text>
        <View style={styles.actionColumn}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="상자 열기 기회 받기"
            onPress={onRequestBoxOpenOpportunity}
            style={({ pressed }) => [
              styles.primaryButton,
              isOpportunityButtonDisabled ? styles.disabledButton : null,
              pressed && !isOpportunityButtonDisabled ? styles.pressed : null,
            ]}
            disabled={isOpportunityButtonDisabled}
          >
            <Text style={styles.primaryButtonText}>상자 열기 기회 받기</Text>
            <Text style={styles.primaryButtonSubtext}>
              광고 시청 후 상자 열기 기회 1회 지급
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="2시간 부스트 받기"
            onPress={onRequestBoost}
            style={({ pressed }) => [
              styles.boostButton,
              isBoostButtonDisabled ? styles.disabledButton : null,
              pressed && !isBoostButtonDisabled ? styles.pressed : null,
            ]}
            disabled={isBoostButtonDisabled}
          >
            <Text style={styles.boostButtonText}>2시간 부스트 받기</Text>
            <Text style={styles.boostButtonSubtext}>
              광고 시청 후 부스트 적용
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>
          본 프로모션은 예산 소진 등으로 사전 고지 없이 중단될 수 있어요
        </Text>
      </View>
    </View>
  );
}

function HomeBannerAdCard({ adGroupId, slotStyle }: HomeBannerAdCardProps) {
  return (
    <View style={styles.adCard}>
      <View style={[styles.adSlot, slotStyle]}>
        <InlineAd
          adGroupId={adGroupId}
          variant="card"
          impressFallbackOnMount={true}
        />
      </View>
    </View>
  );
}

function getBoxHelpText(params: {
  readonly hasOpportunity: boolean;
  readonly availableBoxCount: number;
  readonly dailyPaidTossPoint: number;
}): string {
  if (!params.hasOpportunity) {
    return "상자 열기 기회를 받아주세요";
  }

  if (params.availableBoxCount <= 0) {
    return "보유한 산소 상자가 없어요";
  }

  if (params.dailyPaidTossPoint >= SANSOKIM_POLICY.maxDailyTossPoint) {
    return "오늘 받을 수 있는 토스 포인트를 모두 받았어요";
  }

  return "상자를 4번 터치해서 열어보세요";
}

function formatDuration(durationMs: number): string {
  if (durationMs <= 0) {
    return "0분";
  }

  const totalMinutes = Math.ceil(durationMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}분`;
  }

  if (minutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${minutes}분`;
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  heroCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#E8F7FF",
  },
  heroHeader: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  heroTextBlock: {
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3182F6",
    textAlign: "center",
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    color: "#191F28",
    textAlign: "center",
  },
  heroGauge: {
    marginTop: 14,
  },
  heroDescription: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: "#4E5968",
    textAlign: "center",
  },
  refreshButton: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3182F6",
  },
  adCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E8EB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  adSlot: {
    width: "100%",
  },
  imageBannerSlot: {
    height: SANSOKIM_HOME_IMAGE_BANNER_HEIGHT,
  },
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#191F28",
  },
  cardDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7684",
  },
  secondaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: "#F2F4F6",
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4E5968",
  },
  boxArea: {
    alignItems: "center",
    marginTop: 18,
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
  },
  boxAreaEnabled: {
    borderColor: "#3182F6",
    backgroundColor: "#F4FAFF",
  },
  boxCountText: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "900",
    color: "#191F28",
  },
  boxHelpText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7684",
  },
  boostText: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F2F4F6",
    fontSize: 14,
    fontWeight: "800",
    color: "#3182F6",
  },
  actionColumn: {
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#191F28",
  },
  disabledButton: {
    backgroundColor: "#D1D6DB",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  primaryButtonSubtext: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#E5E8EB",
  },
  boostButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#3182F6",
  },
  boostButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  boostButtonSubtext: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#D8ECFF",
  },
  noticeCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F2F4F6",
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8B95A1",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
  },
});
