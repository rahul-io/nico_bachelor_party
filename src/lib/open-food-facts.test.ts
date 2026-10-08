import { describe, expect, it } from "vitest";
import { normalizeFoodFactsDrinks } from "./open-food-facts";

const beer = {
  code: "1234567890123", product_name: "Lager", brands: "Example Brewery",
  categories_tags: ["en:beverages", "en:alcoholic-beverages", "en:beers"],
  nutriments: { alcohol_100g: "4.6" }, quantity: "6 x 330 ml",
};

describe("Open Food Facts drink results", () => {
  it("uses volume percent as ABV and keeps multipack quantity separate from serving size", () => {
    expect(normalizeFoodFactsDrinks({ products: [beer] })).toEqual([{
      code: beer.code, name: "Example Brewery Lager", abvPercent: 4.6, packageQuantity: "6 x 330 ml",
    }]);
  });

  it("leaves missing, blank and invalid ABV unknown rather than guessing", () => {
    for (const alcohol of [undefined, null, "", " ", "unknown", -1, 101]) {
      const [drink] = normalizeFoodFactsDrinks({ products: [{ ...beer, nutriments: { alcohol_100g: alcohol } }] });
      expect(drink.abvPercent).toBeNull();
    }
  });

  it("ignores malformed entries, foods, zero alcohol and duplicate barcodes", () => {
    expect(normalizeFoodFactsDrinks({ products: [null, {}, beer, beer,
      { ...beer, code: "99999999", categories_tags: ["en:snacks"] },
      { ...beer, code: "88888888", nutriments: { alcohol_100g: 0 } },
      { ...beer, code: "not-a-barcode" },
    ] })).toHaveLength(1);
  });

  it("prefers the English title, avoids repeating the brand and respects log name limits", () => {
    const [drink] = normalizeFoodFactsDrinks({ products: [{ ...beer,
      product_name_en: `Example Brewery ${"a".repeat(80)}`,
    }] });
    expect(drink.name).toHaveLength(60);
    expect(drink.name.startsWith("Example Brewery Example Brewery")).toBe(false);
  });

  it("distinguishes empty results from a malformed upstream response", () => {
    expect(normalizeFoodFactsDrinks({ products: [] })).toEqual([]);
    expect(() => normalizeFoodFactsDrinks({ error: "unavailable" })).toThrow();
  });
});
