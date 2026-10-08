/** Calendar days of the weekend, in the party timezone. */
const days: readonly string[] = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];

export const config = {
  partyName: "Nico's Bachelor Party",
  shortName: "Nico's Bach",
  location: "San Diego, CA",
  /** All schedule times are shown in this zone, regardless of the phone's. */
  timezone: "America/Los_Angeles",
  /** Where maps open before there is anything to show. */
  mapCenter: { lat: 32.7157, lng: -117.1611 },
  days,
  /**
   * Colours the browser needs outside CSS (manifest, status bar). Must match
   * --color-canvas in globals.css; scripts/make-icons.mjs mirrors the palette too.
   */
  brand: { canvas: "#0b0a12" },
  pollIntervalMs: 10_000,
  /** Share link of the Google Photos album; the button is hidden when unset. */
  albumUrl: process.env.NEXT_PUBLIC_GOOGLE_PHOTOS_ALBUM_URL || null,
  upload: {
    maxImageBytes: 50 * 1024 * 1024,
    maxVideoBytes: 100 * 1024 * 1024,
  },
} as const;
