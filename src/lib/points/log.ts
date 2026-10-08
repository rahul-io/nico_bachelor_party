import type { DrinkLog, LoggedDrink, LoggedWater, PointEvent, WaterLog } from "@/lib/store/types";
import { describeBreakdown, formatDelta, roundPoints } from "./format";

/** Attaches what each entry in a person's log earned, from their ledger entries. */
function earned(events: PointEvent[], id: string) {
  const own = events.filter((event) => event.drinkId === id && event.voidedAt === null);
  return own.length > 0 ? own : null;
}

export function withDrinkPoints(drinks: DrinkLog[], events: PointEvent[]): LoggedDrink[] {
  return drinks.map((drink) => {
    const own = earned(events, drink.id);
    if (!own) return { ...drink, points: null, pointsLine: null };
    const base = own.find((event) => event.source === "drink");
    const extras = own.filter((event) => event !== base);
    const parts = [
      ...(base?.breakdown ? [describeBreakdown(base.breakdown, base.delta)] : []),
      ...extras.map((event) => `${event.reason ?? "Bonus"} ${formatDelta(event.delta)}`),
    ];
    return {
      ...drink,
      points: roundPoints(own.reduce((sum, event) => sum + event.delta, 0)),
      pointsLine: parts.join(" · ") || null,
    };
  });
}

export function withWaterPoints(waters: WaterLog[], events: PointEvent[]): LoggedWater[] {
  return waters.map((water) => {
    const own = earned(events, water.id);
    return { ...water, points: own ? roundPoints(own.reduce((sum, event) => sum + event.delta, 0)) : null };
  });
}
