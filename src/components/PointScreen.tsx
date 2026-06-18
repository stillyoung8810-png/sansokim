import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SANSOKIM_POLICY } from "../domain/sansokimPolicy";
import type { RewardAppState } from "../rewardApp";

type PointScreenProps = {
  readonly appState: RewardAppState;
  readonly onBack: () => void;
};

export function PointScreen({ appState, onBack }: PointScreenProps) {
  const rewardState = appState.rewardState;

  return (
    <View style={styles.section}>
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.eyebrow}>포인트 내역</Text>
          <Text style={styles.title}>오늘 모은 산소킴 기록</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="홈으로 돌아가기"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.backButtonText}>뒤로가기</Text>
        </Pressable>
      </View>

      <MetricGaugeCard
        title="오늘의 누적 획득 토스 포인트"
        value={`${rewardState.dailyPaidTossPoint}원 / ${SANSOKIM_POLICY.maxDailyTossPoint}`}
        description="매일 자정 기준으로 한도 100원까지 모을 수 있어요"
        progress={getProgress(
          rewardState.dailyPaidTossPoint,
          SANSOKIM_POLICY.maxDailyTossPoint,
        )}
      />

      <MetricGaugeCard
        title="보유 상자"
        value={`${rewardState.availableBoxCount}개 / ${SANSOKIM_POLICY.maxStoredBoxCount}`}
        description="산소 상자는 시간이 지나면 자동으로 쌓여요"
        progress={getProgress(
          rewardState.availableBoxCount,
          SANSOKIM_POLICY.maxStoredBoxCount,
        )}
      />

      <MetricGaugeCard
        title="오늘 부스트 사용"
        value={`${rewardState.dailyBoostUsedCount}회 / ${SANSOKIM_POLICY.maxDailyBoostUseCount}`}
        description="부스트는 광고 시청 완료 후 2시간 적용돼요"
        progress={getProgress(
          rewardState.dailyBoostUsedCount,
          SANSOKIM_POLICY.maxDailyBoostUseCount,
        )}
      />

      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>
          상자 1개를 열면 토스 포인트 1원이 지급돼요
        </Text>
        <Text style={styles.noticeText}>
          본 프로모션은 예산 소진 등으로 사전 고지 없이 중단될 수 있어요
        </Text>
      </View>
    </View>
  );
}

function MetricGaugeCard({
  title,
  value,
  description,
  progress,
}: {
  readonly title: string;
  readonly value: string;
  readonly description: string;
  readonly progress: number;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

function getProgress(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, value / maxValue));
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "900",
    color: "#3182F6",
  },
  title: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    color: "#191F28",
  },
  backButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F2F4F6",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4E5968",
  },
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#191F28",
  },
  metricValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "900",
    color: "#3182F6",
  },
  gaugeTrack: {
    height: 12,
    marginTop: 14,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E5E8EB",
  },
  gaugeFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3182F6",
  },
  description: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7684",
  },
  noticeCard: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F2F4F6",
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8B95A1",
  },
  pressed: {
    opacity: 0.78,
  },
});
