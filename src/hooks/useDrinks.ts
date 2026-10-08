"use client";

import useSWR from "swr";
import { config } from "@/config";
import { apiFetch } from "@/lib/api";
import { alcoholGrams } from "@/lib/bac";
import type { DrinkInput, DrinkLog } from "@/lib/store/types";
import { useIdentity } from "./useProfile";

/** This device's drink log, newest first, with optimistic add/remove. */
export function useDrinks() {
  const identity = useIdentity();
  const { data, error, isLoading, mutate } = useSWR<DrinkLog[]>(
    identity ? "/api/drinks" : null,
    (path: string) => apiFetch<DrinkLog[]>(path),
    { refreshInterval: config.pollIntervalMs },
  );

  async function addDrink(input: DrinkInput) {
    const optimistic: DrinkLog = {
      ...input,
      alcoholG:
        input.volumeOz != null && input.abv != null
          ? alcoholGrams(input.volumeOz, input.abv)
          : input.alcoholG,
      id: `pending-${crypto.randomUUID()}`,
      profileId: identity?.id ?? "",
      consumedAt: new Date().toISOString(),
    };
    await mutate(
      async (current = []) => {
        const created = await apiFetch<DrinkLog>("/api/drinks", { method: "POST", body: input });
        return [created, ...current];
      },
      {
        optimisticData: (current = []) => [optimistic, ...current],
        rollbackOnError: true,
        revalidate: false,
      },
    );
  }

  async function removeDrink(id: string) {
    await mutate(
      async (current = []) => {
        await apiFetch(`/api/drinks/${id}`, { method: "DELETE" });
        return current.filter((drink) => drink.id !== id);
      },
      {
        optimisticData: (current = []) => current.filter((drink) => drink.id !== id),
        rollbackOnError: true,
        revalidate: false,
      },
    );
  }

  return { drinks: data, error, isLoading, addDrink, removeDrink };
}
