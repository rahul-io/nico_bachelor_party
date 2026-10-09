"use client";

import { useState, type ChangeEvent } from "react";
import { useSWRConfig } from "swr";
import { BadgeIcon } from "@/components/badges/TrophyCase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import { MOST_METRICS, describeRule, type MostMetric, type Rule, type What } from "@/lib/badges/rules";
import type { AdminBadge, AdminBadges, BadgeKind } from "@/lib/badges/service";
import { categories, categoryDefaults } from "@/lib/drinks";
import { squareThumbnail } from "@/lib/image";
import { dayParts } from "@/lib/time";

const PATH = "/api/admin/badges";
const eyebrow = "text-xs font-semibold uppercase tracking-[0.16em] text-accent";

const metricLabels: Record<MostMetric, string> = {
  photos: "Photos posted",
  taggedPhotos: "Photos tagging someone else",
  waters: "Waters",
  drinks: "Drinks",
  categoryDrinks: "Drinks of a category",
  groomTaxes: "Groom Taxes",
  cursesReceived: "Curses received",
};

const ruleTypes: Array<{ value: Rule["type"]; label: string }> = [
  { value: "count", label: "Count: log N of something" },
  { value: "threshold", label: "Threshold: reach a BAC" },
  { value: "time", label: "Time of day: log before or after a time" },
  { value: "first", label: "First of the day to reach a BAC" },
  { value: "most", label: "Most of something that day" },
];

const starters: Record<Rule["type"], Rule> = {
  count: { type: "count", what: { kind: "drink" }, n: 3, window: "hour" },
  threshold: { type: "threshold", bac: 0.08 },
  time: { type: "time", what: { kind: "drink" }, when: "before", time: "10:00" },
  first: { type: "first", bac: 0.08 },
  most: { type: "most", metric: "photos" },
};

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const categoryOptions = categories.map((category) => ({ value: category, label: categoryDefaults[category].label }));

/** What a count or time rule looks at: any drink, a category, a tag, one exact drink, or water. */
function WhatFields({ what, onChange }: { what: What; onChange: (what: What) => void }) {
  const mode = what.kind === "water" ? "water" : what.category ? "category" : what.tag ? "tag" : what.name !== undefined ? "name" : "drink";
  return (
    <>
      <Select
        label="Of"
        value={mode}
        onChange={(next) =>
          onChange(
            next === "water"
              ? { kind: "water" }
              : next === "category"
                ? { kind: "drink", category: "beer" }
                : next === "tag"
                  ? { kind: "drink", tag: "fruity" }
                  : next === "name"
                    ? { kind: "drink", name: "" }
                    : { kind: "drink" },
          )
        }
        options={[
          { value: "drink", label: "Any drink" },
          { value: "category", label: "A drink category" },
          { value: "tag", label: "A tagged drink (fruity)" },
          { value: "name", label: "One exact drink" },
          { value: "water", label: "Water" },
        ]}
      />
      {what.kind === "drink" && mode === "category" && (
        <Select label="Category" value={what.category ?? "beer"} onChange={(category) => onChange({ kind: "drink", category })} options={categoryOptions} />
      )}
      {what.kind === "drink" && mode === "name" && (
        <Field label="Drink name, exactly as in the catalogue" value={what.name ?? ""} onChange={(event) => onChange({ kind: "drink", name: event.target.value })} placeholder="Mai Tai" />
      )}
    </>
  );
}

