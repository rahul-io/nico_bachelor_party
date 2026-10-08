"use client";

import { ImagePlus, X } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { useIdentity } from "@/hooks/useProfile";
import { apiFetch } from "@/lib/api";
import { MAX_CAPTION, mediaRules, megabytes } from "@/lib/media";
import type { MediaType } from "@/lib/store/types";
import { inlinePhoto, uploadPostMedia } from "@/lib/upload";

interface Draft {
  file: File;
  kind: MediaType;
  previewUrl: string;
}

export function Composer({ uploadsEnabled, onPosted }: { uploadsEnabled: boolean; onPosted: () => void }) {
  const identity = useIdentity();
  const { busy, status, setStatus, run } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);

  function clear() {
    if (draft) URL.revokeObjectURL(draft.previewUrl);
    setDraft(null);
    setCaption("");
    setProgress(0);
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const kind: MediaType | null = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;
    if (!kind) return setStatus({ text: "Only photos and videos can be posted.", error: true });
    if (kind === "video" && !uploadsEnabled) {
      return setStatus({ text: "Videos aren't available in demo mode.", error: true });
    }
    if (uploadsEnabled && file.size > mediaRules[kind].maxBytes) {
      return setStatus({
        text: `That ${kind === "video" ? "video" : "photo"} is ${megabytes(file.size)}. The limit is ${megabytes(mediaRules[kind].maxBytes)}; ${kind === "video" ? "trim it or " : ""}put it in the Google Photos album.`,
        error: true,
      });
    }
    if (draft) URL.revokeObjectURL(draft.previewUrl);
    setStatus(null);
    setDraft({ file, kind, previewUrl: URL.createObjectURL(file) });
  }

  async function post() {
    if (!draft || !identity) return;
    const ok = await run(async () => {
      let url: string;
      let previewUrl: string | null = null;
      if (!uploadsEnabled) {
        url = await inlinePhoto(draft.file);
      } else {
        const file = draft.file;
        if (file.size > mediaRules[draft.kind].maxBytes) {
          throw new Error(`That file is over the ${megabytes(mediaRules[draft.kind].maxBytes)} limit.`);
        }
        ({ url, previewUrl } = await uploadPostMedia(file, draft.kind, identity, setProgress));
      }
      await apiFetch("/api/posts", { method: "POST", body: { url, previewUrl, caption } });
    }, "Posted");
    if (ok) {
      clear();
      onPosted();
    }
  }

  if (!draft) {
    return (
      <div className="space-y-2">
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-control bg-primary px-4 text-base font-semibold text-on-primary transition active:scale-[0.97]">
          <ImagePlus className="size-5" aria-hidden />
          Post a photo or video
          <input type="file" accept="image/*,video/*" onChange={pick} className="sr-only" />
        </label>
        <p className="text-sm text-muted">
          {uploadsEnabled ? "Photos are saved in original quality for downloads." : "Demo mode saves smaller previews only."}
        </p>
        {status && <Status status={status} />}
      </div>
    );
  }

  return (
    <Card className="space-y-3 p-3">
      <div className="relative overflow-hidden rounded-control bg-canvas">
        {draft.kind === "video" ? (
          <video src={draft.previewUrl} controls playsInline muted className="max-h-80 w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
          <img src={draft.previewUrl} alt="" className="max-h-80 w-full object-contain" />
        )}
        {!busy && (
          <button
            type="button"
            onClick={clear}
            aria-label="Remove"
            className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-canvas/80 text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <textarea
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        maxLength={MAX_CAPTION}
        rows={2}
        placeholder="Add a caption (optional)"
        aria-label="Caption"
        disabled={busy}
        className={`${inputClass} py-2`}
      />

      {busy && uploadsEnabled && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Upload progress"
          className="h-2 overflow-hidden rounded-full bg-raised"
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      <Button variant="primary" block disabled={busy} onClick={post}>
        {busy ? (uploadsEnabled ? `Uploading… ${Math.round(progress)}%` : "Posting…") : "Post"}
      </Button>
      <Status status={status} />
    </Card>
  );
}
