import type { LocationSource, MediaType, ScheduleEvent } from "./store/types";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ResolvedLocation extends Coordinates {
  source: LocationSource;
}

/** Valid coordinates from untrusted input, or null. */
export function parseCoordinates(value: unknown): Coordinates | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  const ok = (n: unknown, limit: number): n is number =>
    typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit;
  return ok(lat, 90) && ok(lng, 180) ? { lat, lng } : null;
}

/**
 * Picks where a post goes on the map. In order: the photo's own GPS tag, the
 * event the poster tagged (their explicit choice beats wherever the phone
 * happens to be), then the device's location at upload time. Videos never use EXIF.
 */
export function resolveLocation(options: {
  mediaType: MediaType;
  exif: Coordinates | null;
  event: Pick<ScheduleEvent, "lat" | "lng"> | null;
  device: Coordinates | null;
}): ResolvedLocation | null {
  const { mediaType, exif, event, device } = options;
  if (mediaType === "image" && exif) return { ...exif, source: "exif" };
  if (event && event.lat !== null && event.lng !== null) {
    return { lat: event.lat, lng: event.lng, source: "event" };
  }
  if (device) return { ...device, source: "device" };
  return null;
}
