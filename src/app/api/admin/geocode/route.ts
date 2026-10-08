import { config } from "@/config";
import { isAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";

/**
 * Looks a place name up with OpenStreetMap's Nominatim, for giving a schedule
 * event a map position. Its usage policy allows at most one request a second
 * and wants the app to identify itself; only admins can reach this, one click at a time.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const query = new URL(req.url).searchParams.get("q")?.trim();
  if (!query || query.length > 200) return jsonError("Enter a place to look up", 400);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, {
      headers: { "user-agent": `${config.shortName} party app (schedule admin)`, "accept-language": "en" },
    });
    if (!response.ok) return jsonError("The map lookup service is unavailable. Place the pin by hand.", 502);
    const [match] = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!match) return jsonError("Couldn't find that place. Try a fuller address, or place the pin by hand.", 404);
    return Response.json({ lat: Number(match.lat), lng: Number(match.lon), label: match.display_name });
  } catch {
    return jsonError("The map lookup service is unavailable. Place the pin by hand.", 502);
  }
}
