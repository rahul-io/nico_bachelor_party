"use client";

import { useState } from "react";
import useSWR from "swr";
import { config } from "@/config";
import { apiFetch } from "@/lib/api";
import { alcoholGrams } from "@/lib/bac";
import type { DrinkInput, LoggedDrink } from "@/lib/store/types";
import { useIdentity } from "./useProfile";

/** This device's drink log, newest first, with optimistic add/remove. */
export function useDrinks() {
  const identity = useIdentity();
  const [spin, setSpin] = useState<LoggedDrink["slot"]>(null);
  const { data, error, isLoading, mutate } = useSWR<LoggedDrink[]>(
    identity ? "/api/drinks" : null,
    (path: string) => apiFetch<LoggedDrink[]>(path),
    { refreshInterval: config.pollIntervalMs },
  );

  async function addDrink(input: DrinkInput) {
    const optimistic: LoggedDrink = {
      ...input,
      category: input.category ?? null,
      points: null,
      pointsLine: null,
      alcoholG:
        input.volumeOz != null && input.abv != null
          ? alcoholGrams(input.volumeOz, input.abv)
          : input.alcoholG,
      id: `pending-${crypto.randomUUID()}`,
      profileId: identity?.id ?? "",
      consumedAt: new Date().toISOString(),
    };
    let logged: LoggedDrink | null = null;
    await mutate(
      async (current = []) => {
        const created = await apiFetch<LoggedDrink>("/api/drinks", { method: "POST", body: input });
        logged = created;
        return [created, ...current];
      },
      {
        optimisticData: (current = []) => [optimistic, ...current],
        rollbackOnError: true,
        revalidate: false,
      },
    );
    // The reply carries the slot machine's result for this drink.
    setSpin((logged as LoggedDrink | null)?.slot ?? null);
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

  return { drinks: data, error, isLoading, addDrink, removeDrink, spin, clearSpin: () => setSpin(null) };
}
