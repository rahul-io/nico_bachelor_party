import { env } from "@/lib/env";

/** Shown when no database is configured, so nobody mistakes mock data for the real thing. */
export function DemoBanner() {
  if (env.databaseUrl) return null;
  return (
    <p className="bg-sunset px-4 py-1.5 text-center text-xs font-semibold text-navy">
      Demo mode: no database connected, so nothing here is saved.
    </p>
  );
}
