# Plan

Status: **M1–M4 done and live-tested from local dev. M5 (polish, home-screen install) not started. M6–M8 below are planned and waiting for Peter's go-ahead; nothing in them is built.**

Party: Thu Oct 8 – Sun Oct 11, 2026, San Diego (America/Los_Angeles).

## Key decisions

**Data access: `@neondatabase/serverless`, raw SQL, no ORM.**
Six small tables and a couple of dozen queries. The Neon driver is one dependency, works over HTTP (no connection pooling to think about on serverless), and gives injection-safe tagged templates. An ORM (Drizzle/Prisma) would add a schema DSL, a migration tool and a build step for no benefit at this size. Schema is one idempotent `db/schema.sql` applied with `npm run db:setup`.

**Mock fallback via a single `Store` interface.**
The UI always calls `/api/*`; route handlers always call `getStore()`. `getStore()` returns the Postgres store when `DATABASE_URL` is set, otherwise an in-memory store seeded with fake data (kept on `globalThis` so it survives hot reload). Consequence: M1/M2 are built against the real API shape, and M3 is "write the second implementation", not a rewrite. If the deployed app is ever running on mock data it shows a "demo mode" banner, since in-memory data does not persist on Vercel.

**Polling.** SWR with a 10 s `refreshInterval` on leaderboard, feed, schedule, challenges; revalidate on focus; optimistic updates on your own writes so logging a drink feels instant.

**Identity.** Creating a profile returns a public `id` plus a private `token`, both stored in localStorage. Writes send the token. This is not security, just enough that people can't trivially delete each other's photos or log drinks as someone else by copying an id out of the leaderboard response.

**BAC.** One pure function in `src/lib/bac.ts` (Widmark + Seidl, formulas in CLAUDE.md), unit-tested. The tracker runs it client-side every minute; the leaderboard runs it server-side so nobody's height/weight leaves the server.

**Where challenges live.** On the Leaderboard tab, as a `Standings | Challenges | History` segmented control. Challenges are how you get points, so they belong next to the points; a sixth tab would crowd the nav. In Admin, awarding points can start from a challenge to prefill the amount and reason.

