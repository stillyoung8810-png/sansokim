import { getAnonymousKey } from "@apps-in-toss/framework";

export type AnonymousKeyResult =
  | { readonly type: "success"; readonly hash: string }
  | { readonly type: "unavailable"; readonly reason: AnonymousKeyUnavailableReason };

export type AnonymousKeyUnavailableReason =
  | "unsupportedVersion"
  | "invalidCategory"
  | "error"
  | "unknownError";

type GetAnonymousKeyResult =
  | { readonly type: "HASH"; readonly hash: string }
  | "INVALID_CATEGORY"
  | "ERROR"
  | null
  | undefined;

type AnonymousKeyGateway = () => Promise<unknown> | unknown;

export async function getCurrentAnonymousKeyResult(
  gateway: AnonymousKeyGateway = getAnonymousKey,
): Promise<AnonymousKeyResult> {
  try {
    return toAnonymousKeyResult(await gateway());
  } catch {
    return { type: "unavailable", reason: "unknownError" };
  }
}

export function toAnonymousKeyResult(input: unknown): AnonymousKeyResult {
  const result = input as GetAnonymousKeyResult;

  if (result == null) {
    return { type: "unavailable", reason: "unsupportedVersion" };
  }

  if (result === "INVALID_CATEGORY") {
    return { type: "unavailable", reason: "invalidCategory" };
  }

  if (result === "ERROR") {
    return { type: "unavailable", reason: "error" };
  }

  if (
    typeof result === "object" &&
    result.type === "HASH" &&
    typeof result.hash === "string" &&
    result.hash !== ""
  ) {
    return { type: "success", hash: result.hash };
  }

  return { type: "unavailable", reason: "unknownError" };
}
