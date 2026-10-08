import { del, head } from "@vercel/blob";
import { connection } from "next/server";
import { estimateBac } from "@/lib/bac";
import { env } from "@/lib/env";
import { buildFeed, isBlobUrl } from "@/lib/feed";
import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { MAX_CAPTION, MOCK_IMAGE, MOCK_IMAGE_MAX_CHARS, mediaRules, mediaTypeOf } from "@/lib/media";
import { getStore } from "@/lib/store";
import type { MediaType } from "@/lib/store/types";

export async function GET() {
  await connection();
  return Response.json(await buildFeed(getStore()));
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
  const caption = typeof body?.caption === "string" ? body.caption.trim() : "";
  if (!url) return jsonError("Nothing was uploaded", 400);
  if (caption.length > MAX_CAPTION) return jsonError(`Caption is too long (max ${MAX_CAPTION} characters)`, 400);

  const mediaType = await inspectUpload(url, profile.id);
  if (mediaType !== "image" && mediaType !== "video") return jsonError(mediaType, 400);

  const store = getStore();
  // Snapshot: taken once here and stored with the post. It is never recomputed.
  const bacAtPost = profile.showBacOnPosts
    ? Math.round(estimateBac(profile, await store.listDrinks(profile.id)).bac * 10_000) / 10_000
    : null;

  const post = await store.createPost({
    profileId: profile.id,
    url,
    mediaType,
    caption: caption || null,
    bacAtPost,
  });
  return Response.json(post, { status: 201 });
}
