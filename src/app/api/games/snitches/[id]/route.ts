import { playerAction } from "@/lib/games/http";
import { upvote } from "@/lib/games/snitch";

/** Upvotes a report. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return playerAction(req, (store, profile) => upvote(store, profile, id));
}
