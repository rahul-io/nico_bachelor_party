"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { config } from "@/config";
import { useAction } from "@/hooks/useAction";
import { usePointsStatus } from "@/hooks/usePointsStatus";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import { categories, categoryDefaults, drinkCatalog } from "@/lib/drinks";
import type { DrinkOfDay, LastManCandidate } from "@/lib/points/service";
import type { PointsSettings } from "@/lib/points/settings";
import { dayParts, formatTime } from "@/lib/time";

const STATUS_PATH = "/api/points/status";
const DRINK_OF_DAY_PATH = "/api/admin/points/drink-of-day";
const LAST_MAN_PATH = "/api/admin/points/last-man";

function HappyHourCard() {
  const { mutate } = useSWRConfig();
  const status = usePointsStatus();
  const { data: settings } = usePolled<PointsSettings>("/api/points/settings");
  const { busy, status: message, run } = useAction();
  const [minutes, setMinutes] = useState("");
  const running = status?.happyHour;

  async function start() {
    const value = minutes.trim() ? Number(minutes) : undefined;
    const ok = await run(
      () => apiFetch("/api/admin/points/happy-hour", { method: "POST", body: { minutes: value } }),
      "Happy Hour is on",
    );
    if (ok) await mutate(STATUS_PATH);
  }

  async function stop() {
    const ok = await run(() => apiFetch("/api/admin/points/happy-hour", { method: "DELETE" }), "Happy Hour ended");
    if (ok) await mutate(STATUS_PATH);
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-bold">Happy Hour</h2>
      {running ? (
        <>
          <p>
            Running until {formatTime(running.endsAt)}. Drinks score {running.multiplier}×.
          </p>
          <Button variant="danger" block disabled={busy} onClick={stop}>
            End it now
          </Button>
        </>
      ) : (
        <>
          <Field
            label="Length, minutes"
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            placeholder={String(settings?.happyHourMinutes ?? 60)}
          />
          <Button variant="primary" block disabled={busy} onClick={start}>
            Start Happy Hour
          </Button>
        </>
      )}
      <Status status={message} />
    </Card>
  );
}

function DrinkOfDayRow({ day, pick }: { day: string; pick: DrinkOfDay | undefined }) {
  const { mutate } = useSWRConfig();
  const { busy, status, run } = useAction();
  const [type, setType] = useState<DrinkOfDay["type"]>(pick?.type ?? "drink");
  const [value, setValue] = useState(pick?.value ?? "");

  async function save(next: string) {
    const ok = await run(
      () => apiFetch(DRINK_OF_DAY_PATH, { method: "PUT", body: { day, type, value: next } }),
      next ? "Saved" : "Cleared",
    );
    if (ok) {
      if (!next) setValue("");
      await Promise.all([mutate(DRINK_OF_DAY_PATH), mutate(STATUS_PATH)]);
    }
  }

  return (
    <div className="space-y-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="font-semibold">{dayParts(day).long}</p>
      <div className="grid grid-cols-[7.5rem_1fr] gap-2">
        <select
          aria-label="Match by"
          value={type}
          onChange={(event) => {
            setType(event.target.value as DrinkOfDay["type"]);
            setValue("");
          }}
          className={inputClass}
        >
          <option value="drink">Drink</option>
          <option value="category">Category</option>
        </select>
        {type === "category" ? (
          <select aria-label="Category" value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryDefaults[category].label}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Drink name"
            list="catalogue-drinks"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={60}
            placeholder="Mai Tai"
            className={inputClass}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={busy || !pick} onClick={() => save("")}>
          Clear
        </Button>
        <Button variant="primary" disabled={busy || !value.trim()} onClick={() => save(value)}>
          Save
        </Button>
      </div>
      <Status status={status} />
    </div>
  );
}

function DrinkOfDayCard() {
  const { data } = usePolled<Record<string, DrinkOfDay>>(DRINK_OF_DAY_PATH);

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-bold">Drink of the Day</h2>
      <p className="text-sm text-muted">
        A drink matches by its exact name in the log, so pick one from the catalogue. Days run from the cutoff hour.
      </p>
      <datalist id="catalogue-drinks">
        {drinkCatalog.map((drink) => (
          <option key={drink.name} value={drink.name} />
        ))}
      </datalist>
      {data ? (
        // Keyed by the saved pick so a row resets when its saved value changes.
        config.days.map((day) => <DrinkOfDayRow key={`${day}:${data[day]?.value ?? ""}`} day={day} pick={data[day]} />)
      ) : (
        <p className="text-muted">Loading…</p>
      )}
    </Card>
  );
}

function AwardsCard() {
  const { mutate } = useSWRConfig();
  const { data } = usePolled<LastManCandidate[]>(LAST_MAN_PATH);
  const { busy, status, setStatus, run } = useAction();

  const refresh = () =>
    Promise.all([mutate(LAST_MAN_PATH), mutate(STATUS_PATH), mutate("/api/points"), mutate("/api/leaderboard")]);

  async function confirm(day: string) {
    const ok = await run(() => apiFetch(LAST_MAN_PATH, { method: "POST", body: { day } }), "Paid");
    if (ok) await refresh();
  }

  async function settle() {
    let paid = 0;
    const ok = await run(async () => {
      paid = (await apiFetch<{ paid: number }>("/api/admin/points/settle", { method: "POST" })).paid;
    });
    if (ok) {
      await refresh();
      setStatus({ text: paid === 0 ? "Nothing was due." : `Paid ${paid} ${paid === 1 ? "award" : "awards"}.` });
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-bold">Awards</h2>
      <p className="text-sm text-muted">
        Hourly and daily awards pay themselves the first time anyone opens the app after the hour or day ends.
      </p>
      <Button block disabled={busy} onClick={settle}>
        Settle now
      </Button>

      <h3 className="pt-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">Last Man Standing</h3>
      {!data && <p className="text-muted">Loading…</p>}
      {data?.length === 0 && <p className="text-muted">No day has finished yet.</p>}
      <ul className="space-y-2">
        {data?.map((item) => (
          <li key={item.day} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{dayParts(item.day).long}</p>
              <p className="text-sm text-muted">
                {item.name ? `${item.name}, photo at ${item.time}` : "No photo late enough"}
              </p>
            </div>
            {item.confirmed ? (
              <span className="shrink-0 text-sm font-semibold text-lagoon">Paid</span>
            ) : (
              item.name && (
                <Button variant="primary" disabled={busy} onClick={() => confirm(item.day)}>
                  Confirm
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
      <Status status={status} />
    </Card>
  );
}

/** The live controls: Happy Hour, Drink of the Day, and paying awards. */
export function MultipliersPanel() {
  return (
    <div className="space-y-4">
      <HappyHourCard />
      <DrinkOfDayCard />
      <AwardsCard />
    </div>
  );
}
