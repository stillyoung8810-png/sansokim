export const SANSOKIM_TEST_REWARDED_AD_GROUP_ID = "ait-ad-test-rewarded-id";

// 운영 전환 시 Apps in Toss 콘솔의 상자 열기 기회용 보상형 광고 그룹 ID로 교체합니다.
export const SANSOKIM_BOX_OPEN_OPPORTUNITY_REWARD_AD_GROUP_ID =
  "ait.v2.live.d2793e603e2a4fe9";

// 운영 전환 시 Apps in Toss 콘솔의 부스트용 보상형 광고 그룹 ID로 교체합니다.
export const SANSOKIM_BOOST_REWARD_AD_GROUP_ID =
  "REPLACE_WITH_BOOST_REWARD_AD_GROUP_ID";

export const sansokimRewardAdConfig = {
  boxOpenOpportunityAdGroupId: SANSOKIM_BOX_OPEN_OPPORTUNITY_REWARD_AD_GROUP_ID,
  // QR 개발 검증 중에는 테스트 광고 ID를 사용합니다.
  boostAdGroupId: SANSOKIM_TEST_REWARDED_AD_GROUP_ID,
} as const;

export function isConfiguredRewardAdGroupId(adGroupId: string): boolean {
  return adGroupId !== "" && !adGroupId.startsWith("REPLACE_WITH");
}
