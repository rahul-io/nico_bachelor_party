import { connection } from "next/server";
import { displayStore } from "@/lib/games/curses";
import { getStore } from "@/lib/store";
import { buildTrends } from "@/lib/trends";

export async function GET() {
  await connection();
  return Response.json(await buildTrends(displayStore(getStore())));
}
