import { GameError } from "@/lib/games/common";
import { playerAction } from "@/lib/games/http";
import { answer, placeSideBet, report } from "@/lib/games/wagers";

/** accept | decline | report (winnerId) | bet (side, stake) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return playerAction(req, (store, profile, body) => {
    switch (body.action) {
      case "accept":
        return answer(store, profile, id, true);
      case "decline":
        return answer(store, profile, id, false);
      case "report":
        return report(store, profile, id, String(body.winnerId ?? ""));
      case "bet":
        return placeSideBet(store, profile, id, String(body.side ?? ""), Number(body.stake));
      default:
        throw new GameError("Unknown action");
    }
  });
}
