# 산소킴 MVP 구현 계획서

이 문서는 산소킴 MVP를 구현하기 위한 제품 정책, 화면 구조, 로컬 저장 모델, 토스 SDK 연동 스니펫을 정리합니다.

참고 구현은 `/home/yty/workspace/kilomoa`입니다. 특히 아래 파일의 패턴을 산소킴에 맞게 변형해서 사용합니다.

- `src/components/HomeScreen.tsx`: 홈 히어로 카드, 상자 UI, 상자 흔들림/탭 애니메이션, 포인트 화면 이동 버튼 위치
- `src/domain/renewalPolicy.ts`: 상자 4회 탭 정책, 탭 간격 제한, 금융 인자 검증
- `src/domain/v1RewardPolicy.ts`: 로컬 리워드 상태 복원, 일자 롤오버, 포인트 지급 성공 후 상태 반영
- `src/storage/rewardStateStorage.ts`: `Storage` 기반 JSON 저장
- `src/storage/boxOpenOpportunityStorage.ts`: 상자 열기 기회 저장/삭제
- `src/adapters/tossRewardAdGateway.ts`: `loadFullScreenAd`/`showFullScreenAd` 래핑
- `src/adapters/tossPointPromotionGateway.ts`: `grantPromotionReward` 래핑
- `src/rewardIdentity.ts`: `getAnonymousKey` 래핑

## 공식 문서 확인 기준

이 문서는 아래 공식 문서에서 확인된 내용만 SDK 근거로 사용합니다.

- 사용자 식별키 발급: `getAnonymousKey`
  - 비게임 미니앱 전용 사용자 식별키 API입니다.
  - 반환값은 `{ type: 'HASH', hash: string }`, `'INVALID_CATEGORY'`, `'ERROR'`, `undefined` 형태입니다.
  - 반환된 hash는 내부 사용자 식별용이며, 토스 서버 API 호출용 키가 아닙니다.
  - 샌드박스에서는 mock 데이터가 반환되므로 실제 동작은 QR 코드로 테스트해야 합니다.
- 프로모션: `grantPromotionReward`
  - 비게임 미니앱에서 서버 없이 SDK 함수만으로 토스 포인트를 지급할 수 있습니다.
  - 반환값은 `{ key: string }`, `{ errorCode: string; message: string }`, `'ERROR'`, `undefined` 형태입니다.
  - 중복 호출 방어 로직을 반드시 적용해야 합니다.
  - 테스트 프로모션 코드는 샌드박스 앱이 아닌 토스앱 QR 코드 테스트에서 호출해야 합니다.
- 전면형/보상형 광고: `loadFullScreenAd`, `showFullScreenAd`
  - 전면형과 보상형 광고는 동일 API를 사용하고, 광고 타입은 `adGroupId` 기준으로 결정됩니다.
  - `loadFullScreenAd` 후 `loaded` 이벤트를 받은 뒤 `showFullScreenAd`를 호출해야 합니다.
  - 보상 지급은 `userEarnedReward` 이벤트가 왔을 때만 처리해야 합니다. `dismissed`만으로 보상을 지급하면 안 됩니다.
  - 개발 단계에서는 테스트용 리워드 광고 ID `ait-ad-test-rewarded-id`를 사용합니다.
  - 샌드박스에서는 인앱 광고 기능이 지원되지 않으므로 콘솔 QR 코드로 테스트해야 합니다.
- 배너 광고
  - 현재 MVP의 핵심은 보상형 광고입니다.
  - 배너 광고를 추가할 경우 WebView 문서 기준 `TossAds` API 또는 React Native 문서/컴포넌트를 별도로 확인하고 적용합니다.

요청된 URL 중 현재 `ads/console.html`, `promotion/qa.html`, `ads/qa.html`은 404로 확인되었습니다. 이 문서에서는 해당 URL을 근거로 사용하지 않습니다. `promotion/console.html`은 프로모션 문서로 이동 안내만 확인되었습니다.

## 제품 정책

산소킴은 비게임 토스 미니앱입니다. 사용자는 로그인 없이 이용하고, 앱은 `getAnonymousKey()`로 받은 hash와 로컬 `Storage` 상태를 기준으로 동작합니다.

확정 정책값은 다음과 같습니다.

- 미니앱 유형: 비게임
- 로그인: 없음
- 사용자 식별: `getAnonymousKey()`
- 저장 방식: 로컬 `Storage`
- 기본 상자 적립: 1시간에 산소 상자 1개
- 마지막 접속 이후 자동 적립 인정: 최대 100시간
- 최대 보관 상자: 200개
- 상자 열기 방식: 산소 상자 1개를 4번 터치
- 산소 상자 1개 열기 보상: 토스 포인트 1원 고정
- 하루 최대 토스 포인트 지급 한도: 100원
- 하루 기준: KST 자정 00:00 리셋
- 상자 열기 기회: 리워드 광고 1회 시청 완료 시 1회
- 상자 열기 기회 보유 한도: 최대 1회
- 부스트 효과: 산소 상자 적립 속도 2배
- 부스트 지속 시간: 리워드 광고 1회 시청 완료당 2시간
- 하루 부스트 사용 횟수: 12회
- 부스트 누적 연장: 가능
- 부스트는 앱 종료 중에도 적용

