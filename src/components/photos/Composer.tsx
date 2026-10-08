"use client";

import { ImagePlus, MapPin, X } from "lucide-react";
import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { useIdentity } from "@/hooks/useProfile";
import { useSchedule } from "@/hooks/useSchedule";
import { apiFetch } from "@/lib/api";
import { currentPosition, getLocationSharing, setLocationSharing, subscribeLocationSharing } from "@/lib/geo";
import type { Coordinates } from "@/lib/location";
import { MAX_CAPTION, mediaRules, megabytes } from "@/lib/media";
import type { MediaType } from "@/lib/store/types";
import { dayKey, dayParts, formatTime } from "@/lib/time";
import { inlinePhoto, readPhotoGps, shrinkPhoto, uploadMedia } from "@/lib/upload";

interface Draft {
  file: File;
  kind: MediaType;
  previewUrl: string;
  /** GPS read from the original photo, before it is shrunk. */
  exif: Coordinates | null;
}

export function Composer({ uploadsEnabled, onPosted }: { uploadsEnabled: boolean; onPosted: () => void }) {
  const identity = useIdentity();
  const { events } = useSchedule();
  const sharing = useSyncExternalStore(subscribeLocationSharing, getLocationSharing, () => "unset" as const);
  const { busy, status, setStatus, run } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [caption, setCaption] = useState("");
  const [eventId, setEventId] = useState("");
  const [progress, setProgress] = useState(0);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  function clear() {
    if (draft) URL.revokeObjectURL(draft.previewUrl);
    setDraft(null);
    setCaption("");
    setEventId("");
    setProgress(0);
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
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
    // Photos get shrunk before upload, so only videos are checked against the cap here.
    if (kind === "video" && file.size > mediaRules.video.maxBytes) {
      return setStatus({
        text: `That video is ${megabytes(file.size)}. The limit is ${megabytes(mediaRules.video.maxBytes)}; trim it or put it in the Google Photos album.`,
        error: true,
      });
    }
    if (draft) URL.revokeObjectURL(draft.previewUrl);
    setStatus(null);
    const exif = kind === "image" ? await readPhotoGps(file) : null;
    setDraft({ file, kind, previewUrl: URL.createObjectURL(file), exif });
  }

  async function toggleSharing(on: boolean) {
    setLocationNote(null);
    if (!on) return setLocationSharing("no");
    // Asking for the position here is what makes the browser show its own prompt.
    const position = await currentPosition();
    if (position) return setLocationSharing("yes");
    setLocationSharing("no");
    setLocationNote("Your browser didn't share a location. Allow it in the browser's site settings, then tick this again.");
  }

  async function post() {
    if (!draft || !identity) return;
    const ok = await run(async () => {
      let url: string;
      if (!uploadsEnabled) {
        url = await inlinePhoto(draft.file);
      } else {
        const file = draft.kind === "image" ? await shrinkPhoto(draft.file) : draft.file;
        if (file.size > mediaRules[draft.kind].maxBytes) {
          throw new Error(`That file is over the ${megabytes(mediaRules[draft.kind].maxBytes)} limit.`);
        }
        url = await uploadMedia(file, draft.kind, identity, setProgress);
      }
      // The server picks between these: photo GPS, then the tagged event, then the device.
      const device = !draft.exif && sharing === "yes" ? await currentPosition() : null;
      await apiFetch("/api/posts", {
        method: "POST",
        body: { url, caption, eventId: eventId || null, exif: draft.exif, device },
      });
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

      {events && events.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">Where was this? (optional)</span>
          <select value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={busy} className={inputClass}>
            <option value="">No event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {dayParts(dayKey(event.startsAt)).weekday} {formatTime(event.startsAt)} · {event.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {draft.exif ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
          This photo knows where it was taken, so it will go on the map.
        </p>
      ) : (
        <label className="flex min-h-tap cursor-pointer items-start gap-3 py-1">
          <input
            type="checkbox"
            checked={sharing === "yes"}
            onChange={(event) => toggleSharing(event.target.checked)}
            disabled={busy}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="text-sm">
            <span className="block font-medium">Put my posts on the photo map</span>
            <span className="block text-muted">
              Uses where your phone is when you post, only to place the photo on the party map. Tagging an event
              above uses that event&apos;s spot instead.
            </span>
            {locationNote && <span className="mt-1 block text-danger">{locationNote}</span>}
          </span>
        </label>
      )}

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
