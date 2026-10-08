import type { Store } from "@/lib/store/types";
import { mergeSettings, type PointsSettings } from "./settings";

const SETTINGS_KEY = "points.settings";

export async function getSettings(store: Store): Promise<PointsSettings> {
  return mergeSettings(await store.getSetting(SETTINGS_KEY));
}

export async function saveSettings(store: Store, overrides: Partial<PointsSettings>): Promise<PointsSettings> {
  await store.setSetting(SETTINGS_KEY, overrides);
  return mergeSettings(overrides);
}
