import { describe, expect, it } from "vitest";
import { exportCsv, exportEntries } from "./export";
import type { FeedPost } from "./store/types";

const post = (over: Partial<FeedPost>): FeedPost => ({
  id: "1",
  profileId: "p",
  url: "https://x.public.blob.vercel-storage.com/posts/p/IMG_1-abc123.JPG",
  mediaType: "image",
  caption: null,
  bacAtPost: null,
  createdAt: "2026-10-10T04:14:03.000Z",
  posterName: "Rahul",
  posterAvatarUrl: null,
  ...over,
});

const tz = "America/Los_Angeles";

describe("exportEntries", () => {
  it("names files by party-local date, time, poster and BAC", () => {
    const [plain, withBac] = exportEntries(
      [
        post({}),
        post({ id: "2", bacAtPost: 0.0623, createdAt: "2026-10-10T05:00:00.000Z", posterName: "Big Tim O'Neil" }),
      ],
      tz,
    );
    expect(plain.fileName).toBe("2026-10-09_21-14-03_rahul.jpg");
    expect(withBac.fileName).toBe("2026-10-09_22-00-00_big-tim-o-neil_bac-0.062.jpg");
  });

  it("sorts oldest first, falls back on extensions and avoids collisions", () => {
    const entries = exportEntries(
      [
        post({ id: "b", url: "https://x.public.blob.vercel-storage.com/posts/p/clip", mediaType: "video" }),
        post({ id: "a", createdAt: "2026-10-09T04:14:03.000Z", posterName: "🍺" }),
        post({ id: "c" }),
        post({ id: "d" }),
      ],
      tz,
    );
    expect(entries.map((entry) => entry.fileName)).toEqual([
      "2026-10-08_21-14-03_guest.jpg",
      "2026-10-09_21-14-03_rahul.mp4",
      "2026-10-09_21-14-03_rahul.jpg",
      "2026-10-09_21-14-03_rahul_2.jpg",
    ]);
  });
});

describe("exportCsv", () => {
  it("writes one escaped row per post", () => {
    const entries = exportEntries(
      [
        post({ caption: 'He said "cheers",\nthen fell over', bacAtPost: 0.05 }),
        post({ id: "2", caption: "=HYPERLINK(1)" }),
      ],
      tz,
    );
    const csv = exportCsv(entries, tz);
    expect(csv.startsWith("﻿file,poster,caption,timestamp,timestamp_utc,bac,type,url\r\n")).toBe(true);
    expect(csv).toContain('"He said ""cheers"",\nthen fell over"');
    expect(csv).toContain("2026-10-09 21:14:03,2026-10-10T04:14:03.000Z,0.050,image,");
    expect(csv).toContain(",'=HYPERLINK(1),");
    expect(csv.trimEnd().split("\r\n")).toHaveLength(3);
  });
});
