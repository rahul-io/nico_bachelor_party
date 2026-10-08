import { describe, expect, it } from "vitest";
import { dayKey, formatTime, partyTimeToIso, timeInputValue } from "./time";

describe("party timezone helpers", () => {
  it("converts Pacific wall time to UTC during daylight time", () => {
    expect(partyTimeToIso("2026-10-08", "19:30")).toBe("2026-10-09T02:30:00.000Z");
    expect(partyTimeToIso("2026-10-11", "00:15")).toBe("2026-10-11T07:15:00.000Z");
  });

  it("handles standard time too", () => {
    expect(partyTimeToIso("2026-12-01", "09:00")).toBe("2026-12-01T17:00:00.000Z");
  });

  it("round-trips through the display helpers", () => {
    const iso = partyTimeToIso("2026-10-09", "23:45");
    expect(dayKey(iso)).toBe("2026-10-09");
    expect(timeInputValue(iso)).toBe("23:45");
    expect(formatTime(iso)).toBe("11:45 PM");
  });
});
