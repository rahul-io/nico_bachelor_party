import { playerAction } from "@/lib/games/http";
import { challenge } from "@/lib/games/wagers";

export function POST(req: Request) {
  return playerAction(req, (store, profile, body) =>
    challenge(store, profile, {
      opponentId: String(body.opponentId ?? ""),
      stake: Number(body.stake),
      description: String(body.description ?? ""),
    }),
  );
}
