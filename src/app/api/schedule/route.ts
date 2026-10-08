import { connection } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  // Always answer at request time; the schedule changes when Admin edits it.
  await connection();
  return Response.json(await getStore().listEvents());
}
