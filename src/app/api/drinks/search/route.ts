import { normalizeFoodFactsDrinks, type FoodFactsDrink } from "@/lib/open-food-facts";

const cache = new Map<string, { drinks: FoodFactsDrink[]; expires: number }>();
const pending = new Map<string, Promise<FoodFactsDrink[]>>();
let requests: number[] = [];

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length < 2 || query.length > 80) {
    return Response.json({ error: "Enter 2–80 characters to search." }, { status: 400 });
  }
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Response.json({ drinks: cached.drinks });

  let search = pending.get(key);
  if (!search) {
    requests = requests.filter((time) => time > Date.now() - 60_000);
    if (requests.length >= 10) {
      return Response.json({ error: "Drink search is busy. Try again in a minute; local drinks still work." },
        { status: 429, headers: { "Retry-After": "60" } });
    }
    requests.push(Date.now());
    search = searchFoodFacts(query);
    pending.set(key, search);
  }
  try {
    const drinks = await search;
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { drinks, expires: Date.now() + 3_600_000 });
    return Response.json({ drinks });
  } catch {
    return Response.json({ error: "Open Food Facts is unavailable. Try again or use a local or custom drink." },
      { status: 503 });
  } finally {
    pending.delete(key);
  }
}

async function searchFoodFacts(query: string): Promise<FoodFactsDrink[]> {
  // Plain-text search is still served by this endpoint; v3 has no search API.
  const origin = process.env.NODE_ENV === "production"
    ? "https://world.openfoodfacts.org" : "https://world.openfoodfacts.net";
  const url = new URL("/cgi/search.pl", origin);
  url.search = new URLSearchParams({
    search_terms: query, search_simple: "1", action: "process", json: "1",
    tagtype_0: "categories", tag_contains_0: "contains", tag_0: "alcoholic-beverages",
    page_size: "40", fields: "code,product_name,product_name_en,brands,quantity,categories_tags,nutriments",
  }).toString();
  const response = await fetch(url, {
    headers: {
      "User-Agent": "NicoBachelorParty/0.1 (https://github.com/rahul-io/nico_bachelor_party)",
      ...(process.env.NODE_ENV !== "production" ? { Authorization: "Basic b2ZmOm9mZg==" } : {}),
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Open Food Facts search failed");
  return normalizeFoodFactsDrinks(await response.json());
}
