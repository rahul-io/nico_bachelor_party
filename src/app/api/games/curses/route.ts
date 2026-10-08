import { GameError } from "@/lib/games/common";
import { CURSE_TYPES, castCurse, type CurseType } from "@/lib/games/curses";
import { playerAction } from "@/lib/games/http";

export function POST(req: Request) {
  return playerAction(req, async (store, profile, body) => {
    const type = body.type as CurseType;
    if (!CURSE_TYPES.includes(type)) throw new GameError("Unknown curse");
    const result = await castCurse(store, profile, {
      type,
      targetId: String(body.targetId ?? ""),
      value: typeof body.value === "string" ? body.value : undefined,
    });
    return { result };
  });
}
