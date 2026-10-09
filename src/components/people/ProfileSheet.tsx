"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { TrophyCase } from "@/components/badges/TrophyCase";
import { LedgerList } from "@/components/leaderboard/PointsHistory";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { usePolled } from "@/hooks/usePolled";
import type { TrophyCase as Trophies } from "@/lib/badges/service";
import { formatPoints, sourceLabels } from "@/lib/points/format";
import type { PointHistoryEntry, PointSource, PublicProfile } from "@/lib/store/types";

export interface PersonPage {
  person: PublicProfile;
  total: number;
  bySource: Array<{ source: PointSource; points: number }>;
  entries: PointHistoryEntry[];
  trophies: Trophies;
}

/** One person's public page data. Pass null to skip. */
export function usePerson(id: string | null | undefined) {
  return usePolled<PersonPage>(id ? `/api/people/${id}` : null);
}

const eyebrow = "text-xs font-semibold uppercase tracking-[0.16em] text-accent";

/** A person's profile as everyone sees it: trophy case, points by source, latest entries. */
function PersonSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error } = usePerson(id);

  return (
    <Sheet title={data?.person.name ?? "Crew member"} onClose={onClose}>
      <div className="space-y-5 p-4">
        {!data && <Card className="text-muted">{error ? "Couldn't load. Retrying…" : "Loading…"}</Card>}
        {data && (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={data.person.name} src={data.person.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-2xl font-bold">{data.person.name}</p>
                <p className="text-muted">
                  <span className="font-display text-xl font-bold tabular-nums text-accent">
                    {formatPoints(data.total)}
                  </span>{" "}
                  points
                </p>
              </div>
            </div>

            <TrophyCase trophies={data.trophies} />

            {data.bySource.length > 0 && (
              <section className="space-y-2">
                <h3 className={eyebrow}>Points by source</h3>
                <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                  {data.bySource.map((item) => (
                    <li key={item.source} className="flex items-center justify-between px-4 py-2.5">
                      <span>{sourceLabels[item.source]}</span>
                      <span className="font-display text-lg font-bold tabular-nums text-accent">
                        {formatPoints(item.points)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data.entries.length > 0 && (
              <section className="space-y-2">
                <h3 className={eyebrow}>Latest entries</h3>
                <LedgerList entries={data.entries} showName={false} />
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

const OpenProfile = createContext<(id: string) => void>(() => {});

/** Opens a person's profile from anywhere inside the tabs: `useOpenProfile()(id)`. */
export function useOpenProfile() {
  return useContext(OpenProfile);
}

export function ProfileSheetProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <OpenProfile.Provider value={setOpenId}>
      {children}
      {openId && <PersonSheet id={openId} onClose={() => setOpenId(null)} />}
    </OpenProfile.Provider>
  );
}

/** A name that opens that person's profile when tapped. */
export function PersonLink({ id, name, className }: { id: string; name: string; className?: string }) {
  const open = useOpenProfile();
  return (
    <button type="button" onClick={() => open(id)} className={className ?? "font-semibold"}>
      {name}
    </button>
  );
}
