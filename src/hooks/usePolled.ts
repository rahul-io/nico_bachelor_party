"use client";

import useSWR from "swr";
import { config } from "@/config";
import { apiFetch } from "@/lib/api";

/** GET `path` and keep it fresh on the app-wide polling interval. Pass null to skip. */
export function usePolled<T>(path: string | null) {
  return useSWR<T>(path, (key: string) => apiFetch<T>(key), {
    refreshInterval: config.pollIntervalMs,
  });
}
