import { isAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { settleDue } from "@/lib/points/service";
import { getStore } from "@/lib/store";

/** Pays any hourly and daily awards that are due, without waiting for the next request to notice. */
export async function POST() {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  return Response.json({ paid: await settleDue(getStore(), Date.now(), true) });
}
