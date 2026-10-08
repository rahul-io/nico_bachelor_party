import { getIdentity } from "./identity";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Client-side fetch for /api/* that attaches this device's identity headers. */
export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const identity = getIdentity();
  if (identity) {
    headers["x-profile-id"] = identity.id;
    headers["x-profile-token"] = identity.token;
  }
  if (init.body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