/** Builds a rule with no code, and shows what it means in plain English. */
function RuleBuilder({ rule, onChange }: { rule: Rule; onChange: (rule: Rule) => void }) {
  const bacField = (value: number, set: (bac: number) => void) => (
    <Field label="Estimated BAC, %" type="number" inputMode="decimal" step={0.01} min={0.01} max={0.5} value={String(value)} onChange={(event) => set(Number(event.target.value))} />
  );

  return (
    <div className="space-y-3 rounded-card border border-line p-3">
      <Select label="Rule" value={rule.type} onChange={(type) => onChange(starters[type as Rule["type"]])} options={ruleTypes} />
      {rule.type === "count" && (
        <>
          <Field label="How many" type="number" inputMode="numeric" min={1} max={50} value={String(rule.n)} onChange={(event) => onChange({ ...rule, n: Number(event.target.value) })} />
          <WhatFields what={rule.what} onChange={(what) => onChange({ ...rule, what })} />
          <Select
            label="Within"
            value={rule.window}
            onChange={(window) => onChange({ ...rule, window: window as "hour" | "day" | "weekend" })}
            options={[
              { value: "hour", label: "A rolling hour (repeatable)" },
              { value: "day", label: "One day (once a day)" },
              { value: "weekend", label: "The whole weekend (once)" },
            ]}
          />
        </>
      )}
      {rule.type === "threshold" && bacField(rule.bac, (bac) => onChange({ ...rule, bac }))}
      {rule.type === "first" && bacField(rule.bac, (bac) => onChange({ ...rule, bac }))}
      {rule.type === "time" && (
        <>
          <WhatFields what={rule.what} onChange={(what) => onChange({ ...rule, what })} />
          <Select label="When" value={rule.when} onChange={(when) => onChange({ ...rule, when: when as "before" | "after" })} options={[{ value: "before", label: "Before" }, { value: "after", label: "After" }]} />
          <Field label="Time (party time)" type="time" value={rule.time} onChange={(event) => onChange({ ...rule, time: event.target.value })} />
        </>
      )}
      {rule.type === "most" && (
        <>
          <Select
            label="Most"
            value={rule.metric}
            onChange={(metric) =>
              onChange(metric === "categoryDrinks" ? { type: "most", metric, category: "beer" } : { type: "most", metric: metric as MostMetric })
            }
            options={MOST_METRICS.map((metric) => ({ value: metric, label: metricLabels[metric] }))}
          />
          {rule.metric === "categoryDrinks" && (
            <Select label="Category" value={rule.category ?? "beer"} onChange={(category) => onChange({ ...rule, category })} options={categoryOptions} />
          )}
        </>
      )}
      <p className="rounded-control bg-raised px-3 py-2 text-sm">
        <span className="font-semibold">In plain English: </span>
        {describeRule(rule)}
      </p>
    </div>
  );
}

type Editing = { badge: AdminBadge | null; source: "manual" | "rule" | "coded" };

