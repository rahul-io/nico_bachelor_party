export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Machine-readable reason, when the server gives one (e.g. "gate", "name_taken"). */
    public code?: string,
  ) {
    super(message);
  }
}

/**
 * Client-side fetch for /api/*. Identity travels in httpOnly cookies the page
 * can't read, so there is nothing to attach here.
 */
export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // The invite code changed or the gate cookie expired: back to the gate.
    if (res.status === 401 && data?.code === "gate" && window.location.pathname !== "/gate") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is the point
      window.location.assign("/gate");
    }
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data?.code);
  }
  return data as T;
}
