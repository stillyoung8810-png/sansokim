/// <reference types="jest" />

jest.mock("@apps-in-toss/framework", () => ({
  Storage: {
    getItem: async (): Promise<null> => null,
    setItem: async (): Promise<void> => undefined,
    removeItem: async (): Promise<void> => undefined,
  },
}));

import { createInitialRewardState } from "../domain/sansokimRewardPolicy";
import type { StoredRewardState } from "../domain/sansokimRewardPolicy";
import {
  createRewardStateStorageGateway,
  REWARD_STATE_STORAGE_KEY,
} from "./rewardStateStorage";

type MemoryStringStorage = {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem?: (key: string) => Promise<void>;
};

function createStoredRewardState(): StoredRewardState {
  return {
    ...createInitialRewardState(0),
    anonymousHash: "hash-1",
    lastSavedAt: "2026-06-18T00:00:00.000Z",
  };
}

function createMemoryStorage(params: {
  readonly supportsRemoveItem: boolean;
}): {
  readonly values: Map<string, string>;
  readonly storage: MemoryStringStorage;
} {
  const values = new Map<string, string>();
  const storageWithoutRemoveItem = {
    async getItem(key: string): Promise<string | null> {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      values.set(key, value);
    },
  };

  if (!params.supportsRemoveItem) {
    return { values, storage: storageWithoutRemoveItem };
  }

  return {
    values,
    storage: {
      ...storageWithoutRemoveItem,
      async removeItem(key: string): Promise<void> {
        values.delete(key);
      },
    },
  };
}

describe("rewardStateStorage", () => {
  it("writes and reads reward state JSON with the sansokim storage key", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: true });
    const gateway = createRewardStateStorageGateway(storage);
    const state = createStoredRewardState();

    await gateway.write(state);

    expect(values.get(REWARD_STATE_STORAGE_KEY)).toBe(JSON.stringify(state));
    await expect(gateway.read()).resolves.toEqual(state);
  });

  it("returns null when JSON parsing fails", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: true });
    const gateway = createRewardStateStorageGateway(storage);
    values.set(REWARD_STATE_STORAGE_KEY, "{invalid-json");

    await expect(gateway.read()).resolves.toBeNull();
  });

  it("clears storage with removeItem when available", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: true });
    const gateway = createRewardStateStorageGateway(storage);
    values.set(REWARD_STATE_STORAGE_KEY, JSON.stringify(createStoredRewardState()));

    await gateway.clear();

    expect(values.has(REWARD_STATE_STORAGE_KEY)).toBe(false);
  });

  it("clears storage by writing an empty string without removeItem", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: false });
    const gateway = createRewardStateStorageGateway(storage);
    values.set(REWARD_STATE_STORAGE_KEY, JSON.stringify(createStoredRewardState()));

    await gateway.clear();

    expect(values.get(REWARD_STATE_STORAGE_KEY)).toBe("");
    await expect(gateway.read()).resolves.toBeNull();
  });
});
