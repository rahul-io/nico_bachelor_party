import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { FeedPost } from "@/lib/store/types";
import { formatDeviceWeekdayTime } from "@/lib/time";

interface PostCardProps {
  post: FeedPost;
  canDelete: boolean;
  onDelete: (post: FeedPost) => void;
}

export function PostCard({ post, canDelete, onDelete }: PostCardProps) {
  const noun = post.mediaType === "video" ? "video" : "photo";

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center gap-3 py-2 pl-3 pr-1">
        <Avatar name={post.posterName} src={post.posterAvatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="leading-snug">
            <span className="font-semibold">{post.posterName}</span>
            {/* The BAC stored with the post when it was made; not a live number. */}
            {post.bacAtPost !== null && (
              <span className="tabular-nums text-accent"> ({post.bacAtPost.toFixed(2)}%)</span>
            )}{" "}
            <span className="text-muted">posted a {noun}</span>
          </p>
          <p className="text-sm text-muted">{formatDeviceWeekdayTime(post.createdAt)}</p>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDelete(post)}
            aria-label={`Delete this ${noun}`}
            className="flex size-tap shrink-0 items-center justify-center text-muted active:text-danger"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="size-2 shrink-0" />
        )}
      </header>

      <div className="bg-canvas">
        {post.mediaType === "video" ? (
          <video src={post.url} controls playsInline preload="metadata" className="max-h-[75vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- lightweight preview served straight from Blob
          <img
            src={post.previewUrl ?? post.url}
            alt={post.caption ?? `Photo by ${post.posterName}`}
            loading="lazy"
            className="max-h-[75vh] w-full object-contain"
          />
        )}
      </div>

      {post.caption && <p className="whitespace-pre-line px-4 py-3">{post.caption}</p>}
    </article>
  );
}
