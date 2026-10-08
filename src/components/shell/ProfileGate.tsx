"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/hooks/useProfile";

/**
 * Sends anyone who isn't signed in to the welcome screen, and anyone whose
 * password was reset to choose a new one, before they see the tabs.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const signedOut = session !== undefined && session.profile === null;
  const mustChange = session?.profile?.mustChangePassword === true;

  useEffect(() => {
    if (signedOut) router.replace("/welcome");
    else if (mustChange) router.replace("/password");
  }, [signedOut, mustChange, router]);

  // Children stay mounted so the page is part of the prerendered shell; they
  // are only hidden for the moment before the redirect happens.
  return <div className={signedOut || mustChange ? "hidden" : "contents"}>{children}</div>;
}
