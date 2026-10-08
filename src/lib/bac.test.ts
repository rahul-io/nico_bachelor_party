import { describe, expect, it } from "vitest";
import { alcoholGrams, estimateBac, formatBac, widmarkR, type Body } from "./bac";

const man: Body = { sex: "male", heightCm: 180, weightKg: 80 };
const t0 = Date.parse("2026-10-09T20:00:00-07:00");
const hours = (h: number) => t0 + h * 3_600_000;
const drink = (h: number, alcoholG = 14) => ({ alcoholG, consumedAt: hours(h) });

describe("alcoholGrams", () => {
  it("gives about 14 g for US standard drinks", () => {
    expect(alcoholGrams(12, 0.05)).toBeCloseTo(14, 0);
    expect(alcoholGrams(5, 0.12)).toBeCloseTo(14, 0);
    expect(alcoholGrams(1.5, 0.4)).toBeCloseTo(14, 0);
  });
});

describe("widmarkR", () => {
  it("uses the Seidl formula", () => {
    expect(widmarkR(man)).toBeCloseTo(0.31608 - 0.004821 * 80 + 0.004632 * 180, 6);
    expect(widmarkR({ sex: "female", heightCm: 165, weightKg: 60 })).toBeCloseTo(
      0.31223 - 0.006446 * 60 + 0.004466 * 165,
      6,
    );
  });

  it("falls back when Seidl is implausible", () => {
    expect(widmarkR({ sex: "male", heightCm: 150, weightKg: 200 })).toBe(0.68);
    expect(widmarkR({ sex: "female", heightCm: 150, weightKg: 200 })).toBe(0.55);
  });
});

describe("estimateBac", () => {
  const perDrink = (14 / (80_000 * widmarkR(man))) * 100;

  it("is zero with no drinks", () => {
    expect(estimateBac(man, [], t0)).toEqual({ bac: 0, sessionStart: null, sessionDrinks: 0 });
  });

  it("matches Widmark right after one drink", () => {
    expect(estimateBac(man, [drink(0)], t0).bac).toBeCloseTo(perDrink, 6);
  });

  it("eliminates 0.015 per hour from the first drink", () => {
    const result = estimateBac(man, [drink(0), drink(0.5), drink(1)], hours(2));
    expect(result.bac).toBeCloseTo(3 * perDrink - 0.015 * 2, 6);
    expect(result.sessionStart).toBe(t0);
    expect(result.sessionDrinks).toBe(3);
  });

  it("never goes below zero", () => {
    expect(estimateBac(man, [drink(0)], hours(12))).toEqual({
      bac: 0,
      sessionStart: null,
      sessionDrinks: 0,
    });
  });

  it("starts a new session after BAC has returned to zero", () => {
    const result = estimateBac(man, [drink(0), drink(24)], hours(24));
    expect(result.bac).toBeCloseTo(perDrink, 6);
    expect(result.sessionStart).toBe(hours(24));
    expect(result.sessionDrinks).toBe(1);
  });

  it("does not depend on input order and ignores future drinks", () => {
    const a = estimateBac(man, [drink(1), drink(0), drink(5)], hours(2));
    const b = estimateBac(man, [drink(0), drink(1)], hours(2));
    expect(a).toEqual(b);
  });
});

describe("formatBac", () => {
  it("shows three decimals", () => {
    expect(formatBac(0.0624)).toBe("0.062%");
    expect(formatBac(0)).toBe("0.000%");
  });
});
