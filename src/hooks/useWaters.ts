"use client";

import useSWR from "swr";
import { config } from "@/config";
import { apiFetch } from "@/lib/api";
import type { LoggedWater } from "@/lib/store/types";
import { useIdentity } from "./useProfile";

/** This person's logged waters, newest first. */
export function useWaters() {
  const identity = useIdentity();
  const { data, mutate } = useSWR<LoggedWater[]>(
    identity ? "/api/waters" : null,
    (path: string) => apiFetch<LoggedWater[]>(path),
    { refreshInterval: config.pollIntervalMs },
  );

  async function addWater() {
    await mutate(
      async (current = []) => {
        const created = await apiFetch<LoggedWater>("/api/waters", { method: "POST" });
        return [created, ...current];
      },
      { revalidate: false },
    );
  }

  async function removeWater(id: string) {
    await mutate(
      async (current = []) => {
        await apiFetch(`/api/waters/${id}`, { method: "DELETE" });
        return current.filter((water) => water.id !== id);
      },
      {
        optimisticData: (current = []) => current.filter((water) => water.id !== id),
        rollbackOnError: true,
        revalidate: false,
      },
    );
  }

  return { waters: data, addWater, removeWater };
}
