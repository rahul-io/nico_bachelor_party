"use client";

import { useCallback, useState, type PointerEvent } from "react";
import useSWR from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { useIdentity } from "@/hooks/useProfile";
import { apiFetch } from "@/lib/api";
import { formatBac } from "@/lib/bac";
import { niceTicks, spreadApart, timeTicks } from "@/lib/chart";
import { cn } from "@/lib/cn";
import type { TrendMetric, TrendPlayer, Trends } from "@/lib/store/types";
import { formatWeekdayTime } from "@/lib/time";

const metrics = [
  { value: "points", label: "Points" },
  { value: "drinks", label: "Drinks" },
  { value: "bac", label: "BAC" },
] as const;

const MARGIN = { top: 14, right: 46, bottom: 26, left: 38 };
const AVATAR = 24;
const AVATAR_GAP = AVATAR + 3;
const MIN_HEIGHT = 280;
const REFRESH_MS = 60_000;

const formatValue = (metric: TrendMetric, value: number) =>
  metric === "bac" ? formatBac(value) : String(value);

export function TrendChart() {
  const identity = useIdentity();
  const { data, error } = useSWR<Trends>("/api/trends", (path: string) => apiFetch<Trends>(path), {
    refreshInterval: REFRESH_MS,
  });
  const [metric, setMetric] = useState<TrendMetric>("points");
  const [picked, setPicked] = useState<string | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [width, setWidth] = useState(343);

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const body = (() => {
    if (!data) {
      return <p className="text-muted">{error ? "Couldn't load the chart. Retrying…" : "Loading…"}</p>;
    }
    const { times, players } = data;
    if (times.length < 2 || players.length === 0) {
      return <p className="text-muted">Nothing to chart yet.</p>;
    }

    const last = times.length - 1;
    const index = scrub === null ? last : Math.min(scrub, last);
    const selectedId = picked ?? identity?.id ?? null;

    // Tall enough that every avatar gets its own slot in the right-hand gutter.
    const height = Math.max(MIN_HEIGHT, players.length * AVATAR_GAP + MARGIN.top + MARGIN.bottom);
    const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 50);
    const plotHeight = height - MARGIN.top - MARGIN.bottom;
    const plotRight = MARGIN.left + plotWidth;
    const plotBottom = MARGIN.top + plotHeight;

    const values = players.flatMap((player) => player[metric]);
    const yTicks = niceTicks(Math.min(0, ...values), Math.max(...values, metric === "bac" ? 0.02 : 1), 4, metric === "bac" ? 0 : 1);
    const yMin = yTicks[0];
    const yMax = yTicks[yTicks.length - 1];
    const x = (t: number) => MARGIN.left + ((t - times[0]) / (times[last] - times[0])) * plotWidth;
    const y = (value: number) => plotBottom - ((value - yMin) / (yMax - yMin)) * plotHeight;

    // Points and drinks change in jumps, so they are drawn as steps; BAC is continuous.
    const path = (player: TrendPlayer) =>
      player[metric]
        .map((value, i) => {
          const px = x(times[i]).toFixed(1);
          const py = y(value).toFixed(1);
          if (i === 0) return `M${px} ${py}`;
          return metric === "bac" ? `L${px} ${py}` : `H${px}V${py}`;
        })
        .join("");

    const avatarY = spreadApart(
      players.map((player) => y(player[metric][last])),
      AVATAR_GAP,
      plotBottom,
    );
    const avatarX = plotRight + 10;

    const ranked = [...players].sort(
      (a, b) => b[metric][index] - a[metric][index] || a.name.localeCompare(b.name),
    );
    // Selected line is drawn last so it sits on top.
    const drawOrder = [...players].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));

    function scrubTo(event: PointerEvent<SVGRectElement>) {
      const box = event.currentTarget.getBoundingClientRect();
      const t = times[0] + ((event.clientX - box.left) / box.width) * (times[last] - times[0]);
      let nearest = 0;
      for (let i = 1; i <= last; i++) {
        if (Math.abs(times[i] - t) < Math.abs(times[nearest] - t)) nearest = i;
      }
      setScrub(nearest === last ? null : nearest);
    }

    return (
      <>
        <div ref={measure} className="relative" style={{ height }}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${metrics.find((m) => m.value === metric)?.label} over time for each guest. The list below gives the same numbers.`}
            className="absolute inset-0 select-none"
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={plotRight}
                  y1={y(tick)}
                  y2={y(tick)}
                  className={tick === 0 ? "stroke-muted/60" : "stroke-line"}
                  strokeWidth={1}
                />
                <text x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {metric === "bac" ? tick.toFixed(2) : tick}
                </text>
              </g>
            ))}
            {timeTicks(times[0], times[last]).map((tick) => (
              <text key={tick.t} x={x(tick.t)} y={plotBottom + 17} textAnchor="middle" className="fill-muted text-[11px]">
                {tick.label}
              </text>
            ))}

            {drawOrder.map((player) => {
              const selected = player.id === selectedId;
              return (
                <path
                  key={player.id}
                  d={path(player)}
                  fill="none"
                  strokeWidth={selected ? 3 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className={selected ? "stroke-accent" : "stroke-muted/45"}
                />
              );
            })}

            {players.map((player, i) => (
              <line
                key={player.id}
                x1={plotRight}
                y1={y(player[metric][last])}
                x2={avatarX}
                y2={avatarY[i]}
                strokeWidth={1}
                className={player.id === selectedId ? "stroke-accent" : "stroke-muted/45"}
              />
            ))}

            {scrub !== null && (
              <g>
                <line x1={x(times[index])} x2={x(times[index])} y1={MARGIN.top} y2={plotBottom} className="stroke-ink/50" strokeWidth={1} />
                {drawOrder.map((player) => (
                  <circle
                    key={player.id}
                    cx={x(times[index])}
                    cy={y(player[metric][index])}
                    r={player.id === selectedId ? 5 : 4}
                    strokeWidth={2}
                    className={cn("stroke-surface", player.id === selectedId ? "fill-accent" : "fill-muted")}
                  />
                ))}
              </g>
            )}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              style={{ touchAction: "pan-y" }}
              onPointerDown={scrubTo}
              onPointerMove={scrubTo}
              onPointerLeave={(event) => event.pointerType === "mouse" && setScrub(null)}
            />
          </svg>

          {players.map((player, i) => (
            <button
              key={player.id}
              type="button"
              onClick={() => setPicked(player.id)}
              aria-label={`Highlight ${player.name}`}
              className="absolute rounded-full"
              style={{ left: avatarX, top: avatarY[i] - AVATAR / 2 }}
            >
              <Avatar
                name={player.name}
                src={player.avatarUrl}
                size="xs"
                className={player.id === selectedId ? "ring-2 ring-accent" : undefined}
              />
            </button>
          ))}
        </div>

        <div className="flex min-h-tap items-center justify-between gap-3">
          <p className="font-medium">{scrub === null ? "Right now" : formatWeekdayTime(times[index])}</p>
          {scrub === null ? (
            <p className="text-right text-xs text-muted">Drag across the chart to look back</p>
          ) : (
            <button type="button" onClick={() => setScrub(null)} className="min-h-tap px-2 text-sm text-link">
              Back to now
            </button>
          )}
        </div>

        <ol className="divide-y divide-line border-t border-line">
          {ranked.map((player, rank) => {
            const selected = player.id === selectedId;
            return (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => setPicked(player.id)}
                  aria-pressed={selected}
                  className="flex min-h-tap w-full items-center gap-2.5 text-left"
                >
                  <span className={cn("h-6 w-1 shrink-0 rounded-full", selected ? "bg-accent" : "bg-transparent")} aria-hidden />
                  <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted">{rank + 1}</span>
                  <Avatar name={player.name} src={player.avatarUrl} size="xs" />
                  <span className={cn("min-w-0 flex-1 truncate", selected && "font-semibold")}>{player.name}</span>
                  <span className="shrink-0 font-display font-bold tabular-nums">
                    {formatValue(metric, player[metric][index])}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </>
    );
  })();

  return (
    <Card className="space-y-3 p-3">
      <Segmented options={metrics} value={metric} onChange={setMetric} label="Chart" size="sm" />
      {body}
    </Card>
  );
}
