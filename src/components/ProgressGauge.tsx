import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

export function getRatioProgress(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0;
  }

  return clampProgress(value / maxValue);
}

type ProgressGaugeProps = {
  readonly progress: number;
  readonly style?: StyleProp<ViewStyle>;
};

export function ProgressGauge({ progress, style }: ProgressGaugeProps) {
  const clampedProgress = clampProgress(progress);

  return (
    <View style={[styles.gaugeTrack, style]}>
      <View
        style={[styles.gaugeFill, { width: `${clampedProgress * 100}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gaugeTrack: {
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E5E8EB",
  },
  gaugeFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3182F6",
  },
});
