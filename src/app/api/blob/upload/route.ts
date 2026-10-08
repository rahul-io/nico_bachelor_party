import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { env } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { mediaRules } from "@/lib/media";
import { getStore } from "@/lib/store";

/**
 * Issues a short-lived token so the browser can upload straight to Vercel Blob.
 * File bytes never pass through this function.
 */
export async function POST(req: Request) {
  if (!env.blobToken) return jsonError("Uploads are not configured", 503);

  const body = (await readJson(req)) as HandleUploadBody | null;
  if (!body) return jsonError("Invalid request body", 400);

  try {
    const result = await handleUpload({
      request: req,
      body,
      token: env.blobToken,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // The Blob client makes this request, so identity arrives in the payload, not headers.
        const { id, token, kind } = JSON.parse(clientPayload ?? "{}") as Record<string, unknown>;
        const profile =
          typeof id === "string" && typeof token === "string"
            ? await getStore().getProfileByToken(id, token)
            : null;
        if (!profile) throw new Error("Unknown profile");
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
