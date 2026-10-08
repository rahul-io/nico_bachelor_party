import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";
import { mockStore } from "./mock";
import { createPostgresStore, type Sql } from "./postgres";
import type { Store } from "./types";

let postgresStore: Store | undefined;

/** Postgres when DATABASE_URL is set, otherwise the in-memory mock. */
export function getStore(): Store {
  const url = env.databaseUrl;
  if (!url) return mockStore;
  postgresStore ??= createPostgresStore(neon(url) as unknown as Sql);
  return postgresStore;
}
