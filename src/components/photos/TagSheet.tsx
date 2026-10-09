"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useGamesBoard } from "@/hooks/useGames";
import { cn } from "@/lib/cn";

/** Chips for picking who is in a photo. Used when posting and when editing tags afterwards. */
export function PeoplePicker({ value, onChange, disabled }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const people = useGamesBoard()?.people ?? [];
  if (people.length === 0) return <p className="text-sm text-muted">Loading the crew…</p>;

  return (
    <ul className="flex flex-wrap gap-2">
      {people.map((person) => {
        const on = value.includes(person.id);
        return (
          <li key={person.id}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((id) => id !== person.id) : [...value, person.id])}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm font-medium transition",
                on ? "border-transparent bg-select text-on-select" : "border-line bg-raised text-ink",
              )}
            >
              {person.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function TagSheet({ initial, onSave, onClose }: { initial: string[]; onSave: (ids: string[]) => Promise<void>; onClose: () => void }) {
  const [ids, setIds] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <Sheet
      title="Who's in this?"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(ids);
          }}
        >
          Save tags
        </Button>
      }
    >
      <div className="p-4">
        <PeoplePicker value={ids} onChange={setIds} disabled={busy} />
      </div>
    </Sheet>
  );
}
