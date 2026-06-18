import { Storage } from "@apps-in-toss/framework";

import type { StoredRewardState } from "../domain/sansokimRewardPolicy";

export const REWARD_STATE_STORAGE_KEY = "sansokim:v1:reward-state";

type StringStorage = {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem?: (key: string) => Promise<void>;
};

export type RewardStateStorageGateway = {
  readonly read: () => Promise<unknown | null>;
  readonly write: (state: StoredRewardState) => Promise<void>;
  readonly clear: () => Promise<void>;
};

export function createRewardStateStorageGateway(
  storage: StringStorage,
  storageKey: string = REWARD_STATE_STORAGE_KEY,
): RewardStateStorageGateway {
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
    async write(state: StoredRewardState): Promise<void> {
      await storage.setItem(storageKey, JSON.stringify(state));
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

const rewardStateStorageGateway = createRewardStateStorageGateway(Storage);

export async function readRewardState(): Promise<unknown | null> {
  return rewardStateStorageGateway.read();
}

export async function writeRewardState(
  state: StoredRewardState,
): Promise<void> {
  await rewardStateStorageGateway.write(state);
}

export async function clearRewardState(): Promise<void> {
  await rewardStateStorageGateway.clear();
}
