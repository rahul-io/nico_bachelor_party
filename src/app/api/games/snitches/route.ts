import { playerAction } from "@/lib/games/http";
import { reportPlayer } from "@/lib/games/snitch";

export function POST(req: Request) {
  return playerAction(req, (store, profile, body) =>
    reportPlayer(store, profile, {
      accusedId: String(body.accusedId ?? ""),
      reason: String(body.reason ?? ""),
      postId: String(body.postId ?? ""),
    }),
  );
}