서버 없이 로컬 저장만 사용하므로, 앱 삭제/데이터 삭제/기기 변경 시 로컬 상태가 사라질 수 있습니다. 실제 토스 포인트가 지급되는 구조라서 중복 지급 방어 로직은 로컬 안에서 최대한 적용하되, 서버 기반 지급 이력만큼 강한 어뷰징 방어는 불가능합니다.

## 화면 구조

### 홈 화면

홈 화면은 `kilomoa`처럼 최상단에 핵심 숫자를 크게 보여주는 구조를 사용합니다. 산소킴의 최상단 히어로는 이동거리 대신 다음 산소 상자까지 남은 시간을 보여줍니다.

예시 더미 데이터:

```text
오늘의 산소
다음 산소 상자까지 42분
현재 산소 상자가 차곡차곡 쌓이고 있어요
```

그 아래 상태 카드:

```text
보유 상자 18개
오늘 받은 토스 포인트 7원 / 100원
부스트 2배 · 1시간 24분 남음
```

사용자가 이해해야 하는 흐름:

```text
시간이 지나면 산소 상자가 쌓임
상자 열기 기회나 부스트는 리워드 광고 시청 완료 후 받을 수 있음
산소 상자를 4번 터치해서 열면 토스 포인트 1원 지급
```

### 보유 상자 카드

보유 상자 카드는 산소킴의 핵심 행동 영역입니다.

- `kilomoa`와 동일한 상자 모양과 애니메이션을 참고합니다.
- 상자 흔들림 애니메이션을 적용합니다.
- 터치 시 눌리는 애니메이션을 적용합니다.
- 상자 열기 기회가 있을 때만 상자를 활성화합니다.
- 기회가 없으면 상자를 비활성화합니다.
- 상자 아래에 `x18`처럼 보유 상자 수를 표시합니다.
- 기회 획득 후 상자를 4번 터치하면 토스 포인트 지급을 시도합니다.
- 토스 포인트 지급 성공 후에만 상자 1개와 기회 1회를 소진합니다.

카드 우측 상단에는 `kilomoa`의 골드 지갑 버튼과 비슷한 위치에 `포인트 내역` 버튼을 둡니다. 버튼을 누르면 포인트 화면으로 이동합니다.

버튼 구성:

```text
상자 열기 기회 받기
광고 시청 후 상자 열기 기회 1회 지급
```

```text
2시간 부스트 받기
광고 시청 후 부스트 적용
```

버튼 제목은 짧게 쓰고, 광고 조건은 버튼 아래 설명 문구로 분리합니다.

### 포인트 화면

포인트 화면에는 현재 사용자의 일일 상태를 명확하게 보여줍니다.

표시 항목:

- 오늘의 누적 획득 토스 포인트
  - 예: `7원 / 100`
  - `7원`은 강조 색상으로 표시합니다.
  - 100원을 max로 하는 게이지를 표시합니다.
  - 안내 문구: `매일 자정 기준으로 한도 100원까지 모을 수 있어요`
- 보유 상자
  - 예: `18개 / 200`
- 오늘 부스트 사용
  - 예: `3회 / 12`

## 문구 정책

토스 프로모션 문서상 자체 리워드에 `포인트`라는 명칭을 쓰면 토스 포인트와 오인될 수 있습니다. 산소킴 내부 보상은 `산소 상자`, `상자 열기 기회`, `부스트`로 부릅니다.

사용 가능한 문구:

```text
상자 1개를 열면 토스 포인트 1원이 지급돼요
오늘은 최대 100원까지 받을 수 있어요
상자 열기 기회 받기
광고 시청 후 상자 열기 기회 1회 지급
2시간 부스트 받기
광고 시청 후 부스트 적용
본 프로모션은 예산 소진 등으로 사전 고지 없이 중단될 수 있어요
```

피해야 할 문구:

```text
뽑기
당첨
랜덤 보상
대박
현금
출금
포인트 교환
광고 클릭하면 포인트 지급
```

## 권장 파일 구조

산소킴에는 아래 구조를 추가하는 것을 권장합니다.

```text
src/
  adapters/
    tossPointPromotionGateway.ts
    tossRewardAdGateway.ts
  constants/
    sansokimMessages.ts
    sansokimPromotionConfig.ts
    sansokimRewardAds.ts
  domain/
    sansokimPolicy.ts
    sansokimRewardPolicy.ts
    boxOpenOpportunity.ts
  storage/
    rewardStateStorage.ts
    boxOpenOpportunityStorage.ts
  rewardIdentity.ts
  rewardApp.ts
  components/
    HomeScreen.tsx
    PointScreen.tsx
```

`kilomoa`의 네이밍을 그대로 복사하지 말고, 저장 키와 타입명은 산소킴 기준으로 새로 둡니다.

## 정책 상수 스니펫

```ts
export const SANSOKIM_POLICY = {
  boxAccrualIntervalMs: 60 * 60 * 1_000,
  maxOfflineAccrualMs: 100 * 60 * 60 * 1_000,
  maxStoredBoxCount: 200,
  boxTapRequiredCount: 4,
  boxTapMinIntervalMs: 300,
  boxTapSessionExpiresInMs: 10_000,
  tossPointPerBoxOpen: 1,
  maxDailyTossPoint: 100,
  boostMultiplier: 2,
  boostDurationMs: 2 * 60 * 60 * 1_000,
  maxDailyBoostUseCount: 12,
  maxCompletedRewardKeyCount: 1_000,
} as const;
```

