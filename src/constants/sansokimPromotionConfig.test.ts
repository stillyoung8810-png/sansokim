/// <reference types="jest" />

import {
  createSansokimTestPromotionCode,
  getSansokimRuntimePromotionCode,
  isSansokimPromotionCodeConfigured,
  SANSOKIM_PROMOTION_CODE_PLACEHOLDER,
} from "./sansokimPromotionConfig";

describe("sansokimPromotionConfig", () => {
  it("does not produce a runtime promotion code while placeholder is configured", () => {
    expect(
      getSansokimRuntimePromotionCode({
        promotionCode: SANSOKIM_PROMOTION_CODE_PLACEHOLDER,
        useTestPromotionCode: true,
      }),
    ).toBeNull();
    expect(
      isSansokimPromotionCodeConfigured(SANSOKIM_PROMOTION_CODE_PLACEHOLDER),
    ).toBe(false);
  });

  it("uses TEST_{promotionCode} while test promotion mode is enabled", () => {
    expect(createSansokimTestPromotionCode("PROMO_1")).toBe("TEST_PROMO_1");
    expect(
      getSansokimRuntimePromotionCode({
        promotionCode: "PROMO_1",
        useTestPromotionCode: true,
      }),
    ).toBe("TEST_PROMO_1");
  });

  it("uses the live promotion code when test promotion mode is disabled", () => {
    expect(
      getSansokimRuntimePromotionCode({
        promotionCode: "PROMO_1",
        useTestPromotionCode: false,
      }),
    ).toBe("PROMO_1");
  });
});
