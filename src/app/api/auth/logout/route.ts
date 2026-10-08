import { endSession } from "@/lib/session";

/** Signs this device out. Other devices stay signed in. */
export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
