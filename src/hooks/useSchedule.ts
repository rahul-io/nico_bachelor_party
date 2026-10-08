"use client";

import useSWR from "swr";
import { config } from "@/config";
import { apiFetch } from "@/lib/api";
import type { ScheduleEvent } from "@/lib/store/types";

export function useSchedule() {
  const { data, error, isLoading } = useSWR<ScheduleEvent[]>(
    "/api/schedule",
    (path: string) => apiFetch<ScheduleEvent[]>(path),
    { refreshInterval: config.pollIntervalMs },
  );
  return { events: data, error, isLoading };
}
