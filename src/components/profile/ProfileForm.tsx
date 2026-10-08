"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SESSION_KEY, type SessionResponse } from "@/hooks/useProfile";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";
import type { Profile, ProfileInput, Sex } from "@/lib/store/types";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from "@/lib/units";

const sexes: Array<{ value: Sex; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/** Creates an account (with a password) when `initial` is absent, otherwise edits the profile. */
export function ProfileForm({ initial }: { initial?: Profile }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const initialHeight = initial ? cmToFeetInches(initial.heightCm) : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? null);
  const [feet, setFeet] = useState(initialHeight ? String(initialHeight.feet) : "");
  const [inches, setInches] = useState(initialHeight ? String(initialHeight.inches) : "");
  const [weight, setWeight] = useState(initial ? String(kgToLb(initial.weightKg)) : "");
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "male");
  const [showBac, setShowBac] = useState(initial?.showBacOnPosts ?? true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !feet || !weight) {
      setStatus({ text: "Fill in your name, height and weight.", error: true });
      return;
    }
    if (!initial && password.length < MIN_PASSWORD_LENGTH) {
      setStatus({ text: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`, error: true });
      return;
    }
    const body: ProfileInput = {
      name: name.trim(),
      avatarUrl,
      heightCm: feetInchesToCm(Number(feet), Number(inches || 0)),
      weightKg: lbToKg(Number(weight)),
      sex,
      showBacOnPosts: showBac,
    };

    setSaving(true);
    setStatus(null);
    try {
      if (initial) {
        const saved = await apiFetch<SessionResponse>("/api/profiles/me", { method: "PATCH", body });
        await mutate(SESSION_KEY, saved, { revalidate: false });
        setStatus({ text: "Saved" });
      } else {
        const created = await apiFetch<SessionResponse>("/api/auth/signup", {
          method: "POST",
          body: { ...body, password },
        });
        await mutate(SESSION_KEY, created, { revalidate: false });
        router.replace("/schedule");
      }
    } catch (error) {
      setStatus({
        text: error instanceof ApiError ? error.message : "Something went wrong. Try again.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <AvatarPicker name={name} value={avatarUrl} onChange={setAvatarUrl} />

      <Field
        label="Display name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={30}
        autoComplete="nickname"
        placeholder="What the crew calls you"
      />

      {!initial && (
        <Field
          label={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        <Field
          label="Height"
          suffix="ft"
          inputMode="numeric"
          value={feet}
          onChange={(event) => setFeet(event.target.value)}
          placeholder="5"
        />
        <Field
          label={" "}
          aria-label="Height, inches"
          suffix="in"
          inputMode="numeric"
          value={inches}
          onChange={(event) => setInches(event.target.value)}
          placeholder="10"
        />
        <Field
          label="Weight"
          suffix="lb"
          inputMode="numeric"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          placeholder="180"
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-muted">Sex</legend>
        <div className="grid grid-cols-2 gap-2">
          {sexes.map(({ value, label }) => (
            <label
              key={value}
              className={cn(
                "flex min-h-tap cursor-pointer items-center justify-center rounded-control border font-medium transition",
                sex === value
                  ? "border-select bg-select text-on-select"
                  : "border-line bg-raised text-muted",
              )}
            >
              <input
                type="radio"
                name="sex"
                value={value}
                checked={sex === value}
                onChange={() => setSex(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Height, weight and sex are only used to work out your BAC. Nobody else can see them.
        </p>
      </fieldset>

      <label className="flex min-h-tap cursor-pointer items-center gap-3 rounded-control border border-line bg-surface px-3 py-2">
        <input
          type="checkbox"
          checked={showBac}
          onChange={(event) => setShowBac(event.target.checked)}
          className="size-5 shrink-0 accent-accent"
        />
        <span>
          <span className="block font-medium">Show my BAC on my posts and comments</span>
          <span className="block text-xs text-muted">
            Stamps your BAC on each entry at the moment you post or comment.
          </span>
        </span>
      </label>

      <Button type="submit" variant="primary" block disabled={saving}>
        {saving ? "Saving…" : initial ? "Save changes" : "Come aboard"}
      </Button>
      <p aria-live="polite" className={cn("min-h-5 text-center text-sm", status?.error ? "text-danger" : "text-muted")}>
        {status?.text}
      </p>
    </form>
  );
}
