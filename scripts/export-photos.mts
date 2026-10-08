// Downloads every photo and video from the feed into a local folder, plus photos.csv.
// Usage: npm run export-photos [-- <folder>]   (default: photo-export; reads .env.local)
// Safe to re-run: files that are already there are skipped.
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { neon } from "@neondatabase/serverless";
import { config } from "../src/config.ts";
import { exportCsv, exportEntries } from "../src/lib/export.ts";
import { createPostgresStore, type Sql } from "../src/lib/store/postgres.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local and retry.");
  process.exit(1);
}

const outDir = process.argv[2] ?? "photo-export";
mkdirSync(outDir, { recursive: true });

const store = createPostgresStore(neon(url) as unknown as Sql);
const [posts, profiles] = await Promise.all([store.listPosts(), store.listProfiles()]);
const names = new Map(profiles.map((profile) => [profile.id, profile]));
const entries = exportEntries(
  posts.map((post) => ({
    ...post,
    posterName: names.get(post.profileId)?.name ?? "Someone",
    posterAvatarUrl: null,
  })),
  config.timezone,
);

writeFileSync(join(outDir, "photos.csv"), exportCsv(entries, config.timezone));

let downloaded = 0;
let skipped = 0;
const failed: string[] = [];
for (const [index, { post, fileName }] of entries.entries()) {
  const target = join(outDir, fileName);
  const label = `[${index + 1}/${entries.length}] ${fileName}`;
  if (existsSync(target) && statSync(target).size > 0) {
    skipped++;
    continue;
  }
  try {
    const response = await fetch(post.url);
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    // Write to a temp name first so an interrupted run never leaves a half file that looks done.
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(`${target}.part`));
    renameSync(`${target}.part`, target);
    const taken = new Date(post.createdAt);
    utimesSync(target, taken, taken);
    downloaded++;
    console.log(`ok    ${label}`);
  } catch (error) {
    failed.push(fileName);
    console.error(`FAIL  ${label}: ${(error as Error).message}`);
  }
}

console.log(`\n${entries.length} posts: ${downloaded} downloaded, ${skipped} already there, ${failed.length} failed.`);
console.log(`Folder: ${outDir}`);
if (failed.length > 0) process.exit(1);
