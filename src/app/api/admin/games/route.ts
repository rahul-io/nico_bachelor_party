import { connection } from "next/server";
import { isAdmin } from "@/lib/auth";
import { assignDrinks } from "@/lib/games/bartender";
import { buildAdminGames } from "@/lib/games/board";
import { GameError } from "@/lib/games/common";
import { revertCurse } from "@/lib/games/curses";
import { setGroomId, voidGroomTax } from "@/lib/games/groom";
import { resolve, voidWager } from "@/lib/games/wagers";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET() {
  await connection();
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  return Response.json(await buildAdminGames(getStore()));
}

/** setGroom | bartender | resolveWager | voidWager | revertCurse | voidGroomTax */
export async function POST(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const id = String(body.id ?? "");
  const store = getStore();
  try {
    switch (body.action) {
      case "setGroom": {
        const groomId = typeof body.profileId === "string" && body.profileId ? body.profileId : null;
        if (groomId && !(await store.getProfile(groomId))) return jsonError("That person no longer exists", 404);
        await setGroomId(store, groomId);
        return Response.json({ ok: true });
      }
      case "bartender":
        return Response.json({ assigned: await assignDrinks(store) });
      case "resolveWager":
        return Response.json({ ok: await resolve(store, id, String(body.winnerId ?? "")) });
      case "voidWager":
        return Response.json({ ok: await voidWager(store, id) });
      case "revertCurse":
        return Response.json({ ok: await revertCurse(store, id) });
      case "voidGroomTax":
        return Response.json({ ok: await voidGroomTax(store, id) });
      default:
        return jsonError("Unknown action", 400);
    }
  } catch (error) {
    if (error instanceof GameError) return jsonError(error.message, error.status);
    throw error;
  }
}
