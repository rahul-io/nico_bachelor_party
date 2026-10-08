import { isAdmin } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET() {
  return Response.json({
    authed: await isAdmin(),
    loginEnabled: env.adminPassword !== null,
    devPassword: env.usingDevAdminPassword,
  });
}
