import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export type RewardBoxHandle = {
  readonly animateBoxTap: () => void;
};

export type RewardBoxProps = {
  readonly disabled?: boolean;
  readonly showPing?: boolean;
  readonly accessibilityLabel?: string;
  readonly onPress: () => void;
};

export const RewardBox = forwardRef<RewardBoxHandle, RewardBoxProps>(
  function RewardBox(
    {
      disabled = false,
      showPing,
      accessibilityLabel = "산소 상자 열기",
      onPress,
    },
    ref,
  ) {
  const isPingVisible = showPing ?? !disabled;
  const boxShakeValue = useRef(new Animated.Value(0)).current;
  const boxTapValue = useRef(new Animated.Value(0)).current;
  const pingValue = useRef(new Animated.Value(0)).current;

  const boxRotate = boxShakeValue.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-6deg", "0deg", "6deg"],
  });
  const boxTranslateX = boxShakeValue.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-2, 0, 2],
  });
  const boxTapScale = boxTapValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.78],
  });
  const boxTapTranslateY = boxTapValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });
  const pingScale = pingValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.6],
  });
  const pingOpacity = pingValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 0],
  });

  useEffect(() => {
    const shakeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(boxShakeValue, {
          toValue: -1,
          duration: 440,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(boxShakeValue, {
          toValue: 1,
          duration: 440,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(boxShakeValue, {
          toValue: -1,
          duration: 440,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(boxShakeValue, {
          toValue: 1,
          duration: 440,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(boxShakeValue, {
          toValue: 0,
          duration: 440,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(2500),
      ]),
    );
    const pingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pingValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pingValue, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(700),
      ]),
    );

    shakeAnimation.start();
    pingAnimation.start();

    return () => {
      shakeAnimation.stop();
      pingAnimation.stop();
    };
  }, [boxShakeValue, pingValue]);

  function animateBoxTap() {
    boxTapValue.stopAnimation(() => {
      boxTapValue.setValue(0);
      Animated.sequence([
        Animated.timing(boxTapValue, {
          toValue: 1,
          duration: 96,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.spring(boxTapValue, {
          toValue: 0,
          tension: 260,
          friction: 8,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }

  useImperativeHandle(ref, () => ({ animateBoxTap }), [boxTapValue]);

  function handlePress() {
    if (disabled) {
      return;
    }

    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.rewardBoxIcon,
          {
            transform: [
              { translateX: boxTranslateX },
              { translateY: boxTapTranslateY },
              { rotate: boxRotate },
              { scale: boxTapScale },
            ],
          },
        ]}
      >
        <View style={styles.rewardBoxGraphic}>
          <View style={styles.rewardBoxBowRow}>
            <View style={styles.rewardBoxBowLeft} />
            <View style={styles.rewardBoxBowRight} />
          </View>
          <View style={styles.rewardBoxLid} />
          <View style={styles.rewardBoxBody} />
          <View style={styles.rewardBoxRibbonVertical} />
        </View>
        {isPingVisible ? (
          <View style={styles.rewardBoxPingWrap}>
            <Animated.View
              style={[
                styles.rewardBoxPingRing,
                {
                  opacity: pingOpacity,
                  transform: [{ scale: pingScale }],
                },
              ]}
            />
            <View style={styles.rewardBoxPingCore} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
  },
);

const styles = StyleSheet.create({
  rewardBoxIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FFE6A3",
    backgroundColor: "#FFFBEF",
    shadowColor: "#F59F00",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  rewardBoxGraphic: {
    width: 34,
    height: 34,
    position: "relative",
  },
  rewardBoxBowRow: {
    position: "absolute",
    top: 3,
    left: 4,
    right: 4,
    height: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  rewardBoxBowLeft: {
    width: 11,
    height: 9,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: 3,
    borderColor: "#FFB300",
    backgroundColor: "transparent",
    transform: [{ rotate: "-28deg" }],
    marginRight: -2,
  },
  rewardBoxBowRight: {
    width: 11,
    height: 9,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: 3,
    borderColor: "#FFB300",
    backgroundColor: "transparent",
    transform: [{ rotate: "28deg" }],
    marginLeft: -2,
  },
  rewardBoxLid: {
    position: "absolute",
    top: 12,
    left: 2,
    width: 30,
    height: 8,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: "#FFB300",
    backgroundColor: "transparent",
    zIndex: 2,
  },
  rewardBoxBody: {
    position: "absolute",
    top: 18,
    left: 5,
    width: 24,
    height: 15,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: "#FFB300",
    backgroundColor: "transparent",
  },
  rewardBoxRibbonVertical: {
    position: "absolute",
    top: 12,
    left: 15,
    width: 3,
    height: 21,
    borderRadius: 2,
    backgroundColor: "#FFB300",
    zIndex: 3,
  },
  rewardBoxPingWrap: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardBoxPingRing: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFB300",
  },
  rewardBoxPingCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFB300",
  },
});
