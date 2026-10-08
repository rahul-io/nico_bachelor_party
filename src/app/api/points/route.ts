import { connection } from "next/server";
import { displayStore } from "@/lib/games/curses";
import { buildPointsHistory } from "@/lib/leaderboard";
import { pointsBySource, settleDue } from "@/lib/points/service";
import { getStore } from "@/lib/store";

/** The ledger. With ?profile=<id>, one person's entries and their points by source. */
export async function GET(req: Request) {
  await connection();
  const store = displayStore(getStore());
  await settleDue(store);

  const profileId = new URL(req.url).searchParams.get("profile");
  if (!profileId) return Response.json(await buildPointsHistory(store));

  const [entries, all] = await Promise.all([
    buildPointsHistory(store, profileId, 60),
    store.listPointEvents(profileId),
  ]);
  return Response.json({ bySource: pointsBySource(all), entries });
}
