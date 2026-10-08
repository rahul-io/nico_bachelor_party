import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { env } from "@/lib/env";
import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { mediaRules } from "@/lib/media";

/**
 * Issues a short-lived token so the browser can upload straight to Vercel Blob.
 * File bytes never pass through this function.
 */
export async function POST(req: Request) {
  if (!env.blobToken) return jsonError("Uploads are not configured", 503);

  // The Blob client calls this from the page, so the session cookie comes with it.
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Sign in to upload", 401);

  const body = (await readJson(req)) as HandleUploadBody | null;
  if (!body) return jsonError("Invalid request body", 400);

  try {
    const result = await handleUpload({
      request: req,
      body,
      token: env.blobToken,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { kind } = JSON.parse(clientPayload ?? "{}") as Record<string, unknown>;
        if (kind !== "image" && kind !== "video") throw new Error("Unknown media type");
        if (!pathname.startsWith(`posts/${profile.id}/`)) throw new Error("Invalid upload path");

        return {
          allowedContentTypes: mediaRules[kind].contentTypes,
          maximumSizeInBytes: mediaRules[kind].maxBytes,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Upload refused", 400);
  }
}
