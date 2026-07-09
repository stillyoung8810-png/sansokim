export const SANSOKIM_PROMOTION_CODE_PLACEHOLDER =
  "REPLACE_WITH_TOSS_PROMOTION_CODE";

export const sansokimPromotionConfig = {
  // 콘솔에서 발급받은 프로모션 코드로 교체하기 전까지 실제 지급 SDK는 호출되지 않습니다.
  promotionCode: "01KWNB1Q11KAB8DYSTRTD4XEZE",
  // QR 테스트 중에는 TEST_{promotionCode}로 호출하고, 운영 전환 시 false로 변경합니다.
  useTestPromotionCode: true,
} as const;

export type SansokimPromotionConfig = {
  readonly promotionCode: string;
  readonly useTestPromotionCode: boolean;
};

export function createSansokimTestPromotionCode(
  promotionCode: string,
): string {
  return `TEST_${promotionCode}`;
}

export function isSansokimPromotionCodeConfigured(
  promotionCode: string,
): boolean {
  return (
    promotionCode.trim() !== "" &&
    promotionCode !== SANSOKIM_PROMOTION_CODE_PLACEHOLDER &&
    !promotionCode.startsWith("REPLACE_WITH")
  );
}

export function getSansokimRuntimePromotionCode(
  config: SansokimPromotionConfig = sansokimPromotionConfig,
): string | null {
  if (!isSansokimPromotionCodeConfigured(config.promotionCode)) {
    return null;
  }

  return config.useTestPromotionCode
    ? createSansokimTestPromotionCode(config.promotionCode)
    : config.promotionCode;
}
