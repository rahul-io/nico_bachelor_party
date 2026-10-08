import { connection } from "next/server";
import { getSettings } from "@/lib/points/service";
import { getStore } from "@/lib/store";

/** The current rules, for the "How points work" page and the Admin form. */
export async function GET() {
  await connection();
  return Response.json(await getSettings(getStore()));
}
