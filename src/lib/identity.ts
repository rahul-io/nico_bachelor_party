/** Which profile this device is "logged in" as. Lives in localStorage. */
export interface Identity {
  id: string;
  token: string;
}

const KEY = "nbp.identity";
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cached: Identity | null = null;

export function getIdentity(): Identity | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Storage unavailable (private mode); treated as not logged in.
  }
  // useSyncExternalStore needs a stable reference while the value is unchanged.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as Identity) : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

export function setIdentity(identity: Identity | null): void {
  try {
    if (identity) window.localStorage.setItem(KEY, JSON.stringify(identity));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeIdentity(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
