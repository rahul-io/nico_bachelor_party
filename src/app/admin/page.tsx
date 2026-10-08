"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { ExportCard } from "@/components/admin/ExportCard";
import { ChallengesPanel } from "@/components/admin/ChallengesPanel";
import { PeoplePanel } from "@/components/admin/PeoplePanel";
import { PointsPanel } from "@/components/admin/PointsPanel";
import { SchedulePanel } from "@/components/admin/SchedulePanel";
import { Segmented } from "@/components/ui/Segmented";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

export interface AdminSession {
  authed: boolean;
  loginEnabled: boolean;
  devPassword: boolean;
}

const SESSION_KEY = "/api/admin/session";

const sections = [
  { value: "points", label: "Points" },
  { value: "schedule", label: "Schedule" },
  { value: "challenges", label: "Challenges" },
  { value: "people", label: "People" },
] as const;

type Section = (typeof sections)[number]["value"];

export default function AdminPage() {
  const { data: session, mutate } = useSWR<AdminSession>(SESSION_KEY, (path: string) =>
    apiFetch<AdminSession>(path),
  );
  const [section, setSection] = useState<Section>("points");

  async function logout() {
    await apiFetch("/api/admin/logout", { method: "POST" });
    await mutate();
  }

  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]",
        // The schedule calendar wants room for four day columns on a laptop.
        session?.authed && section === "schedule" ? "max-w-4xl" : "max-w-app",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <Link href="/schedule" className="inline-flex min-h-tap items-center gap-1.5 text-muted">
          <ArrowLeft className="size-5" aria-hidden />
          Back to app
        </Link>
        {session?.authed && (
          <button type="button" onClick={logout} className="inline-flex min-h-tap items-center gap-1.5 text-muted">
            <LogOut className="size-5" aria-hidden />
            Log out
          </button>
        )}
      </div>
      <h1 className="mb-4 font-display text-2xl font-bold">Admin</h1>

      {!session ? (
        <p className="text-muted">Loading…</p>
      ) : !session.authed ? (
        <AdminLogin session={session} onLoggedIn={() => mutate()} />
      ) : (
        <div className="space-y-4">
          <Segmented options={sections} value={section} onChange={setSection} label="Admin section" size="sm" />
          {section === "points" && <PointsPanel />}
          {section === "schedule" && <SchedulePanel />}
          {section === "challenges" && <ChallengesPanel />}
          {section === "people" && <PeoplePanel />}
          <div className="mx-auto max-w-app">
            <ExportCard />
          </div>
        </div>
      )}
    </main>
  );
}
