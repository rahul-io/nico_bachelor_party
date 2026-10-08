import { connection } from "next/server";
import { buildBoard } from "@/lib/games/board";
import { getRequestProfile } from "@/lib/http";
import { getStore } from "@/lib/store";

/** The Games board: open wagers, Snitch Line reports, active curses and the curse prices. */
export async function GET(req: Request) {
  await connection();
  const viewer = await getRequestProfile(req);
  return Response.json(await buildBoard(getStore(), viewer?.id ?? null));
}