## 로컬 상태 모델 스니펫

```ts
export type RewardState = {
  readonly stateDateKst: string;
  readonly availableBoxCount: number;
  readonly dailyPaidTossPoint: number;
  readonly dailyBoostUsedCount: number;
  readonly lastAccruedAtMs: number;
  readonly boostEndsAtMs: number | null;
  readonly accrualRemainderBoxUnits: number;
  readonly completedRewardKeys: readonly string[];
};

export type StoredRewardState = RewardState & {
  readonly anonymousHash: string;
  readonly lastSavedAt: string;
};

export type BoxOpenOpportunity = {
  readonly anonymousHash: string;
  readonly idempotencyKey: string;
  readonly earnedAtMs: number;
  readonly expiresAtMs: number;
};
```

저장 키:

```ts
export const REWARD_STATE_STORAGE_KEY = "sansokim:v1:reward-state";
export const BOX_OPEN_OPPORTUNITY_STORAGE_KEY =
  "sansokim:v1:box-open-opportunity";
```

`kilomoa`의 `Storage` 패턴을 그대로 사용합니다.

```ts
import { Storage } from "@apps-in-toss/framework";

type StringStorage = {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem?: (key: string) => Promise<void>;
};

export function createJsonStorageGateway<T>(
  storage: StringStorage,
  storageKey: string,
) {
  return {
    async read(): Promise<unknown | null> {
      const rawValue = await storage.getItem(storageKey);
      if (rawValue == null || rawValue === "") {
        return null;
      }

      try {
        return JSON.parse(rawValue) as unknown;
      } catch {
        return null;
      }
    },
    async write(value: T): Promise<void> {
      await storage.setItem(storageKey, JSON.stringify(value));
    },
    async clear(): Promise<void> {
      if (storage.removeItem == null) {
        await storage.setItem(storageKey, "");
        return;
      }

      await storage.removeItem(storageKey);
    },
  };
}

export const rewardStateStorage = createJsonStorageGateway<StoredRewardState>(
  Storage,
  REWARD_STATE_STORAGE_KEY,
);
```

## KST 일자 계산 스니펫

한국 시간은 UTC+9이며 서머타임이 없습니다. 일일 한도와 부스트 사용 횟수는 KST 자정 기준으로 롤오버합니다.

```ts
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

export function getKstDateString(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function rolloverDailyState(
  state: RewardState,
  currentDateKst: string,
): RewardState {
  if (state.stateDateKst === currentDateKst) {
    return state;
  }

  return {
    ...state,
    stateDateKst: currentDateKst,
    dailyPaidTossPoint: 0,
    dailyBoostUsedCount: 0,
  };
}
```

## 시간 적립과 부스트 계산 스니펫

구현 원칙:

- 앱 진입, 포커스 복귀, 광고 보상 적용 전, 상자 열기 전에는 먼저 `accrueBoxes`를 호출해서 지난 시간을 반영합니다.
- 오프라인 적립은 최대 100시간까지만 인정합니다.
- 부스트가 켜진 시간은 2배 속도로 계산합니다.
- 산소 상자는 최대 200개까지만 보관합니다.

```ts
export function accrueBoxes(state: RewardState, nowMs: number): RewardState {
  if (!Number.isFinite(nowMs) || nowMs <= state.lastAccruedAtMs) {
    return state;
  }

  const cappedNowMs = Math.min(
    nowMs,
    state.lastAccruedAtMs + SANSOKIM_POLICY.maxOfflineAccrualMs,
  );
  const elapsedMs = Math.max(0, cappedNowMs - state.lastAccruedAtMs);
  const boostEndsAtMs = state.boostEndsAtMs ?? 0;
  const boostedMs = Math.max(
    0,
    Math.min(cappedNowMs, boostEndsAtMs) - state.lastAccruedAtMs,
  );
  const normalMs = Math.max(0, elapsedMs - boostedMs);
  const earnedBoxUnits =
    normalMs / SANSOKIM_POLICY.boxAccrualIntervalMs +
    (boostedMs / SANSOKIM_POLICY.boxAccrualIntervalMs) *
      SANSOKIM_POLICY.boostMultiplier +
    state.accrualRemainderBoxUnits;
  const earnedBoxCount = Math.floor(earnedBoxUnits);
  const nextBoxCount = Math.min(
    SANSOKIM_POLICY.maxStoredBoxCount,
    state.availableBoxCount + earnedBoxCount,
  );
  const isBoxStorageFull = nextBoxCount >= SANSOKIM_POLICY.maxStoredBoxCount;

  return {
    ...state,
    availableBoxCount: nextBoxCount,
    accrualRemainderBoxUnits: isBoxStorageFull
      ? 0
      : earnedBoxUnits - earnedBoxCount,
    lastAccruedAtMs: nowMs,
  };
}

export function getNextBoxRemainingMs(
  state: RewardState,
  nowMs: number,
): number {
  if (state.availableBoxCount >= SANSOKIM_POLICY.maxStoredBoxCount) {
    return 0;
  }

  const isBoosted = state.boostEndsAtMs != null && state.boostEndsAtMs > nowMs;
  const intervalMs = isBoosted
    ? SANSOKIM_POLICY.boxAccrualIntervalMs / SANSOKIM_POLICY.boostMultiplier
    : SANSOKIM_POLICY.boxAccrualIntervalMs;
  const remainderMs = state.accrualRemainderBoxUnits * intervalMs;

  return Math.max(0, intervalMs - remainderMs);
}
```

