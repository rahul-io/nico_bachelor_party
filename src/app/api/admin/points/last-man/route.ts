import { connection } from "next/server";
import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { confirmLastMan, lastManCandidates } from "@/lib/points/service";

export async function GET() {
  await connection();
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  return Response.json(await lastManCandidates(getStore()));
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  const body = (await readJson(req)) as { day?: unknown } | null;
  if (typeof body?.day !== "string") return jsonError("Pick a day", 400);
  const event = await confirmLastMan(getStore(), body.day);
  if (!event) return jsonError("Nothing to confirm for that day", 409);
  return Response.json(event, { status: 201 });
}
