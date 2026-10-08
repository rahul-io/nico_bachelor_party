# Plan

Status: **M1–M8 code done (2026-10-08) and merged with Rahul's full-resolution upload change. M6–M8 were tested on mock data only, on purpose, because guests are using the live site; the new SQL is covered by contract tests against an in-process Postgres. Not pushed. Open: the originals-vs-location decision in M8, running `npm run db:setup` on the live database before deploying, real schedule and challenges in `/admin`, real-phone testing.**

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

**Uploads.** Browser → Vercel Blob directly using `upload()` and a `handleUpload` route that issues a short-lived token after checking profile, content type and size. Post metadata is saved by the client after the upload resolves (the `onUploadCompleted` webhook can't reach localhost). Caps: original images 50 MB, videos 100 MB. Photos retain original bytes for exports and have a separate 1600 px JPEG feed preview when browser decoding is supported; avatars are resized separately. Without a Blob token, uploads are kept as small in-memory images so the flow is still clickable.

**Admin auth.** `POST /api/admin/login` compares against `ADMIN_PASSWORD` (timing-safe), sets an httpOnly, SameSite=Lax, Secure cookie containing an HMAC-signed expiry (`SESSION_SECRET`). Local dev with no password set accepts `admin` and says so on screen; production with no password set refuses all logins.

## Data model

| Table | Columns |
|---|---|
| `profiles` | id, token, name, avatar_url, avatar_data, height_cm, weight_kg, sex, show_bac_on_posts (default true), created_at |
| `drink_logs` | id, profile_id, name, volume_oz, abv, alcohol_g, consumed_at |
| `events` | id, starts_at, ends_at?, title, location?, maps_query?, notes? |
| `challenges` | id, title, description, points, active, created_at |
| `point_events` | id, profile_id, delta, reason?, challenge_id?, created_at |
| `posts` | id, profile_id, url (original), preview_url?, media_type, caption?, bac_at_post?, created_at |

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
- [x] Photos upload in original quality with separate 1600 px JPEG feed previews; videos upload as-is (multipart above 8 MB)
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
- [x] `manifest.ts` (standalone, portrait, starts on the Schedule tab), theme-color, iOS full-screen meta tags
- [x] Icons: 192, 512 and maskable 512 for Android, 180 apple-touch-icon, favicon; generated by `node scripts/make-icons.mjs` and committed
- [x] One-time, dismissible "put this on your home screen" tip with iOS and Android wording; hidden once installed
- [x] Light visual pass: display font for headings (Bricolage Grotesque via the `--font-display` token), keyboard focus ring, reduced-motion support, no rubber-banding behind the fixed bars
- [x] `noindex` so the site stays out of search results
- [x] "/" redirect moved to `next.config.ts`; scaffold leftovers removed
- [ ] Real schedule and challenges entered through `/admin` (the live database has none yet)
- [ ] Test on an actual iPhone and Android phone: install to home screen, photo upload from the camera roll, long drink-logging session
- [ ] Deploy checklist walked through with Rahul (below)

Deploy checklist:
1. Vercel project builds from `main` and the latest commit is the one deployed.
2. Environment variables present in Production: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_GOOGLE_PHOTOS_ALBUM_URL`; redeploy after any change (the `NEXT_PUBLIC_` one is baked in at build time).
3. Open the site: no yellow "Demo mode" banner.
4. `/admin` accepts the password; add the schedule and challenges.
5. On a phone: create a profile, log a drink, post a photo, check the leaderboard, add to home screen and reopen from the icon.
6. Photos tab shows the "Open shared Google Photos album" button.

M5 notes: there is no service worker, so the app needs a connection and does not work offline; that was never in scope. The install tip cannot trigger the install itself on iOS, it only explains the Share menu.

### M6 — Admin schedule calendar
Admin > Schedule has a `List | Calendar` toggle. Both drive the same form and the same `/api/admin/events` API.

Library: FullCalendar v7 (`@fullcalendar/react` 7.1.x, peer `temporal-polyfill`), MIT parts only: time-grid, interaction and the "classic" theme. v7 worked with React 19 / Next 16, so the v6 fallback was not needed. It resolves `America/Los_Angeles` itself. Its palette file is not loaded; the theme's `--fc-classic-*` variables are pointed at our tokens in `globals.css`. The calendar is a dynamic import, so only `/admin` downloads it.

- [x] "Day" view (default on phones, with the day picker) and "Weekend" view (4 columns, default on wider screens), limited to Oct 8–11
- [x] Tap or drag an empty slot → form prefilled with that start/end (a single tap gives one hour)
- [x] Tap an event → same form to edit or delete, in a sheet over the calendar
- [x] Drag to move, drag the bottom edge to resize → saved immediately, snapped back if the save fails
- [x] "Undo" toast after each move/resize
- [x] Party timezone regardless of device; events past midnight render across both days; events with no end show as one hour and stay open-ended when only moved
- [x] Polling can't yank an event mid-drag (the list is held still while dragging)
- [x] Admin page widens for the calendar on larger screens
- [ ] Long-press dragging on a real phone (configured at 350 ms; could not be simulated here)

### M7 — Reactions and comments

| Table | Columns |
|---|---|
| `post_reactions` | post_id, profile_id, emoji, created_at — primary key (post_id, profile_id, emoji); both ids cascade on delete |
| `post_comments` | id, post_id, profile_id, body (≤ 280), bac_at_comment?, created_at; both ids cascade on delete |

- [x] Fixed set 🍺 😂 🔥 😬 ❤️ 💀 (`src/lib/reactions.ts`), enforced server-side; several different reactions per person per photo
- [x] Tap to toggle with instant feedback; counts under each photo
- [x] Double-tap a photo = 🔥 (adds, never removes). Photos only; a video's taps belong to its player
- [x] Single tap opens the photo after a 260 ms wait that rules out a double-tap
- [x] Long-press a reaction → opens the photo, which lists who reacted with what
- [x] Opened photo: full media, reactors, flat comment thread (avatar, name, local time), composer with a 280-character countdown; polls while open
- [x] Comment BAC snapshot under the same rule as posts; profile toggle now reads "Show my BAC on my posts and comments"
- [x] Delete own comment; admin can delete any
- [x] The polled feed carries only counts (one aggregate query each for reactions and comments)
- [x] Export: reaction and comment counts in `photos.csv`, plus `comments.csv`

### M8 — Photo map (planned, awaiting go-ahead)

Photos tab gets a `Feed | Map` toggle.

Data model: `posts` gains `lat`, `lng` (double precision, nullable), `location_source` (`exif` | `device` | `event`, nullable) and `event_id` (nullable, set null if the event is deleted). `events` gains `lat`, `lng` so a tagged event can supply coordinates.

Libraries: `leaflet` 1.9 (BSD-2) and `leaflet.markercluster` 1.5 (MIT), used directly in a small client component. Not `react-leaflet`: its current release is under the Hippocratic licence rather than MIT/BSD. `exifr` (MIT) reads GPS from the original file before anything is resized.

Things that change the design, found while planning:
- **EXIF GPS will usually be missing on phones.** iOS Safari has stripped location from photos chosen through a web page since 16.4 (iOS 17 added a per-pick "include location" option for library photos; photos taken through the picker's camera still lose it), and Android's photo picker redacts it for web uploads. Source (a) will mostly help on laptops, so on phones the location will normally be (b): where the phone is at upload time, not where the photo was taken.
- **Videos uploaded as-is can carry location inside the file** (MP4/MOV metadata), and the browser can't strip it without re-encoding. iOS appears to strip it on web uploads; Android behaviour is unverified. Accepted as-is (decision 2).
- **Schedule events have no coordinates today**, only a location name and a Maps search string, so "tag an event" needs events to get a lat/lng first.
- **Photos are no longer stripped.** When M8 was planned every photo was re-encoded before upload, which dropped all EXIF. Since 98e33ba the untouched original is uploaded alongside a re-encoded preview; only the preview is metadata-free.
- **The map is as public as the site.** There are no accounts, so anyone with the link can create a profile and see where photos were taken, including the house.

Tile usage limits:
- OpenStreetMap's standard tiles (`tile.openstreetmap.org`) need no key but come with a usage policy and no SLA: visible "© OpenStreetMap contributors" attribution, no bulk downloading or prefetching, normal browser caching, a Referer must be sent, and heavy use can be blocked without notice. There is no published request cap. Fifteen people browsing a map for a weekend is well within intended use.
- OSM's standard tiles are light-coloured. "Dark-themed" would be done with a CSS filter on the tile layer (no extra service). CARTO's dark basemap now watermarks tiles requested without a key; a free key (5 million tiles a month, non-commercial) removes it, and would add one env var.
- Geocoding event locations with OSM's Nominatim, if used, is limited to one request per second and must run server-side with an identifying User-Agent. Only Admin would trigger it, on saving an event.

Checklist:
- [x] Schema (`posts.lat/lng/location_source/event_id`, `events.lat/lng`, added with `ALTER … IF NOT EXISTS`), both stores, contract tests; full precision
- [x] EXIF GPS read from the original file before shrinking (`exifr`); skipped for videos
- [x] Location choice made server-side in `src/lib/location.ts`: EXIF, then tagged event, then device
- [x] "Put my posts on the photo map" opt-in in the composer, with the reason spelled out; the browser's own prompt appears when it is first ticked; choice remembered per device
- [x] Optional "Where was this?" event tag in the composer
- [x] Admin event form: "Find on map" (OpenStreetMap Nominatim, server-side, admin-only), then tap the map or drag the pin
- [ ] Keep location metadata out of the public files. **Not in place.** Rahul's "photos now saving in full resolution" change (98e33ba, merged in) uploads untouched originals on purpose, so EXIF, including GPS when the phone includes it, is in the original file, and the feed API returns that file's URL. Needs a decision; options below.
- [x] Map view: Leaflet + OSM tiles with attribution, dark via CSS filter, thumbnail markers, clusters; tap a marker to open the photo
- [x] Photos sharing one spot (e.g. all tagged with the same event) open as a thumbnail list instead of zooming forever
- [x] `photos.csv` has lat, lng and location source
- [ ] Device-location permission flow on a real phone (the browser prompt could not be exercised here)

Clustering uses `supercluster` (ISC) rather than `leaflet.markercluster`: it is a plain data library with no dependency on Leaflet's global, and it can tell when a cluster will never split.

Open decision (originals vs. location metadata), for Peter and Rahul:
- (a) Leave as is: originals untouched and their URLs public. Simplest; a photo taken with location on can reveal where, to anyone who has the site link.
- (b) Keep originals untouched but stop sending their URLs to guests: the feed API returns only the preview, originals are reachable only through the Admin export. No change to stored files; small code change.
- (c) Strip location from the original before upload (lossless for JPEG, re-encode for other formats). The stored file is then no longer byte-identical to the camera file, and Rahul's upload tests that assert "untouched" would change.

Decisions (Peter, 2026-10-08):
1. Location priority is EXIF, then an explicitly tagged event, then device location. An explicit tag beats ambient device location.
2. Videos: not expected, so no special handling of location embedded in video files. They get a location only from a tag or device location.
3. Coordinates are stored at full precision, no rounding.
4. Dark map via a CSS filter over standard OpenStreetMap tiles. No tile API key.

## Decisions from Peter (2026-10-07)

1. Oct 8–11, 2026, San Diego, Pacific time.
2. Height in feet/inches, weight in pounds (stored metric).
3. Sex: male/female only, no third option; the form defaults to male.
4. A lost device means a new profile; Admin can delete stale profiles.
5. Upload caps: 50 MB original photos, 100 MB videos.
6. Admin is not in the bottom nav; guests see four tabs and admins go to `/admin`.
