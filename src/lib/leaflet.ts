import type * as Leaflet from "leaflet";
import { config } from "@/config";

export type L = typeof Leaflet;

/** Leaflet touches `window` on import, so it is only ever loaded in the browser, on demand. */
export async function loadLeaflet(): Promise<L> {
  const leaflet = await import("leaflet");
  return (leaflet as { default?: L }).default ?? leaflet;
}

/**
 * A map on OpenStreetMap's standard tiles. No API key; the usage policy asks
 * for visible attribution (kept on) and no bulk fetching (we only load what is viewed).
 * The dark look comes from a CSS filter on `.party-map` in globals.css.
 */
export function createMap(leaflet: L, element: HTMLElement, options: { zoom?: number } = {}): Leaflet.Map {
  const map = leaflet.map(element, {
    center: [config.mapCenter.lat, config.mapCenter.lng],
    zoom: options.zoom ?? 11,
    zoomControl: true,
    attributionControl: true,
  });
  leaflet
    .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
    .addTo(map);
  return map;
}

/** Escapes a value for use inside a double-quoted HTML attribute in marker markup. */
export const attr = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
