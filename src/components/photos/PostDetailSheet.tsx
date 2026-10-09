"use client";

import { ImagePlus, SendHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ReactionBar } from "@/components/photos/ReactionBar";
import { Avatar } from "@/components/ui/Avatar";
import { inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { mediaRules, mediaTypeOf, megabytes } from "@/lib/media";
import { MAX_COMMENT, type ReactionEmoji } from "@/lib/reactions";
import type { FeedComment, FeedPost, PostDetail } from "@/lib/store/types";
import { formatDeviceWeekdayTime } from "@/lib/time";
import { inlinePhoto, uploadCommentPhoto } from "@/lib/upload";

interface PostDetailSheetProps {
  postId: string;
  viewerId: string | undefined;
  isAdmin: boolean;
  uploadsEnabled: boolean;
  onClose: () => void;
  onReact: (post: FeedPost, emoji: ReactionEmoji, on: boolean) => Promise<void>;
  /** Called after a comment is added or removed, so the feed's counts refresh. */
  onChanged: () => void;
}

/** The opened photo: full media, who reacted, and the comment thread. Polls while open. */
export function PostDetailSheet({ postId, viewerId, isAdmin, uploadsEnabled, onClose, onReact, onChanged }: PostDetailSheetProps) {
  const { data, error, mutate } = usePolled<PostDetail>(`/api/posts/${postId}`);
  const { busy, status, setStatus, run } = useAction();
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string; uploadedUrl?: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = photo?.previewUrl;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (mediaTypeOf(file.type) !== "image") {
      return setStatus({ text: "Choose a JPEG, PNG, WebP, GIF, HEIC or HEIF photo.", error: true });
    }
    if (file.size > mediaRules.image.maxBytes) {
      return setStatus({ text: `Photos are limited to ${megabytes(mediaRules.image.maxBytes)}.`, error: true });
    }
    setStatus(null);
    setProgress(0);
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (busy || !viewerId || (!body && !photo)) return;
    const ok = await run(async () => {
      let photoUrl = photo?.uploadedUrl ?? null;
      if (photo && !photoUrl) {
        setProgress(0);
        photoUrl = uploadsEnabled
          ? await uploadCommentPhoto(photo.file, { id: viewerId }, setProgress)
          : await inlinePhoto(photo.file);
        // Keep the upload if saving fails, so retrying doesn't upload it again.
        setPhoto({ ...photo, uploadedUrl: photoUrl });
      }
      await apiFetch(`/api/posts/${postId}/comments`, { method: "POST", body: { body, photoUrl } });
    });
    if (ok) {
      setDraft("");
      setPhoto(null);
      setProgress(0);
      await mutate();
      onChanged();
    }
  }

  async function remove(comment: FeedComment) {
    if (!window.confirm("Delete this comment?")) return;
    await run(() => apiFetch(`/api/comments/${comment.id}`, { method: "DELETE" }));
    await mutate();
    onChanged();
  }

  const gone = error instanceof ApiError && error.status === 404;
  const post = data?.post;
  const remaining = MAX_COMMENT - draft.length;

  return (
    <Sheet
      title={post?.mediaType === "video" ? "Video" : "Photo"}
      onClose={onClose}
      footer={
        post && (
          <form onSubmit={send} className="space-y-1">
            {photo && (
              <div className="relative w-fit overflow-hidden rounded-control bg-navy">
                {/* eslint-disable-next-line @next/next/no-img-element -- local file preview */}
                <img src={photo.previewUrl} alt="Photo to attach to your comment" className="h-24 max-w-full object-contain" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setPhoto(null); setStatus(null); }}
                  aria-label="Remove comment photo"
                  className="absolute right-1 top-1 flex size-tap items-center justify-center rounded-full bg-navy/75 text-sand disabled:opacity-40"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInput} type="file" accept={mediaRules.image.contentTypes.join(",")} onChange={pickPhoto} disabled={busy || !viewerId} aria-label="Choose comment photo" className="sr-only" tabIndex={-1} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy || !viewerId}
                aria-label={photo ? "Replace comment photo" : "Add photo to comment"}
                className="flex size-tap shrink-0 items-center justify-center rounded-control text-accent disabled:opacity-40"
              >
                <ImagePlus className="size-5" aria-hidden />
              </button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_COMMENT}
                rows={1}
                placeholder={photo ? "Add a message (optional)" : "Add a comment"}
                aria-label="Comment"
                disabled={busy || !viewerId}
                className={`${inputClass} max-h-28 py-2.5`}
              />
              <button
                type="submit"
                disabled={busy || !viewerId || (!draft.trim() && !photo)}
                aria-label="Post comment"
                className="flex size-tap shrink-0 items-center justify-center rounded-control bg-primary text-on-primary disabled:opacity-40"
              >
                <SendHorizontal className="size-5" aria-hidden />
              </button>
            </div>
            {busy && photo && <p role="status" className="px-1 text-xs text-muted">{uploadsEnabled ? `Uploading photo… ${Math.round(progress)}%` : "Posting photo…"}</p>}
            {(draft.length > 0 || status?.error) && (
              <p className={cn("px-1 text-xs tabular-nums", status?.error || remaining < 20 ? "text-danger" : "text-muted")}>
                {status?.error ? status.text : `${remaining} characters left`}
              </p>
            )}
          </form>
        )
      }
    >
      {!post ? (
        <p className="p-4 text-muted">
          {gone ? "This post has been deleted." : error ? "Couldn't load this post. Retrying…" : "Loading…"}
        </p>
      ) : (
        <>
          <div className="bg-navy">
            {post.mediaType === "video" ? (
              <video src={post.url} controls playsInline preload="metadata" className="max-h-[60vh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- lightweight preview served straight from Blob
              <img src={post.previewUrl ?? post.url} alt={post.caption ?? `Photo by ${post.posterName}`} className="max-h-[60vh] w-full object-contain" />
            )}
          </div>

          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={post.posterName} src={post.posterAvatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="leading-snug">
                  <span className="font-semibold">{post.posterName}</span>
                  {post.bacAtPost !== null && (
                    <span className="tabular-nums text-accent"> ({post.bacAtPost.toFixed(2)}%)</span>
                  )}
                </p>
                <p className="text-sm text-muted">{formatDeviceWeekdayTime(post.createdAt)}</p>
              </div>
            </div>
            {post.caption && <p className="whitespace-pre-line">{post.caption}</p>}

            <ReactionBar
              reactions={post.reactions}
              onToggle={async (emoji, on) => {
                await onReact(post, emoji, on);
                await mutate();
              }}
            />

            {data.reactors.length > 0 && (
              <ul className="space-y-1 text-sm">
                {data.reactors.map((entry) => (
                  <li key={entry.emoji} className="flex gap-2">
                    <span aria-hidden>{entry.emoji}</span>
                    <span className="text-muted">{entry.names.join(", ")}</span>
                  </li>
                ))}
              </ul>
            )}

            <section className="space-y-3 border-t border-line pt-4">
              <h3 className="font-display font-bold">
                {data.comments.length === 0 ? "No comments yet" : `Comments (${data.comments.length})`}
              </h3>
              <ul className="space-y-3">
                {data.comments.map((comment) => (
                  <li key={comment.id} className="flex items-start gap-3">
                    <Avatar name={comment.authorName} src={comment.authorAvatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{comment.authorName}</span>
                        {/* Stored with the comment when it was written; not a live number. */}
                        {comment.bacAtComment !== null && (
                          <span className="tabular-nums text-accent"> ({comment.bacAtComment.toFixed(2)}%)</span>
                        )}
                        <span className="text-muted"> · {formatDeviceWeekdayTime(comment.createdAt)}</span>
                      </p>
                      {comment.body && <p className="whitespace-pre-line break-words">{comment.body}</p>}
                      {comment.photoUrl && (
                        <a href={comment.photoUrl} target="_blank" rel="noreferrer" aria-label={`Open photo by ${comment.authorName}`} className="mt-2 block w-fit max-w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element -- comment media served straight from Blob */}
                          <img src={comment.photoUrl} alt={`Photo attached by ${comment.authorName}`} loading="lazy" className="max-h-72 max-w-full rounded-control object-contain" />
                        </a>
                      )}
                    </div>
                    {(comment.profileId === viewerId || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => remove(comment)}
                        aria-label={`Delete comment by ${comment.authorName}`}
                        className="-mr-2 -mt-2 flex size-tap shrink-0 items-center justify-center text-muted active:text-danger"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {status && !status.error && <Status status={status} />}
            </section>
          </div>
        </>
      )}
    </Sheet>
  );
}
