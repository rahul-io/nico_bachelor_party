"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import Supercluster from "supercluster";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { attr, createMap, loadLeaflet, type L } from "@/lib/leaflet";
import type { FeedPost } from "@/lib/store/types";

interface PhotoMapProps {
  posts: FeedPost[];
  onOpen: (postId: string) => void;
}

const CLUSTER_RADIUS_PX = 56;
const MAX_ZOOM = 19;
/** Past this zoom, points that still share a cluster are effectively in the same spot. */
const CLUSTER_MAX_ZOOM = MAX_ZOOM - 1;

/** Photos with a known location, as clustered thumbnail markers. Tap one to open it. */
export function PhotoMap({ posts, onOpen }: PhotoMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const state = useRef<{ leaflet: L; map: Leaflet.Map; layer: Leaflet.LayerGroup } | null>(null);
  const fitted = useRef(false);
  // The map outlives renders, so its handlers read the latest props through refs.
  const latest = useRef({ posts, onOpen });
  const redraw = useRef<() => void>(() => {});
  // Photos that sit on the same spot (say, all tagged with one event) can't be zoomed apart; list them instead.
  const [stack, setStack] = useState<string[] | null>(null);

  useEffect(() => {
    latest.current = { posts, onOpen };
    redraw.current();
  }, [posts, onOpen]);

  useEffect(() => {
    let cancelled = false;

    void loadLeaflet().then((leaflet) => {
      if (cancelled || !container.current) return;
      const map = createMap(leaflet, container.current);
      const layer = leaflet.layerGroup().addTo(map);
      state.current = { leaflet, map, layer };

      redraw.current = () => {
        const located = latest.current.posts.filter((post) => post.lat !== null && post.lng !== null);
        const index = new Supercluster<{ postId: string; url: string; video: boolean }>({
          radius: CLUSTER_RADIUS_PX,
          maxZoom: CLUSTER_MAX_ZOOM,
        }).load(
          located.map((post) => ({
            type: "Feature" as const,
            properties: { postId: post.id, url: post.previewUrl ?? post.url, video: post.mediaType === "video" },
            geometry: { type: "Point" as const, coordinates: [post.lng as number, post.lat as number] },
          })),
        );

        // Frame all the photos once, the first time there are any.
        if (!fitted.current && located.length > 0) {
          fitted.current = true;
          // Make sure Leaflet has the container's real size before it works out a zoom level.
          map.invalidateSize(false);
          map.fitBounds(
            leaflet.latLngBounds(located.map((post) => [post.lat as number, post.lng as number])).pad(0.25),
            { maxZoom: 16, animate: false },
          );
        }

        const bounds = map.getBounds();
        const clusters = index.getClusters(
          [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          Math.round(map.getZoom()),
        );

        layer.clearLayers();
        for (const feature of clusters) {
          const [lng, lat] = feature.geometry.coordinates;
          const properties = feature.properties;
          if ("cluster" in properties && properties.cluster) {
            const clusterId = properties.cluster_id;
            leaflet
              .marker([lat, lng], {
                icon: leaflet.divIcon({
                  className: "",
                  html: `<span class="photo-cluster">${properties.point_count}</span>`,
                  iconSize: [48, 48],
                }),
                title: `${properties.point_count} photos`,
              })
              .on("click", () => {
                const splitsAt = index.getClusterExpansionZoom(clusterId);
                if (splitsAt > CLUSTER_MAX_ZOOM || splitsAt <= map.getZoom()) {
                  setStack(index.getLeaves(clusterId, Infinity).map((leaf) => leaf.properties.postId));
                } else {
                  map.setView([lat, lng], splitsAt);
                }
              })
              .addTo(layer);
          } else {
            const { postId, url, video } = properties as { postId: string; url: string; video: boolean };
            leaflet
              .marker([lat, lng], {
                icon: leaflet.divIcon({
                  className: "",
                  html: video
                    ? `<span class="photo-marker photo-marker-video">▶</span>`
                    : `<img class="photo-marker" src="${attr(url)}" alt="" />`,
                  iconSize: [48, 48],
                }),
                title: "Open photo",
              })
              .on("click", () => latest.current.onOpen(postId))
              .addTo(layer);
          }
        }
      };

      map.on("moveend", () => redraw.current());
      redraw.current();
    });

    return () => {
      cancelled = true;
      redraw.current = () => {};
      state.current?.map.remove();
      state.current = null;
      fitted.current = false;
    };
  }, []);

  const count = posts.filter((post) => post.lat !== null && post.lng !== null).length;

  return (
    <div className="space-y-3">
      {count === 0 && (
        <Card className="text-muted">
          No photos on the map yet. A photo shows up here when it has a location: from the photo itself, a tagged
          event, or the poster&apos;s phone.
        </Card>
      )}
      <div
        ref={container}
        role="application"
        aria-label={`Map of ${count} ${count === 1 ? "photo" : "photos"}`}
        className="party-map isolate z-0 h-[62vh] overflow-hidden rounded-card border border-line bg-surface"
      />
      {stack && (
        <Sheet title={`${stack.length} photos here`} onClose={() => setStack(null)}>
          <ul className="grid grid-cols-3 gap-1 p-1">
            {posts
              .filter((post) => stack.includes(post.id))
              .map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setStack(null);
                      onOpen(post.id);
                    }}
                    aria-label={`Open ${post.mediaType === "video" ? "video" : "photo"} by ${post.posterName}`}
                    className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-control bg-raised text-2xl text-accent"
                  >
                    {post.mediaType === "video" ? (
                      "▶"
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- served straight from Blob
                      <img src={post.previewUrl ?? post.url} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
