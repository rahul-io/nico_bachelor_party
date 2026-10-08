"use client";

import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import type { AdminGames } from "@/lib/games/board";
import { formatTime, formatWeekdayTime } from "@/lib/time";

const PATH = "/api/admin/games";
const eyebrow = "text-xs font-semibold uppercase tracking-[0.16em] text-accent";

/** Admin's side of the games: the groom, Bartender's Choice, and undoing things. */
export function GamesPanel() {
  const { mutate } = useSWRConfig();
  const { data } = usePolled<AdminGames>(PATH);
  const { busy, status, setStatus, run } = useAction();

  if (!data) return <Card className="text-muted">Loading…</Card>;

  async function act(body: Record<string, unknown>, done?: string) {
    const ok = await run(() => apiFetch(PATH, { method: "POST", body }), done);
    if (ok) await Promise.all([PATH, "/api/games", "/api/leaderboard", "/api/points"].map((key) => mutate(key)));
  }

  async function pour() {
    let assigned = 0;
    const ok = await run(async () => {
      assigned = (await apiFetch<{ assigned: number }>(PATH, { method: "POST", body: { action: "bartender" } })).assigned;
    });
    if (ok) {
      setStatus({
        text:
          assigned === 0
            ? "Nobody has logged anything recently, so nobody was given a drink."
            : `Gave ${assigned} ${assigned === 1 ? "player" : "players"} a drink.`,
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold">The groom</h2>
        <select
          aria-label="The groom"
          value={data.groomId ?? ""}
          disabled={busy}
          onChange={(event) => act({ action: "setGroom", profileId: event.target.value }, "Saved")}
          className={inputClass}
        >
          <option value="">Not set (Groom Tax is off)</option>
          {data.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold">Bartender&apos;s Choice</h2>
        <p className="text-sm text-muted">
          Gives everyone who has logged recently a random drink to log for a multiplier. A new round replaces any
          order still open.
        </p>
        <Button variant="primary" block disabled={busy} onClick={pour}>
          Pour a round of orders
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold">Wagers</h2>
        {data.wagers.length === 0 && <p className="text-muted">Nothing running.</p>}
        {data.wagers.map((wager) => (
          <div key={wager.id} className="space-y-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
            <p className="font-semibold">
              {wager.challenger.name} vs {wager.opponent.name} · {wager.stake}
            </p>
            <p className="text-sm text-muted">
              {wager.description} · {wager.status === "disputed" ? "they disagree" : "waiting for results"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[wager.challenger, wager.opponent].map((player) => (
                <Button
                  key={player.id}
                  disabled={busy}
                  className="px-2 text-sm"
                  onClick={() => act({ action: "resolveWager", id: wager.id, winnerId: player.id }, `${player.name} wins`)}
                >
                  {player.name} won
                </Button>
              ))}
              <Button
                variant="danger"
                disabled={busy}
                className="px-2 text-sm"
                onClick={() => act({ action: "voidWager", id: wager.id }, "Called off; stakes refunded")}
              >
                Call off
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold">Undo</h2>
        <h3 className={eyebrow}>Active curses</h3>
        {data.curses.length === 0 && <p className="text-muted">None.</p>}
        <ul className="space-y-2">
          {data.curses.map((curse) => (
            <li key={curse.id} className="flex items-center gap-3">
              <p className="min-w-0 flex-1">
                <span className="font-semibold">{curse.name}</span> on {curse.target}
                <span className="block text-sm text-muted">
                  From {curse.from}
                  {curse.expiresAt && ` · until ${formatTime(curse.expiresAt)}`}
                </span>
              </p>
              <Button disabled={busy} onClick={() => act({ action: "revertCurse", id: curse.id }, "Lifted")}>
                Lift
              </Button>
            </li>
          ))}
        </ul>

        <h3 className={`${eyebrow} pt-1`}>Groom Taxes</h3>
        {data.groomTaxes.length === 0 && <p className="text-muted">None paid.</p>}
        <ul className="space-y-2">
          {data.groomTaxes.map((tax) => (
            <li key={tax.id} className="flex items-center gap-3">
              <p className="min-w-0 flex-1">
                {tax.player}
                <span className="block text-sm text-muted">{formatWeekdayTime(tax.createdAt)}</span>
              </p>
              <Button variant="danger" disabled={busy} onClick={() => act({ action: "voidGroomTax", id: tax.id }, "Taken back")}>
                Void
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Status status={status} />
    </div>
  );
}
