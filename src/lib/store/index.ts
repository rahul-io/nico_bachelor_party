import { mockStore } from "./mock";
import type { Store } from "./types";

// M3 adds the Postgres store here, selected when DATABASE_URL is set.
export function getStore(): Store {
  return mockStore;
}
