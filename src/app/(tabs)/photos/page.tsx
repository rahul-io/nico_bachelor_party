"use client";

import { ExternalLink } from "lucide-react";
import useSWR from "swr";
import type { AdminSession } from "@/app/admin/page";
import { Composer } from "@/components/photos/Composer";
import { PostCard } from "@/components/photos/PostCard";
import { Card } from "@/components/ui/Card";
import { Status } from "@/components/ui/Status";
import { config } from "@/config";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { useIdentity } from "@/hooks/useProfile";
import { apiFetch } from "@/lib/api";
import type { Feed, FeedPost } from "@/lib/store/types";

export default function PhotosPage() {
  const identity = useIdentity();
  const { data: feed, error, mutate } = usePolled<Feed>("/api/posts");
  // Checked once, not polled: admins get a delete button on every post.
  const { data: admin } = useSWR<AdminSession>("/api/admin/session", (path: string) =>
    apiFetch<AdminSession>(path),
  );
  const { status, run } = useAction();

  async function remove(post: FeedPost) {
    if (!window.confirm(`Delete this ${post.mediaType === "video" ? "video" : "photo"}? This can't be undone.`)) return;
    await run(() => apiFetch(`/api/posts/${post.id}`, { method: "DELETE" }));
    await mutate();
  }

  return (
    <div className="space-y-4">
      {config.albumUrl && (
        <a
          href={config.albumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center justify-center gap-2 rounded-control border border-accent bg-surface px-4 text-base font-semibold text-accent transition active:scale-[0.97]"
        >
          <ExternalLink className="size-5" aria-hidden />
          Open shared Google Photos album
        </a>
      )}

      <Composer uploadsEnabled={feed?.uploadsEnabled ?? true} onPosted={() => mutate()} />
      {status?.error && <Status status={status} />}

      {!feed && <Card className="text-muted">{error ? "Couldn't load the feed. Retrying…" : "Loading…"}</Card>}
      {feed?.posts.length === 0 && <Card className="text-muted">No photos yet. Be the first.</Card>}

      <ul className="space-y-4">
        {feed?.posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              canDelete={post.profileId === identity?.id || admin?.authed === true}
              onDelete={remove}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
