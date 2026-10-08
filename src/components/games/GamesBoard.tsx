"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { useGamesBoard, useGamesMe, useRefreshGames } from "@/hooks/useGames";
import { usePolled } from "@/hooks/usePolled";
import { useIdentity } from "@/hooks/useProfile";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { GamesBoard as Board } from "@/lib/games/board";
import { CURSE_TYPES, MAX_HIJACK_NAME, curseNames, type CurseType } from "@/lib/games/curses";
import type { SnitchView } from "@/lib/games/snitch";
import type { WagerView } from "@/lib/games/wagers";
import type { Feed } from "@/lib/store/types";
import { formatTime } from "@/lib/time";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.16em] text-accent";

type Form = { kind: "wager" } | { kind: "snitch" } | { kind: "curse"; type: CurseType };

const curseBlurbs: Record<CurseType, string> = {
  name: "They show under a name you choose for a while.",
  deadweight: "Their next drink scores nothing.",
  avatar: "Their picture becomes a photo you pick, until midnight.",
  shield: "Blocks the next curse aimed at you.",
};

function PersonSelect({ label, people, value, onChange }: { label: string; people: Board["people"]; value: string; onChange: (id: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">Choose…</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A grid of photos from the Captain's Log to attach. */
function PhotoPicker({ value, onChange }: { value: string; onChange: (postId: string) => void }) {
  const { data } = usePolled<Feed>("/api/posts");
  const photos = (data?.posts ?? []).filter((post) => post.mediaType === "image").slice(0, 18);

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-muted">Photo from the Captain&apos;s Log</p>
      {photos.length === 0 ? (
        <p className="text-sm text-muted">There are no photos in the log yet. Post one first.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => onChange(post.id)}
                aria-label={`Photo by ${post.posterName}`}
                aria-pressed={value === post.id}
                className={cn(
                  "block aspect-square w-full overflow-hidden rounded-control border-2",
                  value === post.id ? "border-gold" : "border-transparent opacity-80",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- feed previews, already sized */}
                <img src={post.url} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GameForm({ form, board, myId, onClose }: { form: Form; board: Board; myId: string; onClose: () => void }) {
  const refresh = useRefreshGames();
  const { busy, status, run } = useAction();
  const [personId, setPersonId] = useState("");
  const [text, setText] = useState("");
  const [stake, setStake] = useState("");
  const [postId, setPostId] = useState("");
  const others = board.people.filter((person) => person.id !== myId);

  const title =
    form.kind === "wager" ? "Challenge someone" : form.kind === "snitch" ? "Report to the Snitch Line" : curseNames[form.type];

  async function submit() {
    const request =
      form.kind === "wager"
        ? { path: "/api/games/wagers", body: { opponentId: personId, stake: Number(stake), description: text } }
        : form.kind === "snitch"
          ? { path: "/api/games/snitches", body: { accusedId: personId, reason: text, postId } }
          : {
              path: "/api/games/curses",
              body: { type: form.type, targetId: personId, value: form.type === "avatar" ? postId : text },
            };
    const ok = await run(() => apiFetch(request.path, { method: "POST", body: request.body }));
    if (ok) {
      await refresh();
      onClose();
    }
  }

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={busy} onClick={submit}>
          {form.kind === "curse" ? `Pay ${board.prices[form.type]} points` : form.kind === "wager" ? "Send challenge" : "Report"}
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        {form.kind === "curse" && <p className="text-muted">{curseBlurbs[form.type]}</p>}
        {!(form.kind === "curse" && form.type === "shield") && (
          <PersonSelect
            label={form.kind === "wager" ? "Against" : form.kind === "snitch" ? "Who did it" : "On"}
            people={others}
            value={personId}
            onChange={setPersonId}
          />
        )}
        {form.kind === "wager" && (
          <>
            <Field
              label={`Stake, points each (up to ${board.maxStake})`}
              inputMode="numeric"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
              placeholder="5"
            />
            <Field label="What's the wager?" value={text} onChange={(event) => setText(event.target.value)} maxLength={140} placeholder="First to finish their pint" />
          </>
        )}
        {form.kind === "snitch" && (
          <>
            <Field label="What they did" value={text} onChange={(event) => setText(event.target.value)} maxLength={140} placeholder="Poured one out" />
            <PhotoPicker value={postId} onChange={setPostId} />
          </>
        )}
        {form.kind === "curse" && form.type === "name" && (
          <Field label="Their new name" value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_HIJACK_NAME} placeholder="Captain Clown" />
        )}
        {form.kind === "curse" && form.type === "avatar" && <PhotoPicker value={postId} onChange={setPostId} />}
        <Status status={status} />
      </div>
    </Sheet>
  );
}

function WagerCard({ wager, myId }: { wager: WagerView; myId: string }) {
  const refresh = useRefreshGames();
  const { busy, status, run } = useAction();
  const [stake, setStake] = useState("");
  const players = [wager.challenger, wager.opponent];
  const playing = players.some((player) => player.id === myId);
  const winner = players.find((player) => player.id === wager.winnerId);

  async function act(body: Record<string, unknown>) {
    const ok = await run(() => apiFetch(`/api/games/wagers/${wager.id}`, { method: "POST", body }));
    if (ok) await refresh();
  }

  const sidePot = Object.values(wager.sidePots).reduce((sum, points) => sum + points, 0);

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {wager.challenger.name} <span className="font-normal text-muted">vs</span> {wager.opponent.name}
          </p>
          <p className="text-muted">{wager.description}</p>
        </div>
        <span className="shrink-0 font-display text-xl font-bold tabular-nums text-accent">{wager.stake}</span>
      </div>

      {wager.status === "pending" && (
        <>
          <p className="text-sm text-muted">
            Waiting for {wager.opponent.name}
            {wager.expiresAt && ` until ${formatTime(wager.expiresAt)}`}.
          </p>
          {wager.opponent.id === myId && (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={() => act({ action: "decline" })}>
                Decline
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => act({ action: "accept" })}>
                Accept
              </Button>
            </div>
          )}
          {wager.challenger.id === myId && (
            <Button block disabled={busy} onClick={() => act({ action: "decline" })}>
              Withdraw
            </Button>
          )}
        </>
      )}

      {wager.status === "accepted" && (
        <>
          {sidePot > 0 && (
            <p className="text-sm text-muted">
              Side bets: {players.map((player) => `${wager.sidePots[player.id] ?? 0} on ${player.name}`).join(", ")}
              {wager.mySide && ` (${wager.mySide.stake} of it yours)`}
            </p>
          )}
          {playing ? (
            wager.reported.includes(myId) ? (
              <p className="text-sm text-muted">You&apos;ve reported. Waiting for the other side.</p>
            ) : (
              <>
                <p className="text-sm font-medium">Who won?</p>
                <div className="grid grid-cols-2 gap-2">
                  {players.map((player) => (
                    <Button key={player.id} disabled={busy} onClick={() => act({ action: "report", winnerId: player.id })}>
                      {player.id === myId ? "I did" : player.name}
                    </Button>
                  ))}
                </div>
              </>
            )
          ) : wager.reported.length > 0 ? (
            <p className="text-sm text-muted">Side bets are closed.</p>
          ) : (
            <>
              <Field
                label="Side bet, points"
                inputMode="numeric"
                value={stake}
                onChange={(event) => setStake(event.target.value)}
                placeholder="3"
              />
              <div className="grid grid-cols-2 gap-2">
                {players.map((player) => (
                  <Button
                    key={player.id}
                    disabled={busy || !stake.trim() || (wager.mySide !== null && wager.mySide.side !== player.id)}
                    onClick={() => act({ action: "bet", side: player.id, stake: Number(stake) }).then(() => setStake(""))}
                  >
                    Back {player.name}
                  </Button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {wager.status === "disputed" && <p className="text-sm text-muted">They disagree on who won. An admin will decide.</p>}
      {wager.status === "settled" && winner && <p className="text-sm font-medium text-lagoon">{winner.name} won.</p>}
      {status?.error && <Status status={status} />}
    </Card>
  );
}

function ReportCard({ report, myId }: { report: SnitchView; myId: string }) {
  const refresh = useRefreshGames();
  const { busy, status, run } = useAction();
  const involved = report.reporter.id === myId || report.accused.id === myId;

  async function vote() {
    const ok = await run(() => apiFetch(`/api/games/snitches/${report.id}`, { method: "POST" }));
    if (ok) await refresh();
  }

  return (
    <Card className="flex gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- feed preview, already sized */}
      <img src={report.photoUrl} alt="" className="size-20 shrink-0 rounded-control object-cover" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{report.accused.name}</p>
        <p className="text-muted">{report.reason}</p>
        <p className="text-sm text-muted">
          Reported by {report.reporter.name} · {report.votes} of {report.needed} votes · closes {formatTime(report.expiresAt)}
        </p>
        {!involved && (
          <Button disabled={busy || report.voted} onClick={vote}>
            {report.voted ? "Upvoted" : "Upvote"}
          </Button>
        )}
        {status?.error && <Status status={status} />}
      </div>
    </Card>
  );
}

/** Wagers, curses and the Snitch Line. */
export function GamesBoard() {
  const identity = useIdentity();
  const board = useGamesBoard();
  const me = useGamesMe();
  const [form, setForm] = useState<Form | null>(null);

  if (!board || !identity) return <Card className="text-muted">Loading…</Card>;
  const myId = identity.id;

  return (
    <div className="space-y-6">
      {me && (
        <p className="text-muted">
          You have <span className="font-display text-lg font-bold tabular-nums text-accent">{me.balance}</span> points
          to spend. Stakes and curses come out of your total.
        </p>
      )}

      <section className="space-y-3">
        <h2 className={eyebrow}>Wagers</h2>
        {board.wagers.length === 0 && <Card className="text-muted">No wagers on the table.</Card>}
        {board.wagers.map((wager) => (
          <WagerCard key={wager.id} wager={wager} myId={myId} />
        ))}
        <Button variant="primary" block onClick={() => setForm({ kind: "wager" })}>
          Challenge someone
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className={eyebrow}>Curses</h2>
        <ul className="grid grid-cols-2 gap-2">
          {CURSE_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => setForm({ kind: "curse", type })}
                className="flex min-h-20 w-full flex-col items-start justify-between rounded-card border border-line bg-surface p-3 text-left shadow-card transition active:scale-[0.97]"
              >
                <span className="font-semibold">{curseNames[type]}</span>
                <span className="font-display font-bold tabular-nums text-accent">{board.prices[type]} pts</span>
              </button>
            </li>
          ))}
        </ul>
        {board.curses.length > 0 && (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {board.curses.map((curse) => (
              <li key={curse.id} className="px-4 py-2.5">
                <p>
                  <span className="font-semibold">{curse.name}</span> on {curse.target}
                </p>
                <p className="text-sm text-muted">
                  From {curse.from}
                  {curse.expiresAt ? ` · until ${formatTime(curse.expiresAt)}` : " · until their next drink"}
                </p>
              </li>
            ))}
          </ul>
        )}
        {me?.curses.some((curse) => curse.type === "shield") && <p className="text-sm text-muted">Your Shield is up.</p>}
      </section>

      <section className="space-y-3">
        <h2 className={eyebrow}>Snitch Line</h2>
        {board.reports.length === 0 && <Card className="text-muted">Nobody has been reported.</Card>}
        {board.reports.map((report) => (
          <ReportCard key={report.id} report={report} myId={myId} />
        ))}
        <Button block onClick={() => setForm({ kind: "snitch" })}>
          Report someone
        </Button>
      </section>

      {form && (
        <GameForm
          // A fresh form each time, so nothing carries over from the last one.
          key={form.kind === "curse" ? form.type : form.kind}
          form={form}
          board={board}
          myId={myId}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
