"use client";

import type { PointsStatus } from "@/lib/points/service";
import { usePolled } from "./usePolled";

/** Running multipliers and the latest award announcements. */
export function usePointsStatus() {
  return usePolled<PointsStatus>("/api/points/status").data;
}
