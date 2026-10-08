import { checkAdminPassword, startAdminSession } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";

export async function POST(req: Request) {
  const body = await readJson(req);
  const password =
    typeof body === "object" && body !== null && "password" in body ? body.password : null;
  if (typeof password !== "string" || !checkAdminPassword(password)) {
    return jsonError("Wrong password", 401);
  }
  await startAdminSession();
  return Response.json({ ok: true });
}
