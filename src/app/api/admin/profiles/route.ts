import { isAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET() {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const profiles = await getStore().listProfiles();
  return Response.json(
    profiles
      .map(({ id, name, avatarUrl, createdAt, hasPassword }) => ({ id, name, avatarUrl, createdAt, hasPassword }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}
