@AGENTS.md

# Nico's Bachelor Party App

Mobile-first web app for one weekend (Oct 8–11, 2026, San Diego, Pacific time), ~10–15 people. Four tabs in the bottom nav: Schedule, Sobriety Tracker, Leaderboard, Photo Feed. Admin lives at `/admin` and is deliberately not linked from the nav. See [plan.md](plan.md) for milestones and current status — update its checkboxes as work lands.

## People and workflow

- Rahul owns the GitHub repo (`rahul-io/nico_bachelor_party`) and the Vercel account. Peter builds locally on Windows and pushes to `main`, which auto-deploys.
- Never push without Peter asking. Never commit `.env*` files other than `.env.example`.
- Commits use conventional prefixes (`chore:`, `feat:`, `fix:`).
- **Use `npm run dev:mock` for anything that creates test data** (profiles, posts, comments, events). It ignores `.env.local` and runs on in-memory data; local admin password is `admin`. Plain `npm run dev` talks to the live site's database.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm test` (vitest), `npm run db:setup` (applies `db/schema.sql` to `DATABASE_URL`; idempotent), `npm run export-photos` (downloads the whole feed locally).
- With `.env.local` filled in, local dev reads and writes the **live** Neon database and Blob store. Delete any test profiles/posts you create (deleting a profile in Admin removes its drinks, points, posts and files), or blank those variables to use mock data. Shell is PowerShell (no `&&`).

## Stack

- Next.js 16 (App Router, TypeScript, `src/`), React 19, Tailwind CSS v4, lucide-react for icons.
- Next 16 differs from older versions (see AGENTS.md): read `node_modules/next/dist/docs/` before using an API you haven't used in this repo yet.
- Data: Postgres (Neon via Vercel Marketplace) through `@neondatabase/serverless` tagged-template SQL. No ORM.
- Media: Vercel Blob (`@vercel/blob`) with **client-side uploads** via the `handleUpload` route handler (`/api/blob/upload`). Never proxy file bytes through a route handler. The client then calls `POST /api/posts` with the blob URL, and the server re-validates it with `head()` before saving. Limits live in `src/lib/media.ts`.
- Live updates: SWR polling with `refreshInterval: 10_000`. No websockets.
- Maps: Leaflet used directly through `src/lib/leaflet.ts` (never `react-leaflet`, which is not MIT/BSD), standard OpenStreetMap tiles with attribution left on, no tile API key, `supercluster` for clustering. Dark styling is the `.party-map` CSS filter.
- Admin calendar: FullCalendar v7 (`@fullcalendar/react`), MIT parts only, loaded with `next/dynamic` so guests never download it. Colours come from the `.party-calendar` block in `globals.css`.
- Drink search: `fuse.js` over a static JSON file, client-side.

## Hard rules

1. **Runs without credentials.** If `DATABASE_URL` / `BLOB_READ_WRITE_TOKEN` are missing, the app falls back to in-memory mock data and every tab must still be clickable. Never import a DB or Blob client at module top level in a way that throws when env vars are absent.
2. **One data seam.** UI only talks to `/api/*` (through SWR hooks in `src/hooks`). Route handlers only talk to `getStore()` from `src/lib/store`. Both the mock and Postgres stores implement the same `Store` interface; add a method to the interface, both implementations, `db/schema.sql` and the contract suite in `src/lib/store/store.test.ts` together. That suite runs every case against the mock and against a real in-process Postgres (PGlite), which is how SQL gets tested without credentials.
3. **Theme tokens live in one place**: `src/app/globals.css` (Tailwind v4 `@theme`). The two unavoidable copies are `config.brand` (manifest and status-bar colour) and the palette in `scripts/make-icons.mjs`; change them together and re-run the icon script. There is no `tailwind.config.*`. Components use token utilities (`bg-surface`, `text-muted`, `rounded-card`…), never hex values, arbitrary color values, or Tailwind's default palette (`bg-zinc-900`).
4. **Admin password stays server-side.** Checked in a route handler against `ADMIN_PASSWORD` with a timing-safe compare; session is a signed httpOnly cookie. No `NEXT_PUBLIC_` admin anything. Every `/api/admin/*` handler and every admin-only action verifies the cookie itself. In production with `ADMIN_PASSWORD` unset, admin login is disabled (fail closed); in dev it falls back to a documented dev password.
5. **Sobriety tracker is a toy.** Always labelled as a rough estimate for fun. Never render copy, colours, or icons implying someone is fine to drive, "under the limit", or "sober" — no green/safe states tied to a BAC number, no references to legal limits.
6. **No Google Photos API.** The Photos tab only links out to the shared album via `NEXT_PUBLIC_GOOGLE_PHOTOS_ALBUM_URL`.
7. **Body metrics are private.** Height, weight and sex are never returned from the API for anyone but the requesting profile. Leaderboard and trend-chart BAC is computed server-side.
10. **Polled responses stay small.** Anything fetched on the 10 s poll must not carry image data. Avatars live in `profiles.avatar_data` and are served by `/api/avatars/[id]?v=hash` with immutable caching; `avatar_url` holds only that short URL. Never `select *` from `profiles`.
11. **Uploaded photos carry no metadata.** Every photo is re-encoded in the browser before upload (`shrinkPhoto`), which strips EXIF including GPS. Never add a path that uploads an original image file. A post's location lives only in the database (`lat`, `lng`, `location_source`), chosen by `resolveLocation`: EXIF, then a tagged event, then device location.
8. **Post BAC is a snapshot.** When a photo/video post is created and the poster's `showBacOnPosts` setting is on (default on, editable in their profile), the server computes their BAC once and stores it on the post (`bac_at_post`). It is never recomputed or backfilled; if the setting was off, it stays null and the feed shows no number. Comments follow the same rule (`bac_at_comment`); both go through `bacSnapshot()` in `src/lib/feed.ts`.
9. **Mobile first.** Design for a ~380px-wide phone at night: dark theme, tap targets ≥ 44px, content clear of the bottom nav and the iOS safe area.

