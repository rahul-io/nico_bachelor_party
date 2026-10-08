import { connection } from "next/server";
import { buildStatus } from "@/lib/points/service";
import { getStore } from "@/lib/store";

export async function GET() {
  await connection();
  return Response.json(await buildStatus(getStore()));
}
