import { Storage } from "@apps-in-toss/framework";

import type { BoxOpenOpportunity } from "../domain/boxOpenOpportunity";

export const BOX_OPEN_OPPORTUNITY_STORAGE_KEY =
  "sansokim:v1:box-open-opportunity";

type StringStorage = {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem?: (key: string) => Promise<void>;
};

export type BoxOpenOpportunityStorageGateway = {
  readonly read: () => Promise<unknown | null>;
  readonly write: (opportunity: BoxOpenOpportunity) => Promise<void>;
  readonly clear: () => Promise<void>;
};

export function createBoxOpenOpportunityStorageGateway(
  storage: StringStorage,
  storageKey: string = BOX_OPEN_OPPORTUNITY_STORAGE_KEY,
): BoxOpenOpportunityStorageGateway {
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
    async write(opportunity: BoxOpenOpportunity): Promise<void> {
      await storage.setItem(storageKey, JSON.stringify(opportunity));
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

const boxOpenOpportunityStorageGateway =
  createBoxOpenOpportunityStorageGateway(Storage);

export async function readBoxOpenOpportunity(): Promise<unknown | null> {
  return boxOpenOpportunityStorageGateway.read();
}

export async function writeBoxOpenOpportunity(
  opportunity: BoxOpenOpportunity,
): Promise<void> {
  await boxOpenOpportunityStorageGateway.write(opportunity);
}

export async function clearBoxOpenOpportunity(): Promise<void> {
  await boxOpenOpportunityStorageGateway.clear();
}
