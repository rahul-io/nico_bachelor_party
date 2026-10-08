"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import type { Profile } from "@/lib/store/types";

/** Who this device is signed in as. The session itself is an httpOnly cookie the page can't read. */
export const SESSION_KEY = "/api/auth/me";

export interface SessionResponse {
  profile: Profile | null;
}

export function useSession() {
  const { data, error, mutate } = useSWR<SessionResponse>(SESSION_KEY, (path: string) =>
    apiFetch<SessionResponse>(path),
  );
  return { session: data, error, mutate };
}

/** `undefined` while loading, `null` when signed out, otherwise the signed-in profile's id. */
export function useIdentity(): { id: string } | null | undefined {
  const { session } = useSession();
  const loading = session === undefined;
  const id = session?.profile?.id;
  return useMemo(() => (loading ? undefined : id ? { id } : null), [loading, id]);
}

export function useProfile() {
  const { session, mutate } = useSession();
  const identity = useIdentity();
  return { identity, profile: session?.profile ?? undefined, mutate };
}
