"use client";

import FullCalendar, { type CalendarRef } from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import { useRef, useState } from "react";
import { DayPicker } from "@/components/schedule/DayPicker";
import { Segmented } from "@/components/ui/Segmented";
import { config } from "@/config";
import { useNow } from "@/hooks/useNow";
import type { ScheduleEvent } from "@/lib/store/types";
import { dayKey, partyTimeToIso } from "@/lib/time";

const HOUR_MS = 60 * 60 * 1000;

const modes = [
  { value: "day", label: "Day" },
  { value: "weekend", label: "Weekend" },
] as const;

type Mode = (typeof modes)[number]["value"];

export interface TimeRange {
  startsAt: string;
  endsAt: string | null;
}

interface ScheduleCalendarProps {
  events: ScheduleEvent[];
  /** An empty slot was tapped or dragged over. */
  onCreate: (range: TimeRange) => void;
  onEdit: (event: ScheduleEvent) => void;
  /** An event was dragged or resized. Resolve false to snap it back. */
  onMove: (event: ScheduleEvent, range: TimeRange) => Promise<boolean>;
}

/**
 * The calendar hands back times as strings. With an offset they are instants;
 * without one they are party-local wall-clock times.
 */
function toIso(value: string): string {
  return /(Z|[+-]\d{2}:\d{2})$/.test(value)
    ? new Date(value).toISOString()
    : partyTimeToIso(value.slice(0, 10), value.slice(11, 16));
}

const dayAfter = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 24 * HOUR_MS).toISOString().slice(0, 10);

/** Time-grid view of the party weekend. Everything is shown in party time, whatever the device's timezone. */
export function ScheduleCalendar({ events, onCreate, onEdit, onMove }: ScheduleCalendarProps) {
  const calendar = useRef<CalendarRef>(null);
  const now = useNow();
  // Wide screens start on the whole weekend, phones on a single day.
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches ? "weekend" : "day",
  );
  const [day, setDay] = useState(() => {
    const today = dayKey(Date.now());
    return config.days.includes(today) ? today : config.days[0];
  });
  // While something is being dragged, hold the event list still so a poll can't yank it away.
  const [frozen, setFrozen] = useState<ScheduleEvent[] | null>(null);
  const shown = frozen ?? events;

  const firstDay = config.days[0];
  const lastDay = config.days[config.days.length - 1];

  function changeMode(next: Mode) {
    setMode(next);
    const api = calendar.current?.getApi();
    api?.changeView(next);
    api?.gotoDate(next === "weekend" ? firstDay : day);
  }

  function changeDay(next: string) {
    setDay(next);
    calendar.current?.getApi().gotoDate(next);
  }

  async function moved(info: { event: { id: string; startStr: string; endStr: string }; revert: () => void }) {
    setFrozen(null);
    const original = events.find((event) => event.id === info.event.id);
    if (!original) return info.revert();
    const ok = await onMove(original, {
      startsAt: toIso(info.event.startStr),
      // An event with no end time stays open-ended when it is only moved.
      endsAt: info.event.endStr ? toIso(info.event.endStr) : null,
    });
    if (!ok) info.revert();
  }

  return (
    <div className="space-y-3">
      <Segmented options={modes} value={mode} onChange={changeMode} label="Calendar range" size="sm" />
      {mode === "day" && <DayPicker days={config.days} selected={day} today={now === null ? "" : dayKey(now)} onSelect={changeDay} />}

      <div className="party-calendar overflow-hidden rounded-card border border-line bg-surface">
        <FullCalendar
          ref={calendar}
          plugins={[timeGridPlugin, interactionPlugin, classicThemePlugin]}
          colorScheme="dark"
          timeZone={config.timezone}
          views={{
            day: { type: "timeGrid", duration: { days: 1 } },
            weekend: { type: "timeGrid", duration: { days: config.days.length } },
          }}
          initialView={mode}
          initialDate={mode === "weekend" ? firstDay : day}
          validRange={{ start: firstDay, end: dayAfter(lastDay) }}
          headerToolbar={false}
          height="68vh"
          allDaySlot={false}
          nowIndicator
          scrollTime="09:00:00"
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          defaultTimedEventDuration="01:00:00"
          dayHeaderFormat={{ weekday: "short", day: "numeric" }}
          events={shown.map((event) => ({
            id: event.id,
            title: event.title,
            start: event.startsAt,
            end: event.endsAt ?? undefined,
          }))}
          editable
          selectable
          selectMirror
          // Touch: hold briefly, then drag. Keeps scrolling the grid from moving events by accident.
          longPressDelay={350}
          select={(info) => {
            const startsAt = toIso(info.startStr);
            let endsAt = toIso(info.endStr);
            // A single tap selects one half-hour slot; start those as a one-hour event.
            if (Date.parse(endsAt) - Date.parse(startsAt) <= HOUR_MS / 2) {
              endsAt = new Date(Date.parse(startsAt) + HOUR_MS).toISOString();
            }
            calendar.current?.getApi().unselect();
            onCreate({ startsAt, endsAt });
          }}
          eventClick={(info) => {
            const event = events.find((candidate) => candidate.id === info.event.id);
            if (event) onEdit(event);
          }}
          eventDragStart={() => setFrozen(events)}
          eventResizeStart={() => setFrozen(events)}
          eventDrop={moved}
          eventResize={moved}
        />
      </div>
      <p className="text-xs text-muted">
        Times are {config.location} time. Tap or drag an empty slot to add, tap an event to edit, drag to move, drag
        the bottom edge to change the end. On a phone, hold an event for a moment before dragging.
      </p>
    </div>
  );
}