부스트 적용:

```ts
export type BoostApplyResult =
  | { readonly type: "applied"; readonly state: RewardState }
  | { readonly type: "blocked"; readonly reason: "dailyLimitReached" };

export function applyBoostAfterRewardAd(
  state: RewardState,
  nowMs: number,
): BoostApplyResult {
  const accruedState = accrueBoxes(state, nowMs);

  if (
    accruedState.dailyBoostUsedCount >= SANSOKIM_POLICY.maxDailyBoostUseCount
  ) {
    return { type: "blocked", reason: "dailyLimitReached" };
  }

  const currentBoostEnd = accruedState.boostEndsAtMs ?? nowMs;
  const extensionBaseMs = Math.max(nowMs, currentBoostEnd);

  return {
    type: "applied",
    state: {
      ...accruedState,
      boostEndsAtMs: extensionBaseMs + SANSOKIM_POLICY.boostDurationMs,
      dailyBoostUsedCount: accruedState.dailyBoostUsedCount + 1,
      lastAccruedAtMs: nowMs,
    },
  };
}
```

## 상자 4회 탭 스니펫

`kilomoa/src/domain/renewalPolicy.ts`의 `applyBoxTap` 구조를 산소킴에 맞게 재사용합니다.

```ts
export type BoxOpenTapState = {
  readonly validTapCount: number;
  readonly firstTapAtMs: number | null;
  readonly lastAcceptedTapAtMs: number | null;
};

export type BoxOpenTapResult =
  | { readonly type: "accepted"; readonly state: BoxOpenTapState }
  | {
      readonly type: "ignored";
      readonly reason: "tooFast";
      readonly state: BoxOpenTapState;
    }
  | { readonly type: "expired"; readonly state: BoxOpenTapState }
  | { readonly type: "completed"; readonly state: BoxOpenTapState };

export function createInitialBoxOpenTapState(): BoxOpenTapState {
  return {
    validTapCount: 0,
    firstTapAtMs: null,
    lastAcceptedTapAtMs: null,
  };
}

export function applyBoxTap(
  state: BoxOpenTapState,
  tappedAtMs: number,
): BoxOpenTapResult {
  if (!Number.isFinite(tappedAtMs)) {
    return { type: "ignored", reason: "tooFast", state };
  }

  const resetState = createInitialBoxOpenTapState();
  const hasStarted = state.firstTapAtMs != null;

  if (
    hasStarted &&
    tappedAtMs - state.firstTapAtMs >
      SANSOKIM_POLICY.boxTapSessionExpiresInMs
  ) {
    return {
      type: "expired",
      state: {
        ...resetState,
        validTapCount: 1,
        firstTapAtMs: tappedAtMs,
        lastAcceptedTapAtMs: tappedAtMs,
      },
    };
  }

  if (
    state.lastAcceptedTapAtMs != null &&
    tappedAtMs - state.lastAcceptedTapAtMs <
      SANSOKIM_POLICY.boxTapMinIntervalMs
  ) {
    return { type: "ignored", reason: "tooFast", state };
  }

  const nextTapCount = state.validTapCount + 1;
  const nextState = {
    validTapCount: nextTapCount,
    firstTapAtMs: state.firstTapAtMs ?? tappedAtMs,
    lastAcceptedTapAtMs: tappedAtMs,
  };

  if (nextTapCount >= SANSOKIM_POLICY.boxTapRequiredCount) {
    return { type: "completed", state: resetState };
  }

  return { type: "accepted", state: nextState };
}
```

## 사용자 식별키 스니펫

비게임 미니앱이므로 `getAnonymousKey`만 사용합니다. 게임 전용 `getUserKeyForGame`을 사용하지 않습니다.

```ts
import { getAnonymousKey } from "@apps-in-toss/framework";

export type AnonymousKeyResult =
  | { readonly type: "ready"; readonly hash: string }
  | {
      readonly type: "unavailable";
      readonly reason: "unsupportedVersion" | "invalidCategory" | "unknownError";
    };

export async function getCurrentAnonymousKeyResult(): Promise<AnonymousKeyResult> {
  try {
    const result = await getAnonymousKey();

    if (result == null) {
      return { type: "unavailable", reason: "unsupportedVersion" };
    }

    if (result === "INVALID_CATEGORY") {
      return { type: "unavailable", reason: "invalidCategory" };
    }

    if (result === "ERROR") {
      return { type: "unavailable", reason: "unknownError" };
    }

    return { type: "ready", hash: result.hash };
  } catch {
    return { type: "unavailable", reason: "unknownError" };
  }
}
```

## 보상형 광고 게이트웨이 스니펫

`kilomoa/src/adapters/tossRewardAdGateway.ts`의 형태를 유지합니다.

중요 원칙:

- `loadFullScreenAd.isSupported()`와 `showFullScreenAd.isSupported()`를 확인합니다.
- `loadFullScreenAd`의 `loaded` 이벤트 후에만 `showFullScreenAd`를 호출합니다.
- `showFullScreenAd`의 `userEarnedReward` 이벤트만 보상 성공으로 처리합니다.
- `dismissed`는 보상 실패로 처리합니다.
- 컴포넌트 언마운트 시 콜백 등록 해제 함수가 호출되도록 구성합니다.

