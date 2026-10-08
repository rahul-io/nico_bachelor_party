import { downloadZip } from "client-zip";
import { config } from "@/config";
import { isAdmin } from "@/lib/auth";
import { exportCsv, exportEntries } from "@/lib/export";
import { buildFeed } from "@/lib/feed";
import { jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

// A big export can take a while; `npm run export-photos` is the fallback if this times out.
export const maxDuration = 300;

/** Streams one zip of every photo and video plus photos.csv. Nothing is buffered in memory. */
export async function GET() {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const feed = await buildFeed(getStore());
  const entries = exportEntries(feed.posts, config.timezone);

  async function* files() {
    yield { name: "photos.csv", lastModified: new Date(), input: exportCsv(entries, config.timezone) };
    for (const { post, fileName } of entries) {
      const response = await fetch(post.url);
      if (!response.ok || !response.body) {
        console.error(`Export: skipped ${fileName} (${response.status})`);
        continue;
      }
      yield { name: fileName, lastModified: new Date(post.createdAt), input: response };
    }
  }

  return new Response(downloadZip(files()).body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="nico-bachelor-party-photos.zip"',
      "cache-control": "no-store",
    },
  });
}