function BadgeSheet({ editing, people, onClose }: { editing: Editing; people: AdminBadges["people"]; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const { busy, status, setStatus, run } = useAction();
  const { badge, source } = editing;

  const [name, setName] = useState(badge?.name ?? "");
  const [description, setDescription] = useState(badge?.description ?? "");
  const [emoji, setEmoji] = useState(badge?.emoji ?? "🏅");
  const [imageUrl, setImageUrl] = useState(badge?.imageUrl ?? null);
  const [kind, setKind] = useState<BadgeKind>(badge?.kind ?? "merit");
  const [points, setPoints] = useState(String(badge?.points ?? 2));
  const [active, setActive] = useState(badge?.active ?? true);
  const [hidden, setHidden] = useState(badge?.hidden ?? false);
  const [rule, setRule] = useState<Rule>(badge?.rule ?? starters.count);
  const [awardTo, setAwardTo] = useState("");
  const [reason, setReason] = useState("");

  const refresh = () => Promise.all([PATH, "/api/leaderboard", "/api/points"].map((key) => mutate(key)));
  const post = (body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(PATH, { method: "POST", body });

  async function pickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Cropped square and shrunk to 256 px here, so only a small image is sent.
    await run(async () => {
      const dataUrl = await squareThumbnail(file, 256, 0.85, "image/webp");
      setImageUrl((await post({ action: "image", dataUrl })).imageUrl as string);
    });
  }

  async function save() {
    const ok = await run(
      () =>
        post({
          action: "save",
          id: badge?.id ?? "",
          badge: { name, description, emoji, imageUrl, kind, points: Number(points), active, hidden, rule: source === "rule" ? rule : null },
        }),
      "Saved",
    );
    if (ok) {
      await refresh();
      if (!badge) onClose();
    }
  }

  async function act(body: Record<string, unknown>, done: string) {
    if (await run(() => post(body), done)) await refresh();
  }

  async function recalculate() {
    if (!badge) return;
    if (!window.confirm(`Re-price every ${badge.name} already awarded at ${badge.points} points? Save first if you just changed the points.`)) return;
    let changed = 0;
    const ok = await run(async () => {
      changed = (await post({ action: "recalculate", badgeId: badge.id })).changed as number;
    });
    if (ok) {
      await refresh();
      setStatus({ text: `Recalculated ${changed} ${changed === 1 ? "award" : "awards"}.` });
    }
  }

  return (
    <Sheet
      title={badge ? badge.name : source === "rule" ? "New rule badge" : "New manual badge"}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={busy} onClick={save}>
          {badge ? "Save changes" : "Create badge"}
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-4">
          <BadgeIcon badge={{ imageUrl, emoji }} size="md" />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-tap cursor-pointer items-center rounded-control border border-line bg-surface px-4 font-medium">
              {imageUrl ? "Replace image" : "Add image"}
              <input type="file" accept="image/*" onChange={pickImage} className="sr-only" />
            </label>
            {imageUrl && (
              <Button variant="ghost" disabled={busy} onClick={() => setImageUrl(null)}>
                Use the emoji
              </Button>
            )}
          </div>
        </div>
        <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
        <Field label="Description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Emoji fallback" value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={8} />
          <Field label="Points" type="number" inputMode="decimal" min={0} max={200} value={points} onChange={(event) => setPoints(event.target.value)} />
        </div>
        {badge && <p className="text-sm text-muted">A points change applies to badges awarded from now on.</p>}

        {source === "manual" && (
          <Select
            label="Type"
            value={kind}
            onChange={(value) => setKind(value as BadgeKind)}
            options={[
              { value: "merit", label: "Merit badge (anyone, repeatable)" },
              { value: "achievement", label: "Achievement (one holder)" },
            ]}
          />
        )}
        {source === "rule" && <RuleBuilder rule={rule} onChange={setRule} />}
        {source === "coded" && badge && (
          <p className="rounded-control bg-raised px-3 py-2 text-sm">
            <span className="font-semibold">Coded: </span>
            {badge.condition} This condition is written in code and can&apos;t be edited here.
          </p>
        )}

        <label className="flex min-h-tap cursor-pointer items-center gap-3">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-5 accent-accent" />
          <span className="font-medium">Active</span>
        </label>
        <label className="flex min-h-tap cursor-pointer items-center gap-3">
          <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} className="size-5 accent-accent" />
          <span className="font-medium">Hidden until someone earns it</span>
        </label>

        {badge && (
          <>
            <h3 className={`${eyebrow} pt-2`}>Holders</h3>
            {badge.leader && <p className="text-sm text-muted">Leading today: {badge.leader} (awarded at the day&apos;s end).</p>}
            {badge.holders.length === 0 && <p className="text-muted">Nobody yet.</p>}
            <ul className="space-y-2">
              {badge.holders.map((holder) => (
                <li key={holder.awardId} className="flex items-center gap-3">
                  <p className="min-w-0 flex-1">
                    {holder.name}
                    <span className="block text-sm text-muted">
                      {dayParts(holder.period).weekday}
                      {holder.reason && ` · ${holder.reason}`}
                    </span>
                  </p>
                  <Button variant="danger" disabled={busy} onClick={() => act({ action: "revoke", awardId: holder.awardId }, "Revoked")}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>

            <h3 className={`${eyebrow} pt-2`}>Award by hand</h3>
            <Select label="To" value={awardTo} onChange={setAwardTo} options={[{ value: "", label: "Choose…" }, ...people.map((person) => ({ value: person.id, label: person.name }))]} />
            <Field label="Reason (shown in the points history)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={140} />
            <Button block disabled={busy || !awardTo} onClick={() => act({ action: "award", badgeId: badge.id, profileId: awardTo, reason }, "Awarded").then(() => setReason(""))}>
              Award {badge.name}
            </Button>

            <Button variant="danger" block disabled={busy || badge.holders.length === 0} onClick={recalculate}>
              Recalculate all
            </Button>
          </>
        )}
        <Status status={status} />
      </div>
    </Sheet>
  );
}

/** Every badge and who holds it; create, edit, award and revoke; confirm Sleeping Beauty. */
export function BadgesPanel() {
  const { mutate } = useSWRConfig();
  const { data } = usePolled<AdminBadges>(PATH);
  const { busy, status, run } = useAction();
  const [editing, setEditing] = useState<{ id: string | null; source: Editing["source"] } | null>(null);

  if (!data) return <Card className="text-muted">Loading…</Card>;
  const open = editing && { source: editing.source, badge: data.badges.find((badge) => badge.id === editing.id) ?? null };

  async function confirmSleeping(day: string) {
    const ok = await run(() => apiFetch(PATH, { method: "POST", body: { action: "confirmSleeping", day } }), "Awarded and pinned");
    if (ok) await Promise.all([PATH, "/api/posts", "/api/leaderboard"].map((key) => mutate(key)));
  }

  return (
    <div className="mx-auto max-w-app space-y-4">
      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold">Sleeping Beauty</h2>
        <p className="text-sm text-muted">The day&apos;s first photo marked asleep with someone tagged. Confirming awards everyone tagged and pins the photo.</p>
        <ul className="space-y-3">
          {data.sleeping.map((item) => (
            <li key={item.day} className="flex items-center gap-3">
              {item.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- feed preview, already sized
                <img src={item.photoUrl} alt="" className="size-16 shrink-0 rounded-control object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{dayParts(item.day).long}</p>
                <p className="text-sm text-muted">{item.postId ? `${item.sleepers.join(", ")} · ${item.time}` : "No asleep photo"}</p>
              </div>
              {item.confirmed ? (
                <span className="shrink-0 text-sm font-semibold text-lagoon">Awarded</span>
              ) : (
                item.postId && (
                  <Button variant="primary" disabled={busy} onClick={() => confirmSleeping(item.day)}>
                    Confirm
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
        <Status status={status} />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setEditing({ id: null, source: "manual" })}>New manual badge</Button>
        <Button onClick={() => setEditing({ id: null, source: "rule" })}>New rule badge</Button>
      </div>

      <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
        {data.badges.map((badge) => (
          <li key={badge.id}>
            <button type="button" onClick={() => setEditing({ id: badge.id, source: badge.source })} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${badge.active ? "" : "opacity-50"}`}>
              <BadgeIcon badge={badge} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {badge.name} <span className="font-normal text-muted">· {badge.points} pts</span>
                </p>
                <p className="text-sm text-muted">
                  {badge.kind === "achievement" ? "Achievement" : "Merit"} · {badge.source}
                  {!badge.active && " · off"}
                  {badge.hidden && " · hidden"}
                </p>
                <p className="truncate text-sm text-muted">
                  {badge.holders.length === 0 ? "No holders" : `Held by ${[...new Set(badge.holders.map((holder) => holder.name))].join(", ")}`}
                  {badge.leader && ` · leading today: ${badge.leader}`}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <BadgeSheet
          // A fresh form per badge, so one badge's edits never show on another.
          key={editing?.id ?? `new-${editing?.source}`}
          editing={open}
          people={data.people}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