```ts
import {
  loadFullScreenAd,
  showFullScreenAd,
  type ShowFullScreenAdEvent,
} from "@apps-in-toss/framework";

export type RewardAdLoadResult =
  | { readonly type: "loaded" }
  | { readonly type: "failed" };

export type RewardedAdResult =
  | { readonly type: "earnedReward" }
  | { readonly type: "dismissed" }
  | { readonly type: "failed" };

export type RewardAdGateway = {
  readonly load: () => Promise<RewardAdLoadResult>;
  readonly show: () => Promise<RewardedAdResult>;
};

export function createTossRewardAdGateway(adGroupId: string): RewardAdGateway {
  let loadedAdGroupId: string | null = null;

  return {
    async load(): Promise<RewardAdLoadResult> {
      if (loadedAdGroupId != null) {
        return { type: "loaded" };
      }

      const result = await loadTossRewardAd(adGroupId);
      loadedAdGroupId = result.type === "loaded" ? adGroupId : null;
      return result;
    },
    async show(): Promise<RewardedAdResult> {
      if (loadedAdGroupId == null) {
        return { type: "failed" };
      }

      const currentAdGroupId = loadedAdGroupId;
      loadedAdGroupId = null;
      return showTossRewardAd(currentAdGroupId);
    },
  };
}

function loadTossRewardAd(adGroupId: string): Promise<RewardAdLoadResult> {
  return new Promise((resolve) => {
    let settled = false;
    let unregister: () => void = () => undefined;
    const settle = (result: RewardAdLoadResult) => {
      if (settled) {
        return;
      }

      settled = true;
      unregister();
      resolve(result);
    };

    if (loadFullScreenAd.isSupported() !== true) {
      settle({ type: "failed" });
      return;
    }

    try {
      unregister = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === "loaded") {
            settle({ type: "loaded" });
          }
        },
        onError: () => settle({ type: "failed" }),
      });
    } catch {
      settle({ type: "failed" });
    }
  });
}

function showTossRewardAd(adGroupId: string): Promise<RewardedAdResult> {
  return new Promise((resolve) => {
    let settled = false;
    let unregister: () => void = () => undefined;
    const settle = (result: RewardedAdResult) => {
      if (settled) {
        return;
      }

      settled = true;
      unregister();
      resolve(result);
    };

    if (showFullScreenAd.isSupported() !== true) {
      settle({ type: "failed" });
      return;
    }

    try {
      unregister = showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          const result = toRewardedAdResult(event);
          if (result != null) {
            settle(result);
          }
        },
        onError: () => settle({ type: "failed" }),
      });
    } catch {
      settle({ type: "failed" });
    }
  });
}

function toRewardedAdResult(
  event: ShowFullScreenAdEvent,
): RewardedAdResult | null {
  if (event.type === "userEarnedReward") {
    return { type: "earnedReward" };
  }

  if (event.type === "dismissed") {
    return { type: "dismissed" };
  }

  if (event.type === "failedToShow") {
    return { type: "failed" };
  }

  return null;
}
```

광고 그룹 ID는 개발 중 테스트 ID를 사용합니다.

```ts
export const BOX_OPEN_OPPORTUNITY_REWARD_AD_GROUP_ID =
  "ait-ad-test-rewarded-id";
export const BOOST_REWARD_AD_GROUP_ID = "ait-ad-test-rewarded-id";
```

운영 전에는 앱인토스 콘솔에서 발급받은 리워드 광고 그룹 ID로 교체합니다. 상자 열기 기회와 부스트는 보상 내용이 다르므로, 콘솔 운영에서는 별도 광고 그룹으로 분리하는 것을 권장합니다.

## 상자 열기 기회 처리 스니펫

광고 시청 완료 후 상자 열기 기회 1회를 지급합니다. 이미 기회가 있으면 추가 지급하지 않습니다.

```ts
export function createBoxOpenOpportunity(params: {
  readonly anonymousHash: string;
  readonly nowMs: number;
}): BoxOpenOpportunity {
  return {
    anonymousHash: params.anonymousHash,
    idempotencyKey: `sansokim:box-open:${params.anonymousHash}:${params.nowMs}`,
    earnedAtMs: params.nowMs,
    expiresAtMs: params.nowMs + 24 * 60 * 60 * 1_000,
  };
}

export async function requestBoxOpenOpportunity(params: {
  readonly anonymousHash: string;
  readonly currentOpportunity: BoxOpenOpportunity | null;
  readonly rewardAdGateway: RewardAdGateway;
  readonly nowMs: number;
}): Promise<
  | { readonly type: "granted"; readonly opportunity: BoxOpenOpportunity }
  | { readonly type: "blocked"; readonly reason: "alreadyActive" }
  | { readonly type: "failed"; readonly reason: "adLoadFailed" | "adNotCompleted" }
> {
  if (params.currentOpportunity != null) {
    return { type: "blocked", reason: "alreadyActive" };
  }

  const loadResult = await params.rewardAdGateway.load();
  if (loadResult.type !== "loaded") {
    return { type: "failed", reason: "adLoadFailed" };
  }

  const showResult = await params.rewardAdGateway.show();
  if (showResult.type !== "earnedReward") {
    return { type: "failed", reason: "adNotCompleted" };
  }

  return {
    type: "granted",
    opportunity: createBoxOpenOpportunity({
      anonymousHash: params.anonymousHash,
      nowMs: params.nowMs,
    }),
  };
}
```

