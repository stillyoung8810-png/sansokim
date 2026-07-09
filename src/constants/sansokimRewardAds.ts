export const SANSOKIM_TEST_REWARDED_AD_GROUP_ID = "ait-ad-test-rewarded-id";

// 운영 전환 시 Apps in Toss 콘솔의 상자 열기 기회용 보상형 광고 그룹 ID로 교체합니다.
export const SANSOKIM_BOX_OPEN_OPPORTUNITY_REWARD_AD_GROUP_ID =
  "ait.v2.live.d2793e603e2a4fe9";
export const SANSOKIM_BOX_OPEN_OPPORTUNITY_SECONDARY_REWARD_AD_GROUP_ID =
  "ait.v2.live.e864ea6eb957412c";
export const SANSOKIM_BOX_OPEN_OPPORTUNITY_REWARD_AD_GROUP_IDS = [
  SANSOKIM_BOX_OPEN_OPPORTUNITY_REWARD_AD_GROUP_ID,
  SANSOKIM_BOX_OPEN_OPPORTUNITY_SECONDARY_REWARD_AD_GROUP_ID,
] as const;

export const SANSOKIM_BOOST_REWARD_AD_GROUP_ID =
  "ait.v2.live.46366311d9f3491b";

export const sansokimRewardAdConfig = {
  boxOpenOpportunityAdGroupIds:
    SANSOKIM_BOX_OPEN_OPPORTUNITY_REWARD_AD_GROUP_IDS,
  boostAdGroupId: SANSOKIM_BOOST_REWARD_AD_GROUP_ID,
} as const;

export function isConfiguredRewardAdGroupId(adGroupId: string): boolean {
  return adGroupId !== "" && !adGroupId.startsWith("REPLACE_WITH");
}
