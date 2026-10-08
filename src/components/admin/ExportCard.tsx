"use client";

import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { usePolled } from "@/hooks/usePolled";
import type { Feed } from "@/lib/store/types";

export function ExportCard() {
  const { data: feed } = usePolled<Feed>("/api/posts");
  const count = feed?.posts.length ?? 0;

  return (
    <Card className="space-y-2">
      <h2 className="font-display text-lg font-bold">Photo export</h2>
      <p className="text-sm text-muted">
        One zip of every photo and video in the feed ({count} so far), named by date, time and poster, with a
        spreadsheet of captions.
      </p>
      {/* A plain link so the browser streams the download; the admin cookie goes with it. */}
      <a
        href="/api/admin/export"
        download
        aria-disabled={count === 0}
        className="flex min-h-tap items-center justify-center gap-2 rounded-control border border-line bg-raised px-4 font-medium aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        <Download className="size-5" aria-hidden />
        Download all photos
      </a>
      <p className="text-xs text-muted">
        If the download stalls because there is too much video, run <code className="font-mono">npm run export-photos</code>{" "}
        on a laptop instead.
      </p>
    </Card>
  );
}