## Identity

No accounts. First visit creates a profile (display name, photo, height, weight, sex). The server returns a public `id` and a private `token`; both are kept in localStorage and the token is sent as a header on writes. Losing localStorage means making a new profile; Admin can delete stale ones. Height is entered in feet/inches and weight in pounds, stored metric. Sex is male/female only and the form defaults to male.

## BAC math (`src/lib/bac.ts`, pure and unit-tested)

- Alcohol grams = volume oz × 29.5735 × ABV × 0.789. A "standard drink" is 14 g.
- Widmark: `BAC% = grams / (weight_g × r) × 100 − 0.015 × hours`.
- `r` from Seidl (height cm, weight kg): male `0.31608 − 0.004821·W + 0.004632·H`, female `0.31223 − 0.006446·W + 0.004466·H`. If the result is outside a sane range, fall back to 0.68 male / 0.55 female.
- Drinks are processed chronologically; elimination runs continuously from the first drink of a session and BAC is floored at 0 (hitting 0 ends the session). Absorption is treated as instant.
- The same function is used by the tracker (client, recalculated every minute) and the leaderboard (server).

## Folder structure (target)

```
src/
  app/
    layout.tsx, globals.css        root layout, theme tokens
    manifest.ts, icon.png, apple-icon.png   home-screen install (PNGs are generated, don't hand-edit)
    (tabs)/                        layout with bottom nav
      schedule/ tracker/ leaderboard/ photos/
    admin/                         password-gated, not in the nav
    profile/                       create / edit profile
    api/                           route handlers (thin: validate → getStore())
      posts/, blob/upload/         feed, post create/delete, upload tokens
      admin/…                      cookie-gated
      blob/upload/                 handleUpload token exchange
  components/
    ui/                            Button, Card, Sheet, Avatar… (token-styled primitives)
    <feature>/                     feature components
  hooks/                           SWR hooks, useProfile, useNow
  lib/
    store/                         types.ts (Store interface), mock.ts, postgres.ts, index.ts (getStore)
    bac.ts, drinks.ts, schedule.ts, time.ts, units.ts   pure helpers
    api.ts, identity.ts            client fetch + localStorage identity
    http.ts, validate.ts           route handler helpers
    auth.ts, env.ts                admin cookie session, env access
    leaderboard.ts, trends.ts      server-side totals, points history, chart series
    avatar.ts, chart.ts            avatar storage rules; tick/label layout helpers
    media.ts, feed.ts, upload.ts   upload rules; feed + blob cleanup (server); browser upload helpers
    export.ts, feed-assemble.ts    export names + CSV and feed joining, shared with scripts/ (no runtime imports allowed)
    reactions.ts, location.ts      fixed emoji set + optimistic helper; location parsing and priority
    geo.ts, leaflet.ts             device-location opt-in; Leaflet loader and map factory (browser only)
  data/
    drinks.json                    ~100 seeded drinks
    seed.ts                        mock schedule / profiles / challenges
  config.ts                        party name, dates, timezone, upload caps
db/
  schema.sql                       idempotent schema, applied by `npm run db:setup`; new columns on existing tables go in as `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
scripts/
  dev-mock.mjs                     dev server on mock data, ignoring .env.local
  db-setup.mjs                     runs schema.sql against DATABASE_URL
  make-icons.mjs                   regenerates every icon PNG from one inline SVG
  export-photos.mts                downloads every post + photos.csv; runs on plain Node type-stripping,
                                   so anything it imports must use relative `.ts` paths and no `@/` alias
```

## Conventions

- Server Components by default; add `"use client"` only where state, effects, or SWR are needed.
- `cacheComponents` and `partialPrefetching` are on (create-next-app defaults). Consequences:
  - No `export const dynamic` / `revalidate` segment config. A GET route handler that reads no request data must call `await connection()` to stay uncached.
  - No `redirect()` from a page component (it fails the same validation); route-level redirects go in `next.config.ts`.
  - Every page must render something on the server. Never gate a page by returning `null` until the client mounts (Next reports a dropped segment). Browser-only values come from hooks that are `null`/`undefined` on the server: `useNow()` and `useIdentity()`. Never call `Date.now()` or read localStorage during render.
- Shared types come from `src/lib/store/types.ts`. Read env vars only through `src/lib/env.ts`.
- Timestamps are stored as UTC (`timestamptz`). Anything about the plan (schedule, admin event times, export file names) renders in the party timezone from `src/config.ts`. "When was this posted" stamps on photos and comments render in the viewer's own timezone (`formatDeviceWeekdayTime`).
- Points are a ledger (`point_events`); totals are always summed, never stored.
- Validate request bodies by hand in the route handler; return `{ error }` with a proper status.
- Admin: every `/api/admin/*` handler starts with `if (!(await isAdmin())) return jsonError("Not authorized", 401)`. Guest-facing reads of the same data live outside `/api/admin` and return only public fields.
- Client data: `usePolled(path)` for polled GETs, `useAction()` for mutations with a status line, then `mutate(key)` the affected paths.
- Charts are hand-written SVG (no chart library). One y-axis, 2 px lines, neutral lines with a single highlighted series, text in `ink`/`muted` tokens, and a ranked list under the chart that doubles as legend and table view.
- Keep dependencies minimal — ask before adding one.
