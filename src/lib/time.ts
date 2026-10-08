import { config } from "@/config";

type DateInput = string | number | Date;

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: config.timezone,
  hour: "numeric",
  minute: "2-digit",
});

const weekdayTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: config.timezone,
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "2026-10-08" for the calendar day this instant falls on in the party timezone. */
export function dayKey(date: DateInput): string {
  return dayKeyFormat.format(new Date(date));
}

/** "7:30 PM" in the party timezone. */
export function formatTime(date: DateInput): string {
  return timeFormat.format(new Date(date));
}

const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: config.timezone, hour: "numeric" });

/** "7 PM" in the party timezone. */
export function formatHour(date: DateInput): string {
  return hourFormat.format(new Date(date));
}

/** "Fri 7:30 PM" in the party timezone. */
export function formatWeekdayTime(date: DateInput): string {
  return weekdayTimeFormat.format(new Date(date));
}

/** Weekday and day-of-month parts for a day key, e.g. { weekday: "Thu", day: "8" }. */
export function dayParts(key: string): { weekday: string; day: string; long: string } {
  const noonUtc = new Date(`${key}T12:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(noonUtc);
  return {
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    long: part({ weekday: "long", month: "long", day: "numeric" }),
  };
}

function offsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** ISO instant for a wall-clock day ("2026-10-08") and time ("19:30") in the party timezone. */
export function partyTimeToIso(day: string, time: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, date, hour, minute);
  // Second pass settles the offset if the first guess landed across a DST change.
  const guess = wallAsUtc - offsetMs(wallAsUtc);
  return new Date(wallAsUtc - offsetMs(guess)).toISOString();
}

/** "19:30" in the party timezone, for <input type="time">. */
export function timeInputValue(date: DateInput): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