**Uploads.** Browser → Vercel Blob directly using `upload()` and a `handleUpload` route that issues a short-lived token after checking profile, content type and size. Post metadata is saved by the client after the upload resolves (the `onUploadCompleted` webhook can't reach localhost). Proposed caps: images 10 MB (downscaled client-side to ~2000 px first), videos 100 MB, avatars resized to 256 px. Without a Blob token, uploads are kept as in-memory data/object URLs so the flow is still clickable.

**Admin auth.** `POST /api/admin/login` compares against `ADMIN_PASSWORD` (timing-safe), sets an httpOnly, SameSite=Lax, Secure cookie containing an HMAC-signed expiry (`SESSION_SECRET`). Local dev with no password set accepts `admin` and says so on screen; production with no password set refuses all logins.

## Data model

| Table | Columns |
|---|---|
| `profiles` | id, token, name, avatar_url, avatar_data, height_cm, weight_kg, sex, show_bac_on_posts (default true), created_at |
| `drink_logs` | id, profile_id, name, volume_oz, abv, alcohol_g, consumed_at |
| `events` | id, starts_at, ends_at?, title, location?, maps_query?, notes? |
| `challenges` | id, title, description, points, active, created_at |
| `point_events` | id, profile_id, delta, reason?, challenge_id?, created_at |
| `posts` | id, profile_id, blob_url, media_type, caption?, bac_at_post?, created_at |

`posts.bac_at_post` is a snapshot: computed server-side once when the post is created, and only if the poster has `show_bac_on_posts` on at that moment; otherwise null. It is never recomputed, and toggling the setting later does not change existing posts.

Points totals and drink counts are derived by query. The ~100-drink catalogue is a static JSON file, not a table.

## Milestones

### M1 — App shell, Schedule, Sobriety Tracker (mock data)
- [x] Theme tokens in `globals.css`; UI primitives (Button, Card, Sheet, Input, Avatar)
- [x] `(tabs)` layout with bottom nav, safe-area padding, header with profile avatar
- [x] `Store` interface + in-memory store + seed data; `env.ts`, `config.ts`
- [x] Minimal profile create/edit (name, height, weight, sex, "show BAC on my posts" toggle) — pulled forward from M2 because the tracker can't work without it; photo comes in M2
- [x] Schedule: day picker, event cards, Google Maps links, current/next highlight
- [x] `drinks.json` (144 drinks) + fuzzy search
- [x] Tracker: search, quick-select buttons, category / standard drink / custom fallback, drink log with delete, BAC recalculated every minute, "rough estimate for fun" labelling
- [x] `bac.ts` with unit tests (adds `vitest` as a dev dependency)

M1 notes: the seeded schedule is placeholder content until Admin exists (M2). `getStore()` always returns the mock store until M3. Leaderboard and Photos are "coming soon" stubs.

### M2 — Profiles, Leaderboard, Admin (mock data)
- [x] Profile photo (client-side resize) and full edit screen
- [x] Leaderboard: avatar, name, points, drinks, BAC; sort toggle
- [x] Challenges list and points history on the Leaderboard tab
- [x] Admin at `/admin` (not in the bottom nav): login/logout with cookie session
- [x] Admin: schedule CRUD, challenge CRUD, award/deduct points with reason
- [x] Admin: delete stale profiles (and their drinks, points, posts)

M2 notes: profile photos are stored as ~192 px JPEG data URLs on the profile row until M4 moves them to Blob. Mock mode seeds four "(demo)" guests and four placeholder challenges. Challenges can be hidden from guests without deleting them. Point mistakes are fixed with a counter-entry; there is no undo.

### M3 — Postgres + polling
- [x] `db/schema.sql`, `npm run db:setup`
- [x] Postgres `Store` implementation, selected when `DATABASE_URL` is set
- [x] Contract test suite run against both the mock store and a real in-process Postgres (PGlite)
- [x] SWR polling everywhere; optimistic updates on the drink log; demo-mode banner
- [x] Avatars served from `/api/avatars/[id]` with immutable caching, so polled lists never carry image data
- [x] Leaderboard "Trends" chart: points, drinks and estimated BAC over time, each line ending in that person's avatar
- [x] Ran `npm run db:setup` and smoke-tested against the real Neon database

M3 notes: no seed script; a real database starts with an empty schedule and no challenges, which Admin fills in. Trends are computed server-side from the drink log and points ledger on each request (sampled to at most 150 points) and refreshed every 60 s; nothing extra is stored. Lines are neutral with one highlighted person (you by default, tap an avatar or name to switch) because 10–15 distinct line colours are not tellable apart; identity comes from the avatars and the ranked list under the chart, which also follows the scrub position.

Once Rahul sends the env vars: put them in `.env.local` (or `vercel env pull .env.local`), run `npm run db:setup`, then `npm run dev` and check the demo banner is gone.

### M4 — Photo Feed + Vercel Blob
- [x] `handleUpload` route with identity, type and size checks; uploads go browser → Blob directly
- [x] Composer (photo/video + caption, progress bar), feed newest-first with uploader and time
- [x] Photos are shrunk to 2000 px JPEG in the browser before upload; videos upload as-is (multipart above 8 MB)
- [x] Delete own post; admin delete any (also removes the blob); deleting a profile removes its posts' blobs
- [x] "Open shared Google Photos album" button (shown when `NEXT_PUBLIC_GOOGLE_PHOTOS_ALBUM_URL` is set)
- [x] BAC snapshot on posts: `bac_at_post` stored at creation when the poster's "show BAC on my posts" setting is on; feed renders "Rahul (0.06%) posted a photo"; never recomputed
- [x] Bulk export, Admin: "Download all photos" streams one zip of every photo and video straight from Blob, with `photos.csv` inside
- [x] Bulk export, CLI: `npm run export-photos [-- <folder>]` downloads everything into a local folder plus the same CSV; re-runs skip files already there
- [x] Export naming: `YYYY-MM-DD_HH-mm-ss_poster[_bac-0.062].ext` in party time; CSV columns: file, poster, caption, timestamp, timestamp_utc, bac, type, url
- [x] Dropped: "move avatars to Blob". Avatars are ~10 KB, already served from an immutable cached URL, and moving them would add an upload round trip for no gain.

M4 notes: post metadata is saved by the client after the upload resolves, and the server then re-checks the file with `head()` (must be in this store, under the poster's own `posts/<profileId>/` path, an allowed type and under the cap) before creating the post. In mock mode (no Blob token) only small inline photos can be posted. The zip route streams and sets `maxDuration = 300`; the CLI script is the fallback for very large sets. Zip writing uses `client-zip` (added without asking first, since the plan had flagged it). Deleted blobs can stay visible from the CDN cache for a short while.

Local dev with `.env.local` set talks to the **live** database and Blob store. Clean up test data, or blank the two variables to work on mock data.

### M5 — Polish, install, deploy
- [ ] Visual pass (type, colour, motion, empty/loading/error states)
- [ ] `manifest.ts`, icons, apple-touch-icon, theme-color, standalone display
- [ ] Real schedule entered; test on an actual iPhone and Android phone
- [ ] Deploy checklist walked through with Rahul

### M6 — Admin schedule calendar (planned, awaiting go-ahead)

Admin > Schedule gets a `List | Calendar` toggle. The list and form stay as they are; the calendar is a second way to drive the same form and the same `/api/admin/events` API.

**Library: FullCalendar v7 (`@fullcalendar/react` 7.1.x), standard MIT features only.**
- It is the only free option that covers everything asked for in one package: time-grid day and multi-day views, drag-to-create, drag-to-move, resize from the bottom edge, and long-press dragging on touch. react-big-calendar's drag-and-drop is a weaker add-on on touch, and Schedule-X needs paid plugins for part of it.
- v7 resolves named time zones itself (`timeZone: "America/Los_Angeles"`), so no Luxon/Moment plugin. Events crossing midnight render across day columns natively.
- v7 ships no fixed CSS and is themed through class names and CSS variables, which fits the "tokens in globals.css only" rule.
- Time-grid and interaction are MIT. Nothing from the premium scheduler package (timeline, resources) is needed.
- Risk: v7 is a recent major release (its React entry points and CSS variable names changed from v6). The first checklist item is a short spike; if drag, resize or long-press misbehave with React 19 / Next 16, fall back to v6.1.21 with `timeZone: "UTC"` and wall-clock times converted through our own `partyTimeToIso` (safe because the weekend has no DST change).
- New dependencies: `@fullcalendar/react` and its peer `temporal-polyfill`. Loaded only on `/admin` (dynamic import), so guests never download it.

Checklist:
- [ ] Spike: v7 time-grid with move, resize, select and long-press under React 19 / Next 16; confirm or fall back to v6
- [ ] Extract the event form from `SchedulePanel` into `EventForm`, shown inline in List view and in a sheet over the Calendar view
- [ ] Calendar views limited to Oct 8–11: "Day" (default on phones, with the existing day picker) and "Weekend" (4 columns, default on laptops)
- [ ] Tap or drag an empty slot → form prefilled with that start/end; tap an event → same form to edit or delete
- [ ] Drag to move and drag the bottom edge to resize → saved immediately via `PATCH /api/admin/events/[id]`, reverted on failure
- [ ] Toast primitive with "Undo" after each move/resize (restores the previous start/end with another PATCH)
- [ ] All times in party timezone whatever the device's; overnight events render across midnight; events with no end time show as one hour until resized
- [ ] Polling paused while a drag is in progress so the event doesn't jump; guests see changes through the normal 10 s poll
- [ ] FullCalendar colours, borders and radii mapped to theme tokens in `globals.css`; check on a phone (long-press) and a laptop

### M7 — Reactions and comments (planned, awaiting go-ahead)

Data model:

| Table | Columns |
|---|---|
| `post_reactions` | post_id, profile_id, emoji, created_at — primary key (post_id, profile_id, emoji); both ids cascade on delete |
| `post_comments` | id, post_id, profile_id, body (≤ 280), bac_at_comment?, created_at; both ids cascade on delete |

- The emoji set is fixed in code (🍺 😂 🔥 😬 ❤️ 💀) and enforced server-side. A person can have several different reactions on one photo; each toggles independently.
- `bac_at_comment` follows the post rule exactly: computed once server-side when the comment is created, stored only if the commenter's setting is on at that moment, never recomputed. The profile toggle is relabelled "Show my BAC on my posts and comments".
- The polled feed carries only counts: per-emoji totals, which ones are mine, and the comment count, from one aggregate query. Names of reactors and the comment thread load when a photo is opened (`GET /api/posts/[id]`), and that view polls on its own while open.
- Comment timestamps use the viewer's local time, like post timestamps.

Checklist:
- [ ] Schema, both stores, contract tests
- [ ] `POST/DELETE /api/posts/[id]/reactions`, `POST /api/posts/[id]/comments`, `DELETE /api/comments/[id]` (own comment or admin)
- [ ] Feed: reaction bar under each photo with counts, tap to toggle (optimistic), comment count
- [ ] Double-tap a photo = 🔥 (adds, never removes). Photos only: on videos a double-tap belongs to the player
- [ ] Long-press a count → who reacted (also listed in the opened photo, since long-press is hard to discover)
- [ ] Photo detail view: full-size media, reactors, flat comment thread with avatar/name/time/BAC, composer with 280-character counter
- [ ] Delete own comment; admin can delete any
- [ ] Export: add reaction and comment counts to `photos.csv` and a `comments.csv`

Open questions:
1. Opening a photo: with double-tap taken, a single tap on the photo has to wait about a quarter of a second to rule out a double-tap. Alternative: open only from the comment count/button and leave single tap unused. Recommendation: single tap opens, with the short delay.
2. Should deleting a comment or un-reacting be visible to others in any way? Assumed no.

### M8 — Photo map (planned, awaiting go-ahead)

Photos tab gets a `Feed | Map` toggle.

Data model: `posts` gains `lat`, `lng` (double precision, nullable), `location_source` (`exif` | `device` | `event`, nullable) and `event_id` (nullable, set null if the event is deleted). `events` gains `lat`, `lng` so a tagged event can supply coordinates.

Libraries: `leaflet` 1.9 (BSD-2) and `leaflet.markercluster` 1.5 (MIT), used directly in a small client component. Not `react-leaflet`: its current release is under the Hippocratic licence rather than MIT/BSD. `exifr` (MIT) reads GPS from the original file before anything is resized.

Things that change the design, found while planning:
- **EXIF GPS will usually be missing on phones.** iOS Safari has stripped location from photos chosen through a web page since 16.4 (iOS 17 added a per-pick "include location" option for library photos; photos taken through the picker's camera still lose it), and Android's photo picker redacts it for web uploads. Source (a) will mostly help on laptops, so on phones the location will normally be (b): where the phone is at upload time, not where the photo was taken.
- **Videos uploaded as-is can carry location inside the file** (MP4/MOV metadata), and the browser can't strip it without re-encoding. iOS appears to strip it on web uploads; Android behaviour is unverified. Needs a decision (below).
- **Schedule events have no coordinates today**, only a location name and a Maps search string, so "tag an event" needs events to get a lat/lng first.
- **Photos are already stripped.** Every photo is re-encoded through a canvas before upload, which drops all EXIF. The one gap is the fallback that uploads the original when the browser can't decode it; M8 closes that by refusing the upload instead.
- **The map is as public as the site.** There are no accounts, so anyone with the link can create a profile and see where photos were taken, including the house.

Tile usage limits:
- OpenStreetMap's standard tiles (`tile.openstreetmap.org`) need no key but come with a usage policy and no SLA: visible "© OpenStreetMap contributors" attribution, no bulk downloading or prefetching, normal browser caching, a Referer must be sent, and heavy use can be blocked without notice. There is no published request cap. Fifteen people browsing a map for a weekend is well within intended use.
- OSM's standard tiles are light-coloured. "Dark-themed" would be done with a CSS filter on the tile layer (no extra service). CARTO's dark basemap now watermarks tiles requested without a key; a free key (5 million tiles a month, non-commercial) removes it, and would add one env var.
- Geocoding event locations with OSM's Nominatim, if used, is limited to one request per second and must run server-side with an identifying User-Agent. Only Admin would trigger it, on saving an event.

Checklist:
- [ ] Schema, both stores, contract tests; round stored coordinates (see question 3)
- [ ] Read EXIF GPS from the original file before shrinking; skip for videos
- [ ] Geolocation fallback: one explanatory prompt before the browser's own, choice remembered on the device, never re-asked after "no"
- [ ] Optional "tag a schedule event" in the composer
- [ ] Admin event form: set an event's coordinates (search by name, then confirm or drag a pin)
- [ ] Refuse photo uploads that could not be re-encoded, so no original with EXIF reaches Blob
- [ ] Map view: Leaflet + OSM tiles with attribution, dark styling, clustered thumbnail markers, tap a marker to open the photo
- [ ] Posts without a location (including everything posted before M8) simply don't appear on the map
- [ ] `photos.csv` gains lat, lng and location source

Open questions:
1. Priority when someone tags an event **and** device location is available: as written, device location (b) wins over the tag (c). Recommendation: an explicit tag should win over ambient device location, since people often upload later from somewhere else; EXIF still comes first.
2. Videos and embedded location: (i) accept the risk and document it, (ii) only allow videos from devices where we can confirm stripping, or (iii) add a client-side MP4 metadata stripper (more work, one more dependency). Recommendation: (i) for this weekend, noted in the composer.
3. Coordinate precision: store full precision, or round to about 100 m so the map shows the neighbourhood rather than the doorstep? Recommendation: round to 3 decimal places (~110 m).
4. Dark tiles: CSS-filtered OSM (no key, looks slightly artificial) or CARTO dark with a free key (cleaner, one more env var for Rahul)? Recommendation: CSS-filtered OSM.

## Decisions from Peter (2026-10-07)

1. Oct 8–11, 2026, San Diego, Pacific time.
2. Height in feet/inches, weight in pounds (stored metric).
3. Sex: male/female only, no third option; the form defaults to male.
4. A lost device means a new profile; Admin can delete stale profiles.
5. Upload caps: 10 MB photos, 100 MB videos.
6. Admin is not in the bottom nav; guests see four tabs and admins go to `/admin`.
