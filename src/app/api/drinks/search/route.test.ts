import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const payload = { products: [{ code: "12345678", product_name: "Test Lager",
  categories_tags: ["en:alcoholic-beverages"], nutriments: { alcohol_100g: 5 } }] };
const request = (q: string) => new Request(`http://localhost/api/drinks/search?q=${encodeURIComponent(q)}`);

describe("drink search endpoint", () => {
  it("rejects invalid queries without contacting the upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");
    expect((await GET(request("a"))).status).toBe(400);
    expect((await GET(request("x".repeat(81)))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters searches to alcohol and caches normalized repeat queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");
    expect((await GET(request(" Test   Lager "))).status).toBe(200);
    expect(await (await GET(request("test lager"))).json()).toMatchObject({ drinks: [{ abvPercent: 5 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get("search_terms")).toBe("Test Lager");
    expect(url.searchParams.get("tag_0")).toBe("alcoholic-beverages");
  });

  it("returns a recoverable failure instead of reporting no matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const { GET } = await import("./route");
    expect((await GET(request("lager"))).status).toBe(503);
  });

  it("caps uncached requests and still serves cached results after the cap", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json(payload)));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");
    for (let i = 0; i < 10; i++) expect((await GET(request(`beer ${i}`))).status).toBe(200);
    expect((await GET(request("another beer"))).status).toBe(429);
    expect((await GET(request("beer 0"))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
