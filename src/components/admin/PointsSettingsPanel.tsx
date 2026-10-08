"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import { settingDefs, type PointsSettings, type SettingKey } from "@/lib/points/settings";

const SETTINGS_PATH = "/api/points/settings";
const groups = [...new Set(settingDefs.map((def) => def.group))];

/** Every number in the points economy. Changes apply to what is logged from then on. */
export function PointsSettingsPanel() {
  const { mutate } = useSWRConfig();
  const { data } = usePolled<PointsSettings>(SETTINGS_PATH);
  const { busy, status, setStatus, run } = useAction();
  // Only the fields being edited; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<Record<SettingKey, string>>>({});

  if (!data) return <Card className="text-muted">Loading…</Card>;

  async function save() {
    const body: Partial<PointsSettings> = { ...data };
    for (const def of settingDefs) {
      const typed = draft[def.key];
      if (typed === undefined) continue;
      const value = Number(typed);
      if (typed.trim() === "" || !Number.isFinite(value)) {
        return setStatus({ text: `${def.label}: enter a number.`, error: true });
      }
      body[def.key] = value;
    }
    const ok = await run(() => apiFetch("/api/admin/points/settings", { method: "PUT", body }), "Saved");
    if (ok) {
      setDraft({});
      await Promise.all([mutate(SETTINGS_PATH), mutate("/api/points/status")]);
    }
  }

  async function reset() {
    if (!window.confirm("Put every points setting back to its default?")) return;
    const ok = await run(() => apiFetch("/api/admin/points/settings", { method: "DELETE" }), "Back to defaults");
    if (ok) {
      setDraft({});
      await Promise.all([mutate(SETTINGS_PATH), mutate("/api/points/status")]);
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group} className="space-y-3">
          <h2 className="font-display text-lg font-bold">{group}</h2>
          {settingDefs
            .filter((def) => def.group === group)
            .map((def) => (
              <Field
                key={def.key}
                label={`${def.label}${data[def.key] !== def.value ? ` (default ${def.value})` : ""}`}
                type="number"
                inputMode="decimal"
                min={def.min}
                max={def.max}
                step={def.step}
                value={draft[def.key] ?? String(data[def.key])}
                onChange={(event) => setDraft({ ...draft, [def.key]: event.target.value })}
              />
            ))}
        </Card>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={busy} onClick={reset}>
          Reset to defaults
        </Button>
        <Button variant="primary" disabled={busy} onClick={save}>
          Save
        </Button>
      </div>
      <Status status={status} />
    </div>
  );
}
