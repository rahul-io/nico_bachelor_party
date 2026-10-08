"use client";

import { useEffect, useSyncExternalStore } from "react";
import useSWR from "swr";
import { ApiError, apiFetch } from "@/lib/api";
import { getIdentity, setIdentity, subscribeIdentity, type Identity } from "@/lib/identity";
import type { Profile } from "@/lib/store/types";

export const PROFILE_KEY = "/api/profiles/me";

/** `undefined` while hydrating, `null` when this device has no profile yet. */
export function useIdentity(): Identity | null | undefined {
  return useSyncExternalStore(subscribeIdentity, getIdentity, () => undefined);
}

export function useProfile() {
  const identity = useIdentity();
  const { data, error, mutate } = useSWR<Profile>(identity ? PROFILE_KEY : null, (path: string) =>
    apiFetch<Profile>(path),
  );

  // The server no longer knows this profile (deleted, or mock data was reset).
  const unknown = error instanceof ApiError && error.status === 401;
  useEffect(() => {
    if (unknown) setIdentity(null);
  }, [unknown]);

  return { identity, profile: data, mutate };
}
