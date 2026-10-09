import { del, head } from "@vercel/blob";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { sweepBadges } from "@/lib/badges/service";
import { GameError } from "@/lib/games/common";
import { displayStore } from "@/lib/games/curses";
import { claimGroomTax } from "@/lib/games/groom";
import { bacSnapshot, buildFeed, forGuests, isBlobUrl } from "@/lib/feed";
import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { parseCoordinates, resolveLocation } from "@/lib/location";
import { MAX_CAPTION, MOCK_IMAGE, MOCK_IMAGE_MAX_CHARS, mediaRules, mediaTypeOf } from "@/lib/media";
import { getStore } from "@/lib/store";
import type { MediaType } from "@/lib/store/types";

export async function GET(req: Request) {
  await connection();
  const viewer = await getRequestProfile(req);
  return Response.json(await buildFeed(displayStore(getStore()), viewer?.id ?? null));
}

/** Checks an uploaded file really is an allowed photo or video of ours, and says which. */
async function inspectUpload(url: string, profileId: string): Promise<MediaType | string> {
  const token = env.blobToken;
  if (!token) {
    const ok = url.length <= MOCK_IMAGE_MAX_CHARS && MOCK_IMAGE.test(url);
    return ok ? "image" : "Demo mode only takes small photos";
  }
  if (!isBlobUrl(url) || !new URL(url).pathname.startsWith(`/posts/${profileId}/`)) {
    return "That upload didn't come from this app";
  }
  try {
    const blob = await head(url, { token });
    const mediaType = mediaTypeOf(blob.contentType);
    if (mediaType && blob.size <= mediaRules[mediaType].maxBytes) return mediaType;
    await del(url, { token });
    return mediaType ? "That file is too large" : "Only photos and videos can be posted";
  } catch {
    return "Couldn't find that upload. Try again.";
  }
}

export async function POST(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const previewUrl = typeof body?.previewUrl === "string" ? body.previewUrl : null;
  const caption = typeof body?.caption === "string" ? body.caption.trim() : "";
  if (!url) return jsonError("Nothing was uploaded", 400);
  if (caption.length > MAX_CAPTION) return jsonError(`Caption is too long (max ${MAX_CAPTION} characters)`, 400);

  const mediaType = await inspectUpload(url, profile.id);
  if (mediaType !== "image" && mediaType !== "video") return jsonError(mediaType, 400);
  if (previewUrl) {
    if (mediaType !== "image" || !env.blobToken) return jsonError("Only uploaded photos can have previews", 400);
    const previewType = await inspectUpload(previewUrl, profile.id);
    if (previewType !== "image") return jsonError("Invalid photo preview", 400);
  }

  const store = getStore();
  const bacAtPost = await bacSnapshot(store, profile);

  const event =
    typeof body?.eventId === "string"
      ? ((await store.listEvents()).find((candidate) => candidate.id === body.eventId) ?? null)
      : null;
  const location = resolveLocation({
    mediaType,
    exif: parseCoordinates(body?.exif),
    event,
    device: parseCoordinates(body?.device),
  });

  // People tagged in the photo: real profiles only, no duplicates.
  const known = new Set((await store.listProfiles()).map((item) => item.id));
  const taggedIds = [
    ...new Set(Array.isArray(body?.taggedIds) ? body.taggedIds.filter((id): id is string => typeof id === "string") : []),
  ].filter((id) => known.has(id));

  const post = await store.createPost({
    taggedIds,
    asleep: body?.asleep === true,
    profileId: profile.id,
    url,
    previewUrl,
    mediaType,
    caption: caption || null,
    bacAtPost,
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    locationSource: location?.source ?? null,
    eventId: event?.id ?? null,
  });

  // A photo can claim a Groom Tax. The post stands either way; the reply says if the claim didn't.
  let groomTax: string | null = null;
  if (typeof body?.groomTaxPlayerId === "string" && body.groomTaxPlayerId) {
    try {
      await claimGroomTax(store, profile, body.groomTaxPlayerId, post);
      groomTax = "Groom Tax paid.";
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      groomTax = error.message;
    }
  }
  if (taggedIds.length > 0) await sweepBadges(store);
  return Response.json({ ...forGuests(post), groomTax }, { status: 201 });
}
