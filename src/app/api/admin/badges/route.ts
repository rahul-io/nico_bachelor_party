import { connection } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  awardManually,
  buildAdminBadges,
  confirmSleepingBeauty,
  recalculateBadge,
  revokeAward,
  saveBadge,
  saveBadgeImage,
  type BadgeInput,
} from "@/lib/badges/service";
import { GameError } from "@/lib/games/common";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET() {
  await connection();
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  return Response.json(await buildAdminBadges(getStore()));
}

/** save | image | award | revoke | recalculate | confirmSleeping */
export async function POST(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  const store = getStore();
  try {
    switch (body.action) {
      case "save": {
        const input = (body.badge ?? {}) as Partial<BadgeInput>;
        const badge = await saveBadge(store, text("id") || null, {
          name: String(input.name ?? ""),
          description: String(input.description ?? ""),
          emoji: String(input.emoji ?? ""),
          imageUrl: typeof input.imageUrl === "string" && input.imageUrl ? input.imageUrl : null,
          kind: input.kind === "achievement" ? "achievement" : "merit",
          points: Number(input.points),
          active: input.active !== false,
          hidden: input.hidden === true,
          rule: input.rule ?? null,
        });
        return Response.json(badge);
      }
      case "image":
        return Response.json({ imageUrl: await saveBadgeImage(store, text("dataUrl")) });
      case "award":
        await awardManually(store, text("badgeId"), text("profileId"), text("reason"));
        return Response.json({ ok: true });
      case "revoke":
        return Response.json({ ok: await revokeAward(store, text("awardId")) });
      case "recalculate":
        return Response.json({ changed: await recalculateBadge(store, text("badgeId")) });
      case "confirmSleeping":
        return Response.json({ given: await confirmSleepingBeauty(store, text("day")) });
      default:
        return jsonError("Unknown action", 400);
    }
  } catch (error) {
    if (error instanceof GameError) return jsonError(error.message, error.status);
    throw error;
  }
}
