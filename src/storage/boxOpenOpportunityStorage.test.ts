/// <reference types="jest" />

jest.mock("@apps-in-toss/framework", () => ({
  Storage: {
    getItem: async (): Promise<null> => null,
    setItem: async (): Promise<void> => undefined,
    removeItem: async (): Promise<void> => undefined,
  },
}));

import { createBoxOpenOpportunity } from "../domain/boxOpenOpportunity";
import {
  BOX_OPEN_OPPORTUNITY_STORAGE_KEY,
  createBoxOpenOpportunityStorageGateway,
} from "./boxOpenOpportunityStorage";

type MemoryStringStorage = {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem?: (key: string) => Promise<void>;
};

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

describe("boxOpenOpportunityStorage", () => {
  it("writes and reads opportunity JSON with the sansokim storage key", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: true });
    const gateway = createBoxOpenOpportunityStorageGateway(storage);
    const opportunity = createBoxOpenOpportunity({
      anonymousHash: "hash-1",
      nowMs: 1_000,
    });

    await gateway.write(opportunity);

    expect(values.get(BOX_OPEN_OPPORTUNITY_STORAGE_KEY)).toBe(
      JSON.stringify(opportunity),
    );
    await expect(gateway.read()).resolves.toEqual(opportunity);
  });

  it("returns null when JSON parsing fails", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: true });
    const gateway = createBoxOpenOpportunityStorageGateway(storage);
    values.set(BOX_OPEN_OPPORTUNITY_STORAGE_KEY, "{invalid-json");

    await expect(gateway.read()).resolves.toBeNull();
  });

  it("clears storage with removeItem when available", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: true });
    const gateway = createBoxOpenOpportunityStorageGateway(storage);
    values.set(
      BOX_OPEN_OPPORTUNITY_STORAGE_KEY,
      JSON.stringify(
        createBoxOpenOpportunity({ anonymousHash: "hash-1", nowMs: 1_000 }),
      ),
    );

    await gateway.clear();

    expect(values.has(BOX_OPEN_OPPORTUNITY_STORAGE_KEY)).toBe(false);
  });

  it("clears storage by writing an empty string without removeItem", async () => {
    const { values, storage } = createMemoryStorage({ supportsRemoveItem: false });
    const gateway = createBoxOpenOpportunityStorageGateway(storage);
    values.set(
      BOX_OPEN_OPPORTUNITY_STORAGE_KEY,
      JSON.stringify(
        createBoxOpenOpportunity({ anonymousHash: "hash-1", nowMs: 1_000 }),
      ),
    );

    await gateway.clear();

    expect(values.get(BOX_OPEN_OPPORTUNITY_STORAGE_KEY)).toBe("");
    await expect(gateway.read()).resolves.toBeNull();
  });
});
