import { describe, expect, it } from "vitest";
import { parseCoordinates, resolveLocation } from "./location";

const exif = { lat: 32.71, lng: -117.16 };
const device = { lat: 32.8, lng: -117.25 };
const event = { lat: 32.9, lng: -117.24 };

describe("resolveLocation", () => {
  it("prefers the photo's GPS tag, then a tagged event, then the device", () => {
    expect(resolveLocation({ mediaType: "image", exif, event, device })).toEqual({ ...exif, source: "exif" });
    expect(resolveLocation({ mediaType: "image", exif: null, event, device })).toEqual({ ...event, source: "event" });
    expect(resolveLocation({ mediaType: "image", exif: null, event: null, device })).toEqual({ ...device, source: "device" });
    expect(resolveLocation({ mediaType: "image", exif: null, event: null, device: null })).toBeNull();
  });

  it("never uses EXIF for videos", () => {
    expect(resolveLocation({ mediaType: "video", exif, event: null, device })).toEqual({ ...device, source: "device" });
  });

  it("falls through a tagged event that has no coordinates", () => {
    const bare = { lat: null, lng: null };
    expect(resolveLocation({ mediaType: "image", exif: null, event: bare, device })).toEqual({ ...device, source: "device" });
    expect(resolveLocation({ mediaType: "image", exif: null, event: bare, device: null })).toBeNull();
  });
});

describe("parseCoordinates", () => {
  it("accepts valid pairs only", () => {
    expect(parseCoordinates({ lat: 32.7, lng: -117.1, extra: 1 })).toEqual({ lat: 32.7, lng: -117.1 });
    expect(parseCoordinates({ lat: 0, lng: 0 })).toEqual({ lat: 0, lng: 0 });
    for (const bad of [null, "32,-117", { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: "32", lng: -117 }, { lat: NaN, lng: 0 }, { lat: 1 }]) {
      expect(parseCoordinates(bad)).toBeNull();
    }
  });
});
