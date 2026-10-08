import { connection } from "next/server";
import { buildPointsHistory } from "@/lib/leaderboard";
import { getStore } from "@/lib/store";

export async function GET() {
  await connection();
  return Response.json(await buildPointsHistory(getStore()));
}
