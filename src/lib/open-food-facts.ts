/** Search results stay separate from the curated catalog: ABV may be unknown. */
export interface FoodFactsDrink {
  code: string;
  name: string;
  abvPercent: number | null;
  packageQuantity: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function text(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return /^(null|undefined)$/i.test(trimmed) ? "" : trimmed;
}

export function normalizeFoodFactsDrinks(payload: unknown): FoodFactsDrink[] {
  const products = record(payload)?.products;
  if (!Array.isArray(products)) throw new Error("Invalid Open Food Facts response");
  const seen = new Set<string>();
  return products.flatMap((value): FoodFactsDrink[] => {
    const product = record(value);
    if (!product) return [];
    const code = text(product.code);
    const title = text(product.product_name_en) || text(product.product_name);
    if (!/^\d{4,24}$/.test(code) || !title || seen.has(code)) return [];
    const tags = Array.isArray(product.categories_tags) ? product.categories_tags : [];
    if (tags.some((tag) => typeof tag === "string" &&
      /^en:(non-alcoholic|alcohol-free|dealcoholized)-/.test(tag))) return [];
    if (!tags.some((tag) => typeof tag === "string" &&
      /^en:(alcoholic-beverages|beers|wines|spirits|ciders|hard-seltzers)$/.test(tag))) return [];
    const rawAbv = record(product.nutriments)?.alcohol_100g;
    const parsedAbv = typeof rawAbv === "number" ? rawAbv
      : typeof rawAbv === "string" && rawAbv.trim() ? Number(rawAbv) : NaN;
    // Zero-alcohol drinks cannot be logged by the alcohol tracker.
    if (parsedAbv === 0) return [];
    const abvPercent = Number.isFinite(parsedAbv) && parsedAbv >= 0.1 && parsedAbv <= 100
      ? Math.round(parsedAbv * 100) / 100 : null;
    const brand = text(product.brands).split(",")[0].trim();
    const name = brand && !title.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${title}` : title;
    seen.add(code);
    return [{ code, name: name.slice(0, 60), abvPercent,
      packageQuantity: text(product.quantity).slice(0, 80) || null }];
  }).slice(0, 20);
}