## 부스트 요청 처리 스니펫

광고 시청 완료 후 부스트를 적용합니다. 광고를 보지 않았거나 닫은 경우에는 부스트를 적용하지 않습니다.

```ts
export async function requestBoost(params: {
  readonly rewardState: RewardState;
  readonly rewardAdGateway: RewardAdGateway;
  readonly nowMs: number;
}): Promise<
  | { readonly type: "applied"; readonly state: RewardState }
  | { readonly type: "blocked"; readonly reason: "dailyLimitReached" }
  | { readonly type: "failed"; readonly reason: "adLoadFailed" | "adNotCompleted" }
> {
  if (
    params.rewardState.dailyBoostUsedCount >=
    SANSOKIM_POLICY.maxDailyBoostUseCount
  ) {
    return { type: "blocked", reason: "dailyLimitReached" };
  }

  const loadResult = await params.rewardAdGateway.load();
  if (loadResult.type !== "loaded") {
    return { type: "failed", reason: "adLoadFailed" };
  }

  const showResult = await params.rewardAdGateway.show();
  if (showResult.type !== "earnedReward") {
    return { type: "failed", reason: "adNotCompleted" };
  }

  return applyBoostAfterRewardAd(params.rewardState, params.nowMs);
}
```

## 토스 포인트 지급 게이트웨이 스니펫

비게임 미니앱이므로 `grantPromotionReward`를 사용합니다. 게임 전용 `grantPromotionRewardForGame`을 사용하지 않습니다.

```ts
import { grantPromotionReward } from "@apps-in-toss/framework";

export type TossPointGrantResult =
  | { readonly type: "success"; readonly tossSuccessKey: string }
  | {
      readonly type: "failed";
      readonly reason:
        | "unsupportedVersion"
        | "promotionError"
        | "budgetExhausted"
        | "ambiguousUnknown";
    };

export function createTossPointPromotionGateway(params: {
  readonly promotionCode: string;
}) {
  return {
    async grantTossPoint(pointAmount: number): Promise<TossPointGrantResult> {
      if (!Number.isInteger(pointAmount) || pointAmount <= 0) {
        return { type: "failed", reason: "promotionError" };
      }

      try {
        const rawResult = await grantPromotionReward({
          params: {
            promotionCode: params.promotionCode,
            amount: pointAmount,
          },
        });

        return toTossPointGrantResult(rawResult);
      } catch {
        return { type: "failed", reason: "ambiguousUnknown" };
      }
    },
  };
}

function toTossPointGrantResult(input: unknown): TossPointGrantResult {
  if (input == null) {
    return { type: "failed", reason: "unsupportedVersion" };
  }

  if (input === "ERROR") {
    return { type: "failed", reason: "ambiguousUnknown" };
  }

  if (!isRecord(input)) {
    return { type: "failed", reason: "ambiguousUnknown" };
  }

  const successKey =
    typeof input.key === "string" ? input.key : input.successKey;

  if (typeof successKey === "string" && successKey !== "") {
    return { type: "success", tossSuccessKey: successKey };
  }

  if (typeof input.errorCode === "string") {
    if (input.errorCode === "4109" || input.errorCode === "4112") {
      return { type: "failed", reason: "budgetExhausted" };
    }

    return { type: "failed", reason: "promotionError" };
  }

  return { type: "failed", reason: "ambiguousUnknown" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

프로모션 코드는 콘솔 발급값으로 분리합니다.

```ts
export const rewardPromotionConfig = {
  promotionCode: "REPLACE_WITH_TOSS_PROMOTION_CODE",
} as const;
```

개발 검증 시에는 공식 문서 기준으로 `TEST_{promotionCode}` 형태의 테스트 프로모션 코드를 사용합니다. 테스트 프로모션 호출은 샌드박스 앱이 아니라 토스앱 QR 코드 테스트에서 진행해야 합니다.

## 상자 열기와 포인트 지급 순서

가장 중요한 원칙은 토스 포인트 지급 성공 후에만 로컬 상태를 차감하는 것입니다.

처리 순서:

```text
1. 앱 상태 저장 중이면 무시
2. 상자 열기 기회가 없으면 무시
3. 보유 상자가 0개면 안내
4. 오늘 지급 금액이 100원 이상이면 안내
5. 상자 탭을 4회 완료하면 지급 플로우 시작
6. 중복 탭 방지를 위해 isBoxOpenCrediting = true
7. grantPromotionReward({ promotionCode, amount: 1 }) 호출
8. 성공 시에만 보유 상자 -1, 오늘 지급 +1, completedRewardKeys 추가, 상자 열기 기회 삭제
9. 실패 시에는 보유 상자와 상자 열기 기회를 유지
10. isBoxOpenCrediting = false
```

도메인 스니펫:

```ts
export type BoxOpenDecision =
  | { readonly type: "ready"; readonly amount: number }
  | {
      readonly type: "blocked";
      readonly reason:
        | "noOpportunity"
        | "emptyBox"
        | "dailyLimitReached"
        | "duplicateReward";
    };

