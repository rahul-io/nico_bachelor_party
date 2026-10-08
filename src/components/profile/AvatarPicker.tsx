"use client";

import { Camera } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { squareThumbnail } from "@/lib/image";

interface AvatarPickerProps {
  name: string;
  value: string | null;
  onChange: (avatarUrl: string | null) => void;
}

export function AvatarPicker({ name, value, onChange }: AvatarPickerProps) {
  const [error, setError] = useState<string | null>(null);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      onChange(await squareThumbnail(file));
      setError(null);
    } catch {
      setError("Couldn't read that photo. Try another one.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <label className="relative cursor-pointer">
        <Avatar name={name} src={value} size="lg" />
        <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-primary text-on-primary ring-2 ring-canvas">
          <Camera className="size-4" aria-hidden />
        </span>
        <input type="file" accept="image/*" onChange={pick} className="sr-only" aria-label="Choose a profile photo" />
      </label>
      <div className="text-sm">
        <p className="font-medium">Profile photo</p>
        <p className={error ? "text-danger" : "text-muted"}>{error ?? "Tap to pick one. Optional."}</p>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="mt-1 text-muted underline underline-offset-4">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
