import { InlineAd } from "@apps-in-toss/framework";
import React from "react";
import { Pressable, StyleSheet, Text, type ViewStyle, View } from "react-native";

import {
  SANSOKIM_POINT_BOX_PHRASE_BANNER_AD_GROUP_ID,
  SANSOKIM_POINT_IMAGE_BANNER_HEIGHT,
  SANSOKIM_POINT_TOP_IMAGE_BANNER_AD_GROUP_ID,
} from "../constants/sansokimBannerAds";
import {
  createAttendanceCalendar,
  getYearMonthFromKstDate,
} from "../domain/attendancePolicy";
import { SANSOKIM_POLICY } from "../domain/sansokimPolicy";
import type { RewardAppState } from "../rewardApp";
import { getRatioProgress, ProgressGauge } from "./ProgressGauge";

type PointScreenProps = {
  readonly appState: RewardAppState;
  readonly onBack: () => void;
  readonly onRequestAttendance: () => void;
};

type PointBannerAdCardProps = {
  readonly adGroupId: string;
  readonly slotStyle?: ViewStyle;
};

export function PointScreen({
  appState,
  onBack,
  onRequestAttendance,
}: PointScreenProps) {
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

      <PointBannerAdCard
        adGroupId={SANSOKIM_POINT_TOP_IMAGE_BANNER_AD_GROUP_ID}
        slotStyle={styles.imageBannerSlot}
      />

      <MetricGaugeCard
        title="오늘의 누적 획득 토스 포인트"
        value={`${rewardState.dailyPaidTossPoint}원 / ${SANSOKIM_POLICY.maxDailyTossPoint}`}
        description={`매일 자정 기준으로 한도 ${SANSOKIM_POLICY.maxDailyTossPoint}원까지 모을 수 있어요`}
        progress={getRatioProgress(
          rewardState.dailyPaidTossPoint,
          SANSOKIM_POLICY.maxDailyTossPoint,
        )}
      />

      <MetricGaugeCard
        title="보유 상자"
        value={`${rewardState.availableBoxCount}개 / ${SANSOKIM_POLICY.maxStoredBoxCount}`}
        description="산소 상자는 시간이 지나면 자동으로 쌓여요"
        progress={getRatioProgress(
          rewardState.availableBoxCount,
          SANSOKIM_POLICY.maxStoredBoxCount,
        )}
      />

      <PointBannerAdCard
        adGroupId={SANSOKIM_POINT_BOX_PHRASE_BANNER_AD_GROUP_ID}
      />

      <MetricGaugeCard
        title="오늘 부스트 사용"
        value={`${rewardState.dailyBoostUsedCount}회 / ${SANSOKIM_POLICY.maxDailyBoostUseCount}`}
        description="부스트는 광고 시청 완료 후 2시간 적용돼요"
        progress={getRatioProgress(
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

      <AttendanceCard
        appState={appState}
        onRequestAttendance={onRequestAttendance}
      />
    </View>
  );
}

function PointBannerAdCard({ adGroupId, slotStyle }: PointBannerAdCardProps) {
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
      <ProgressGauge progress={progress} style={styles.metricGauge} />
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

function AttendanceCard({
  appState,
  onRequestAttendance,
}: {
  readonly appState: RewardAppState;
  readonly onRequestAttendance: () => void;
}) {
  const rewardState = appState.rewardState;
  const yearMonth = getYearMonthFromKstDate(rewardState.stateDateKst);
  const calendar =
    yearMonth == null
      ? null
      : createAttendanceCalendar({
          year: yearMonth.year,
          month: yearMonth.month,
          todayKst: rewardState.stateDateKst,
          attendedDatesKst: rewardState.attendedDatesKst,
        });
  const isTodayAttended = rewardState.attendedDatesKst.includes(
    rewardState.stateDateKst,
  );
  const isBoxStorageFull =
    rewardState.availableBoxCount >= SANSOKIM_POLICY.maxStoredBoxCount;
  const isDisabled =
    appState.isAttendanceSubmitting || isTodayAttended || isBoxStorageFull;

  return (
    <View style={styles.card}>
      <View style={styles.attendanceHeader}>
        <Text style={styles.cardTitle}>출석체크</Text>
        <Text style={styles.attendanceMonthTitle}>
          {calendar == null
            ? "이번 달"
            : `${calendar.year}.${String(calendar.month).padStart(2, "0")}`}
        </Text>
      </View>

      {calendar == null ? (
        <Text style={styles.description}>출석 달력을 불러오고 있어요.</Text>
      ) : (
        <View style={styles.attendanceGrid}>
          {calendar.cells.map((cell) => (
            <View
              key={cell.dateKst}
              style={[
                styles.attendanceDayCell,
                cell.isToday ? styles.attendanceTodayCell : null,
                cell.hasAttended ? styles.attendanceCompletedCell : null,
              ]}
            >
              <Text
                style={[
                  styles.attendanceDayText,
                  cell.hasAttended ? styles.attendanceCompletedText : null,
                ]}
              >
                {cell.hasAttended ? "✓" : cell.dayOfMonth}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="출석하고 산소 상자 1개 받기"
        disabled={isDisabled}
        onPress={onRequestAttendance}
        style={({ pressed }) => [
          styles.attendanceButton,
          isDisabled
            ? styles.attendanceButtonDisabled
            : styles.attendanceButtonEnabled,
          pressed && !isDisabled ? styles.pressed : null,
        ]}
      >
        <Text
          style={[
            styles.attendanceButtonText,
            isDisabled ? styles.attendanceButtonTextDisabled : null,
          ]}
        >
          {appState.isAttendanceSubmitting
            ? "출석 확인 중이에요"
            : isTodayAttended
              ? "오늘 출석 완료"
              : isBoxStorageFull
                ? "보유 상자 가득 참"
                : "출석하고 상자 1개 받기"}
        </Text>
      </Pressable>

      <Text style={styles.attendanceDescription}>
        KST 기준 하루 한 번, 출석하면 산소 상자 1개를 받을 수 있어요.
      </Text>
    </View>
  );
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
    height: SANSOKIM_POINT_IMAGE_BANNER_HEIGHT,
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
  metricGauge: {
    marginTop: 14,
  },
  description: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7684",
  },
  attendanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  attendanceMonthTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6B7684",
  },
  attendanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  attendanceDayCell: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F2F4F6",
  },
  attendanceTodayCell: {
    borderWidth: 1,
    borderColor: "#3182F6",
  },
  attendanceCompletedCell: {
    backgroundColor: "#3182F6",
  },
  attendanceDayText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7684",
  },
  attendanceCompletedText: {
    color: "#FFFFFF",
  },
  attendanceButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 16,
  },
  attendanceButtonEnabled: {
    backgroundColor: "#3182F6",
  },
  attendanceButtonDisabled: {
    backgroundColor: "#E5E8EB",
  },
  attendanceButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  attendanceButtonTextDisabled: {
    color: "#8B95A1",
  },
  attendanceDescription: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: "#8B95A1",
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
