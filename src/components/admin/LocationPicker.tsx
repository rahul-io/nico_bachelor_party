"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { apiFetch } from "@/lib/api";
import { createMap, loadLeaflet, type L } from "@/lib/leaflet";
import type { Coordinates } from "@/lib/location";

interface LocationPickerProps {
  value: Coordinates | null;
  onChange: (value: Coordinates | null) => void;
  /** What "Find on map" searches for: the event's Maps search or location name. */
  query: string;
}

/** Gives an event a map position: look the place up by name, then tap the map or drag the pin to correct it. */
export function LocationPicker({ value, onChange, query }: LocationPickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const state = useRef<{ leaflet: L; map: Leaflet.Map; marker: Leaflet.Marker | null } | null>(null);
  const latest = useRef({ value, onChange });
  const sync = useRef<() => void>(() => {});
  const { busy, status, setStatus, run } = useAction();

  useEffect(() => {
    latest.current = { value, onChange };
    sync.current();
  }, [value, onChange]);

  useEffect(() => {
    let cancelled = false;

    void loadLeaflet().then((leaflet) => {
      if (cancelled || !container.current) return;
      const map = createMap(leaflet, container.current, { zoom: 10 });
      const current = { leaflet, map, marker: null as Leaflet.Marker | null };
      state.current = current;

      // Mirrors the form's value onto the map; the form stays the source of truth.
      sync.current = () => {
        const position = latest.current.value;
        if (!position) {
          current.marker?.remove();
          current.marker = null;
          return;
        }
        if (!current.marker) {
          current.marker = leaflet
            .marker([position.lat, position.lng], {
              draggable: true,
              icon: leaflet.divIcon({ className: "", html: '<span class="pin-marker">📍</span>', iconSize: [48, 48] }),
            })
            .on("dragend", (event) => {
              const { lat, lng } = (event.target as Leaflet.Marker).getLatLng();
              latest.current.onChange({ lat, lng });
            })
            .addTo(map);
          map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15));
        } else {
          current.marker.setLatLng([position.lat, position.lng]);
          if (!map.getBounds().contains([position.lat, position.lng])) map.panTo([position.lat, position.lng]);
        }
      };

      map.on("click", (event) => latest.current.onChange({ lat: event.latlng.lat, lng: event.latlng.lng }));
      sync.current();
    });

    return () => {
      cancelled = true;
      sync.current = () => {};
      state.current?.map.remove();
      state.current = null;
    };
  }, []);

  async function find() {
    if (!query.trim()) return setStatus({ text: "Fill in a location or Maps search first.", error: true });
    await run(async () => {
      const found = await apiFetch<Coordinates & { label: string }>(
        `/api/admin/geocode?q=${encodeURIComponent(query.trim())}`,
      );
      onChange({ lat: found.lat, lng: found.lng });
      state.current?.map.setView([found.lat, found.lng], 16);
      setStatus({ text: `Found: ${found.label}` });
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted">Spot on the photo map (optional)</span>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="min-h-tap px-2 text-sm text-muted underline underline-offset-4">
            Remove
          </button>
        )}
      </div>
      <Button onClick={find} disabled={busy} block>
        <MapPin className="size-5" aria-hidden />
        {busy ? "Looking…" : "Find on map"}
      </Button>
      <div
        ref={container}
        role="application"
        aria-label="Event location. Tap to place the pin, drag it to adjust."
        className="party-map isolate z-0 h-56 overflow-hidden rounded-control border border-line"
      />
      <p className="text-xs text-muted">
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drag it or tap the map to move it.`
          : "No pin. Tap the map to place one. Photos tagged with this event use it."}
      </p>
      {status && <Status status={status} />}
    </div>
  );
}