export function getBoxOpenDecision(params: {
  readonly state: RewardState;
  readonly opportunity: BoxOpenOpportunity | null;
}): BoxOpenDecision {
  if (params.opportunity == null) {
    return { type: "blocked", reason: "noOpportunity" };
  }

  if (params.state.availableBoxCount <= 0) {
    return { type: "blocked", reason: "emptyBox" };
  }

  if (
    params.state.dailyPaidTossPoint >= SANSOKIM_POLICY.maxDailyTossPoint
  ) {
    return { type: "blocked", reason: "dailyLimitReached" };
  }

  return {
    type: "ready",
    amount: SANSOKIM_POLICY.tossPointPerBoxOpen,
  };
}

export function applyTossPointGrantSuccess(params: {
  readonly state: RewardState;
  readonly tossSuccessKey: string;
}): RewardState {
  if (params.state.completedRewardKeys.includes(params.tossSuccessKey)) {
    return params.state;
  }

  return {
    ...params.state,
    availableBoxCount: Math.max(0, params.state.availableBoxCount - 1),
    dailyPaidTossPoint: Math.min(
      SANSOKIM_POLICY.maxDailyTossPoint,
      params.state.dailyPaidTossPoint + SANSOKIM_POLICY.tossPointPerBoxOpen,
    ),
    completedRewardKeys: appendCompletedRewardKey(
      params.state.completedRewardKeys,
      params.tossSuccessKey,
    ),
  };
}

function appendCompletedRewardKey(
  keys: readonly string[],
  key: string,
): readonly string[] {
  return [...keys, key].slice(-SANSOKIM_POLICY.maxCompletedRewardKeyCount);
}
```

컨트롤러 스니펫:

```ts
export async function executeBoxOpenPayout(params: {
  readonly state: RewardState;
  readonly opportunity: BoxOpenOpportunity | null;
  readonly promotionGateway: {
    readonly grantTossPoint: (amount: number) => Promise<TossPointGrantResult>;
  };
  readonly nowMs: number;
}): Promise<
  | { readonly type: "success"; readonly state: RewardState }
  | { readonly type: "blocked"; readonly reason: BoxOpenDecision["reason"] }
  | { readonly type: "failed"; readonly reason: TossPointGrantResult["reason"] }
> {
  const accruedState = accrueBoxes(params.state, params.nowMs);
  const decision = getBoxOpenDecision({
    state: accruedState,
    opportunity: params.opportunity,
  });

  if (decision.type === "blocked") {
    return { type: "blocked", reason: decision.reason };
  }

  const grantResult = await params.promotionGateway.grantTossPoint(
    decision.amount,
  );

  if (grantResult.type === "failed") {
    return { type: "failed", reason: grantResult.reason };
  }

  return {
    type: "success",
    state: applyTossPointGrantSuccess({
      state: accruedState,
      tossSuccessKey: grantResult.tossSuccessKey,
    }),
  };
}
```

실제 UI에서는 성공 시 `clearBoxOpenOpportunity()`를 호출하고, 실패 시에는 기회를 유지합니다. 다만 `ambiguousUnknown`은 SDK 결과를 확정할 수 없는 상태이므로 사용자에게 재시도 안내를 신중하게 보여줍니다.

## 홈 화면 구현 메모

`kilomoa/src/components/HomeScreen.tsx`의 `RewardBoxRow`를 산소킴에 맞게 변형합니다.

유지할 패턴:

- `Animated.Value`로 상자 흔들림
- `Animated.Value`로 탭 눌림 효과
- 기회가 있을 때 ping/ring 효과
- `Pressable`의 `accessibilityRole`, `accessibilityLabel`, `accessibilityState`
- `validTapCount`를 로컬 state/ref로 관리
- `applyBoxTap` 결과가 `completed`일 때만 지급 요청 dispatch

산소킴에서 바꿀 내용:

- `골드 지갑` 버튼을 `포인트 내역` 버튼으로 변경
- `일반 상자` 문구를 `산소 상자`로 변경
- `골드` 문구 제거
- 카드 하단에 `상자 열기 기회 받기`, `2시간 부스트 받기` 버튼 배치
- 버튼 아래 CTA 설명 문구 추가

상태별 안내 문구 예시:

```ts
export const sansokimMessages = {
  noOpportunity: "상자 열기 기회를 받아주세요",
  opportunityReady: "상자를 4번 터치해서 열어보세요",
  emptyBox: "보유한 산소 상자가 없어요",
  dailyLimitReached: "오늘 받을 수 있는 토스 포인트를 모두 받았어요",
  payoutPending: "토스 포인트를 지급하고 있어요",
  opportunityButton: "상자 열기 기회 받기",
  opportunityCta: "광고 시청 후 상자 열기 기회 1회 지급",
  boostButton: "2시간 부스트 받기",
  boostCta: "광고 시청 후 부스트 적용",
  promotionNotice: "본 프로모션은 예산 소진 등으로 사전 고지 없이 중단될 수 있어요",
} as const;
```

## 포인트 화면 구현 메모

포인트 화면은 홈에서 `포인트 내역` 버튼을 눌렀을 때 열립니다. `kilomoa`의 포인트 화면 이동 방식과 라우팅 패턴을 참고합니다.

필수 표시:

```text
오늘의 누적 획득 토스 포인트
7원 / 100
매일 자정 기준으로 한도 100원까지 모을 수 있어요

보유 상자
18개 / 200

