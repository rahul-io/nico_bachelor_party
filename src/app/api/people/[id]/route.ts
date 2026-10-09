import { buildTrophyCase } from "@/lib/badges/service";
import { displayStore } from "@/lib/games/curses";
import { jsonError } from "@/lib/http";
import { buildPointsHistory } from "@/lib/leaderboard";
import { roundPoints } from "@/lib/points/format";
import { pointsBySource } from "@/lib/points/service";
import { getStore } from "@/lib/store";

/**
 * What anyone can see of a person: the name and picture others currently see,
 * their points and where they came from, and their trophy case. Never height,
 * weight or sex.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = displayStore(getStore());
  const person = (await store.listProfiles()).find((profile) => profile.id === id);
  if (!person) return jsonError("That person isn't here any more.", 404);

  const [events, entries, trophies] = await Promise.all([
    store.listPointEvents(id),
    buildPointsHistory(store, id, 40),
    buildTrophyCase(store, id),
  ]);
  const total = events.reduce((sum, event) => (event.voidedAt === null ? sum + event.delta : sum), 0);
  return Response.json({
    person: { id: person.id, name: person.name, avatarUrl: person.avatarUrl },
    total: roundPoints(total),
    bySource: pointsBySource(events),
    entries,
    trophies,
  });
}
