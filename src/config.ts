/** Calendar days of the weekend, in the party timezone. */
const days: readonly string[] = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];

export const config = {
  partyName: "Nico's Bachelor Party",
  shortName: "Nico's Bach",
  location: "San Diego, CA",
  /** All schedule times are shown in this zone, regardless of the phone's. */
  timezone: "America/Los_Angeles",
  days,
  pollIntervalMs: 10_000,
  upload: {
    maxImageBytes: 10 * 1024 * 1024,
    maxVideoBytes: 100 * 1024 * 1024,
  },
} as const;