오늘 부스트 사용
3회 / 12
```

게이지 계산:

```ts
export function getDailyPointProgress(state: RewardState): number {
  return Math.min(
    1,
    Math.max(0, state.dailyPaidTossPoint / SANSOKIM_POLICY.maxDailyTossPoint),
  );
}

export function getBoxStorageProgress(state: RewardState): number {
  return Math.min(
    1,
    Math.max(0, state.availableBoxCount / SANSOKIM_POLICY.maxStoredBoxCount),
  );
}

export function getDailyBoostProgress(state: RewardState): number {
  return Math.min(
    1,
    Math.max(
      0,
      state.dailyBoostUsedCount / SANSOKIM_POLICY.maxDailyBoostUseCount,
    ),
  );
}
```

## 구현 순서

1. `src/domain/sansokimPolicy.ts` 추가
2. `src/domain/sansokimRewardPolicy.ts` 추가
   - 상태 타입
   - KST 롤오버
   - 시간 적립
   - 부스트 적용
   - 상자 탭
   - 포인트 지급 성공 반영
3. `src/domain/boxOpenOpportunity.ts` 추가
4. `src/storage/rewardStateStorage.ts` 추가
5. `src/storage/boxOpenOpportunityStorage.ts` 추가
6. `src/rewardIdentity.ts` 추가
7. `src/adapters/tossRewardAdGateway.ts` 추가
8. `src/adapters/tossPointPromotionGateway.ts` 추가
9. `src/rewardApp.ts` 또는 홈 컨테이너 상태 관리 추가
10. `src/components/HomeScreen.tsx` 구현
11. `src/components/PointScreen.tsx` 구현
12. `pages/index.tsx`에서 부트스트랩, 저장 복원, 이벤트 핸들러 연결
13. 광고 테스트 ID로 QR 테스트
14. 테스트 프로모션 코드로 QR 테스트
15. 운영 광고 그룹 ID와 운영 프로모션 코드로 교체

## 테스트 계획

도메인 테스트:

- 최초 상태 생성 시 보유 상자 0, 오늘 지급 0, 부스트 0회
- 1시간 경과 시 상자 1개 적립
- 100시간 초과 오프라인 시 최대 100시간까지만 적립
- 보유 상자는 200개를 초과하지 않음
- 부스트 2시간 적용 시 2시간 동안 상자 4개 적립
- 부스트 중 추가 적용 시 종료 시간이 2시간 누적 연장
- 하루 부스트 12회 초과 시 차단
- KST 날짜가 바뀌면 오늘 지급 금액과 부스트 사용 횟수 리셋
- 상자 탭은 4회 완료 시에만 `completed`
- 너무 빠른 탭은 `ignored`
- 탭 세션이 10초를 넘으면 새 세션으로 재시작
- 상자 기회 없으면 지급 차단
- 보유 상자 0개면 지급 차단
- 오늘 지급 100원 이상이면 지급 차단
- 포인트 지급 성공 key 중복이면 상태 중복 반영 안 함

어댑터 테스트:

- `getAnonymousKey`가 `undefined`면 `unsupportedVersion`
- `getAnonymousKey`가 `INVALID_CATEGORY`면 `invalidCategory`
- `grantPromotionReward`가 `{ key }`면 성공
- `grantPromotionReward`가 `4109` 또는 `4112`면 예산 부족 계열 실패
- `grantPromotionReward`가 `ERROR`면 모호한 실패
- 광고 `userEarnedReward`만 보상 성공
- 광고 `dismissed`는 보상 실패
- 광고 `failedToShow`는 보상 실패

수동 QA:

- 광고는 샌드박스가 아니라 콘솔 QR 코드로 테스트
- 개발 단계에서는 테스트 광고 ID 사용
- 테스트 프로모션 코드는 토스앱 QR 코드에서 호출
- 상자 열기 기회가 있을 때만 상자가 활성화되는지 확인
- 토스 포인트 지급 성공 후에만 상자와 기회가 차감되는지 확인
- 포인트 화면 게이지가 `x원 / 100`, `x개 / 200`, `x회 / 12`와 일치하는지 확인

## 출시 전 체크리스트

- 앱 카테고리가 비게임인지 확인
- `getAnonymousKey` 호출이 정상 동작하는지 QR 테스트
- 프로모션 콘솔에서 사업자 정보, 정산 정보, 비즈 월렛, 예산 설정 확인
- 프로모션 이름과 지급 조건이 명확한지 확인
- 지급 시점, 지급 조건, 지급 제한, 중단 가능 문구 고지
- 자체 보상을 `포인트`라고 부르지 않았는지 확인
- 랜덤, 뽑기, 당첨, 현금, 출금 표현이 없는지 확인
- `grantPromotionReward` 중복 호출 방어 적용
- 하루 100원 제한 적용
- 테스트 프로모션 코드로 최소 1회 이상 QR 테스트
- 실제 광고 ID로 개발 테스트하지 않기
- 광고 버튼은 사용자가 자발적으로 누르는 흐름인지 확인
- 광고 클릭 보상 문구가 없는지 확인
- `userEarnedReward` 외 이벤트로 보상을 주지 않는지 확인

## 남은 결정 사항

아래 값은 구현 전 콘솔에서 발급받아 코드에 넣어야 합니다.

- 운영 프로모션 코드
- 상자 열기 기회용 리워드 광고 그룹 ID
- 부스트용 리워드 광고 그룹 ID

운영 전에는 모두 테스트 값으로 시작합니다.
