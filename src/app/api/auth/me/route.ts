import { getSessionProfile } from "@/lib/session";

/**
 * Who this device is signed in as, or null. Called whenever the app opens,
 * which is also when an ageing session gets its 30 days renewed.
 */
export async function GET() {
  return Response.json({ profile: await getSessionProfile({ refresh: true }) });
}
