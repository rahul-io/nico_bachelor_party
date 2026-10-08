"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import type { AdminSession } from "@/app/admin/page";
import { Composer } from "@/components/photos/Composer";
import { PostCard } from "@/components/photos/PostCard";
import { PhotoMap } from "@/components/photos/PhotoMap";
import { PostDetailSheet } from "@/components/photos/PostDetailSheet";
import { Card } from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/PageTitle";
import { Segmented } from "@/components/ui/Segmented";
import { Status } from "@/components/ui/Status";
import { config } from "@/config";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { useIdentity } from "@/hooks/useProfile";
import { apiFetch } from "@/lib/api";
import { applyReaction, type ReactionEmoji } from "@/lib/reactions";
import type { Feed, FeedPost } from "@/lib/store/types";

const views = [
  { value: "feed", label: "Feed" },
  { value: "map", label: "Map" },
] as const;

type View = (typeof views)[number]["value"];

export default function PhotosPage() {
  const identity = useIdentity();
  const { data: feed, error, mutate } = usePolled<Feed>("/api/posts");
  // Checked once, not polled: admins get delete buttons on everything.
  const { data: admin } = useSWR<AdminSession>("/api/admin/session", (path: string) =>
    apiFetch<AdminSession>(path),
  );
  const { status, run } = useAction();
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>("feed");

  async function remove(post: FeedPost) {
    if (!window.confirm(`Delete this ${post.mediaType === "video" ? "video" : "photo"}? This can't be undone.`)) return;
    await run(() => apiFetch(`/api/posts/${post.id}`, { method: "DELETE" }));
    await mutate();
  }

  async function react(post: FeedPost, emoji: ReactionEmoji, on: boolean) {
    // Show the tap straight away, then let the server have the last word.
    void mutate(
      (current) =>
        current && {
          ...current,
          posts: current.posts.map((p) => (p.id === post.id ? applyReaction(p, emoji, on) : p)),
        },
      { revalidate: false },
    );
    await run(() => apiFetch(`/api/posts/${post.id}/reactions`, { method: "PUT", body: { emoji, on } }));
    await mutate();
  }

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Photo proof" title="Captain's Log" />
      {config.albumUrl && (
        <a
          href={config.albumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-base font-semibold text-link shadow-card transition active:scale-[0.97]"
        >
          <ExternalLink className="size-5" aria-hidden />
          Open shared Google Photos album
        </a>
      )}

      <Composer uploadsEnabled={feed?.uploadsEnabled ?? true} onPosted={() => mutate()} />
      {status?.error && <Status status={status} />}

      {!feed && <Card className="text-muted">{error ? "Couldn't load the feed. Retrying…" : "Loading…"}</Card>}
      <Segmented options={views} value={view} onChange={setView} label="Photos view" size="sm" />

      {view === "map" && feed && <PhotoMap posts={feed.posts} onOpen={setOpenId} />}
      {view === "feed" && feed?.posts.length === 0 && (
        <Card className="text-muted">The log is empty. Make the first entry.</Card>
      )}

      <ul className={view === "feed" ? "space-y-4" : "hidden"}>
        {feed?.posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              canDelete={post.profileId === identity?.id || admin?.authed === true}
              onDelete={remove}
              onOpen={(opened) => setOpenId(opened.id)}
              onReact={react}
            />
          </li>
        ))}
      </ul>

      {openId && (
        <PostDetailSheet
          postId={openId}
          viewerId={identity?.id}
          isAdmin={admin?.authed === true}
          onClose={() => setOpenId(null)}
          onReact={react}
          onChanged={() => mutate()}
        />
      )}
    </div>
  );
}
