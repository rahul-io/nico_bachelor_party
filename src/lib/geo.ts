import type { Coordinates } from "./location";

/** Whether this device has agreed to attach its location to posts. Remembered per device. */
export type LocationSharing = "yes" | "no" | "unset";

const KEY = "nbp.shareLocation";
const listeners = new Set<() => void>();

export function getLocationSharing(): LocationSharing {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "yes" || value === "no" ? value : "unset";
  } catch {
    return "unset";
  }
}

export function setLocationSharing(value: "yes" | "no"): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Storage unavailable: the choice just won't be remembered.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeLocationSharing(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Where the device is right now, or null if it can't or won't say. The first
 * call is what makes the browser show its permission prompt.
 */
export function currentPosition(timeoutMs = 6000): Promise<Coordinates | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 2 * 60 * 1000 },
    );
  });
}
