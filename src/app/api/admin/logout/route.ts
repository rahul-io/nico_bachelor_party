import { endAdminSession } from "@/lib/auth";

export async function POST() {
  await endAdminSession();
  return Response.json({ ok: true });
}
