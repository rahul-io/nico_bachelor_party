import { connection } from "next/server";
import { getStore } from "@/lib/store";
import { buildTrends } from "@/lib/trends";

export async function GET() {
  await connection();
  return Response.json(await buildTrends(getStore()));
}
