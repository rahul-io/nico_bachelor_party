// Shared by the Admin zip download and scripts/export-photos.mts.
// Keep this file free of runtime imports so the script can load it with plain Node.
import type { FeedComment, FeedPost } from "./store/types";

export interface ExportEntry {
  post: FeedPost;
  fileName: string;
}

const CSV_HEADER = [
  "file",
  "poster",
  "caption",
  "timestamp",
  "timestamp_utc",
  "bac",
  "type",
  "reactions",
  "comments",
  "lat",
  "lng",
  "location_source",
  "url",
];
const COMMENTS_HEADER = ["file", "commenter", "comment", "timestamp", "timestamp_utc", "bac"];

function localStamp(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

const slug = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "guest";

function extension(post: FeedPost): string {
  const fromUrl = /\.([A-Za-z0-9]{2,5})(?:$|[?#])/.exec(post.url.startsWith("data:") ? "" : post.url)?.[1];
  return (fromUrl ?? (post.mediaType === "video" ? "mp4" : "jpg")).toLowerCase();
}

/**
 * Names every post `YYYY-MM-DD_HH-mm-ss_poster[_bac-0.062].ext` in the given
 * timezone, oldest first, with a numeric suffix if two would collide.
 */
export function exportEntries(posts: FeedPost[], timeZone: string): ExportEntry[] {
  const used = new Set<string>();
  return [...posts]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((post) => {
      const { date, time } = localStamp(post.createdAt, timeZone);
      const bac = post.bacAtPost === null ? "" : `_bac-${post.bacAtPost.toFixed(3)}`;
      const base = `${date}_${time.replaceAll(":", "-")}_${slug(post.posterName)}${bac}`;
      const ext = extension(post);
      let fileName = `${base}.${ext}`;
      for (let n = 2; used.has(fileName); n++) fileName = `${base}_${n}.${ext}`;
      used.add(fileName);
      return { post, fileName };
    });
}

function cell(value: string): string {
  // A leading =, +, - or @ would be run as a formula by spreadsheet apps. Plain
  // numbers (negative longitudes) are harmless and must stay numeric.
  const risky = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value);
  const safe = risky ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toCsv(rows: string[][]): string {
  // BOM so Excel reads accented names correctly.
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function exportCsv(entries: ExportEntry[], timeZone: string): string {
  const rows = entries.map(({ post, fileName }) => {
    const { date, time } = localStamp(post.createdAt, timeZone);
    return [
      fileName,
      post.posterName,
      post.caption ?? "",
      `${date} ${time}`,
      post.createdAt,
      post.bacAtPost === null ? "" : post.bacAtPost.toFixed(3),
      post.mediaType,
      String(post.reactions.reduce((sum, reaction) => sum + reaction.count, 0)),
      String(post.commentCount),
      post.lat === null ? "" : String(post.lat),
      post.lng === null ? "" : String(post.lng),
      post.locationSource ?? "",
      post.url.startsWith("data:") ? "" : post.url,
    ];
  });
  return toCsv([CSV_HEADER, ...rows]);
}

/** One row per comment, keyed to the exported file name of the photo it is on. */
export function exportCommentsCsv(entries: ExportEntry[], comments: FeedComment[], timeZone: string): string {
  const files = new Map(entries.map(({ post, fileName }) => [post.id, fileName]));
  const rows = [...comments]
    .filter((comment) => files.has(comment.postId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((comment) => {
      const { date, time } = localStamp(comment.createdAt, timeZone);
      return [
        files.get(comment.postId) ?? "",
        comment.authorName,
        comment.body,
        `${date} ${time}`,
        comment.createdAt,
        comment.bacAtComment === null ? "" : comment.bacAtComment.toFixed(3),
      ];
    });
  return toCsv([COMMENTS_HEADER, ...rows]);
}
