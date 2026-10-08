"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useIdentity } from "@/hooks/useProfile";

/** Sends first-time visitors to profile creation instead of showing the tabs. */
export function ProfileGate({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (identity === null) router.replace("/profile");
  }, [identity, router]);

  // Children stay mounted so the page is part of the prerendered shell; they
  // are only hidden for the moment before the redirect happens.
  return <div className={identity === null ? "hidden" : "contents"}>{children}</div>;
}
