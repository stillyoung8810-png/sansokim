import { grantPromotionReward } from "@apps-in-toss/framework";

import { SANSOKIM_POLICY } from "../domain/sansokimPolicy";

export type TossPointPromotionGateway = {
  readonly grantTossPoint: (amount: number) => Promise<TossPointGrantResult>;
};

export type TossPointGrantResult =
  | { readonly type: "success"; readonly tossSuccessKey: string }
  | { readonly type: "failed"; readonly reason: TossPointGrantFailureReason };

export type TossPointGrantFailureReason =
  | "unsupportedVersion"
  | "promotionError"
  | "budgetExhausted"
  | "ambiguousUnknown";

export function createTossPointPromotionGateway(params: {
  readonly promotionCode: string;
}): TossPointPromotionGateway {
  return {
    async grantTossPoint(amount: number): Promise<TossPointGrantResult> {
      if (
        !Number.isInteger(amount) ||
        amount !== SANSOKIM_POLICY.tossPointPerBoxOpen
      ) {
        return { type: "failed", reason: "promotionError" };
      }

      try {
        const rawResult = await grantPromotionReward({
          params: {
            promotionCode: params.promotionCode,
            amount,
          },
        });

        return toTossPointGrantResult(rawResult);
      } catch {
        return { type: "failed", reason: "ambiguousUnknown" };
      }
    },
  };
}

export function toTossPointGrantResult(
  input: unknown,
): TossPointGrantResult {
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
    typeof input.key === "string"
      ? input.key
      : typeof input.successKey === "string"
        ? input.successKey
        : input.tossSuccessKey;

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
