@AGENTS.md

# The Crider Cup (Nico's bachelor party app)

The app is called **The Crider Cup** everywhere a person sees it (short name "Crider Cup" under the home-screen icon). The name comes from `config.partyName` / `config.shortName` in `src/config.ts`; never hard-code it. The repo, package name, cookie and localStorage keys (`nbp.*`) and other code identifiers keep their original names on purpose.

Mobile-first web app for one weekend (Oct 8–11, 2026, San Diego, Pacific time), ~10–15 people. Four tabs in the bottom nav: Schedule, Sobriety Tracker, Leaderboard, Photo Feed. Admin lives at `/admin` and is deliberately not linked from the nav. See [plan.md](plan.md) for milestones and current status — update its checkboxes as work lands.

## People and workflow

- Rahul owns the GitHub repo (`rahul-io/nico_bachelor_party`) and the Vercel account. Peter builds locally on Windows and pushes to `main`, which auto-deploys.
- Never push without Peter asking. Never commit `.env*` files other than `.env.example`.
- Commits use conventional prefixes (`chore:`, `feat:`, `fix:`).
- **Use `npm run dev:mock` for anything that creates test data** (profiles, posts, comments, events). It ignores `.env.local` and runs on in-memory data; local admin password is `admin`. Plain `npm run dev` talks to the live site's database.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm test` (vitest), `npm run test:e2e` (gate and accounts, against `dev:mock`), `npm run test:e2e:points` and `npm run test:e2e:games` (drink points and the games; each against a fresh `dev:mock`), `npm run db:setup` (applies `db/schema.sql` to `DATABASE_URL`; idempotent), `npm run export-photos` (downloads the whole feed locally).
- With `.env.local` filled in, local dev reads and writes the **live** Neon database and Blob store. Delete any test profiles/posts you create (deleting a profile in Admin removes its drinks, points, posts and files), or blank those variables to use mock data. Shell is PowerShell (no `&&`).

## Stack

- Next.js 16 (App Router, TypeScript, `src/`), React 19, Tailwind CSS v4, lucide-react for icons.
- Fonts via `next/font/google`: Inter (`font-sans`, all functional UI), Fraunces (`font-display`, headlines and titles), Playfair Display Italic (`font-script` + `italic`, the occasional decorative line).
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
3. **Theme tokens live in one place**: `src/app/globals.css` (Tailwind v4 `@theme`, with night-mode overrides under `[data-theme="night"]`). There is no `tailwind.config.*`. Components use token utilities, never hex values, arbitrary colour values or Tailwind's default palette. The unavoidable copies are `config.brand.chrome` (manifest and status-bar colour) and the navy in `scripts/make-icons.mjs` / `make-logo.mjs`; change them together and re-run both scripts.
4. **Secrets stay server-side.** The invite code, admin password and session secret are read only through `src/lib/env.ts` and compared in route handlers with timing-safe checks. No `NEXT_PUBLIC_` versions of any of them.
4a. **Admin password stays server-side.** Checked in a route handler against `ADMIN_PASSWORD` with a timing-safe compare; session is a signed httpOnly cookie. No `NEXT_PUBLIC_` admin anything. Every `/api/admin/*` handler and every admin-only action verifies the cookie itself. In production with `ADMIN_PASSWORD` unset, admin login is disabled (fail closed); in dev it falls back to a documented dev password.
5. **BAC is shown plainly, and never as a verdict.** Peter had every disclaimer removed on 2026-10-08 ("rough estimate", "just for fun", and the standing-orders line on the gauge): do not add caveats or safety copy back. What still holds: never render copy, colours or icons implying someone is fine to drive, "under the limit" or "sober"; no green or teal on a BAC number; no references to legal limits.
6. **No Google Photos API.** The Photos tab only links out to the shared album via `NEXT_PUBLIC_GOOGLE_PHOTOS_ALBUM_URL`.
7. **Body metrics are private.** Height, weight and sex are never returned from the API for anyone but the requesting profile. Leaderboard and trend-chart BAC is computed server-side.
10. **Polled responses stay small.** Anything fetched on the 10 s poll must not carry image data. Avatars live in `profiles.avatar_data` and are served by `/api/avatars/[id]?v=hash` with immutable caching; `avatar_url` holds only that short URL. Never `select *` from `profiles`.
11. **Original photo URLs never reach guests.** Photos are uploaded as untouched originals (kept for exports) plus a 1600 px JPEG preview (`uploadPostMedia`). Originals can contain EXIF, including GPS, so every response to a guest goes through `forGuests()` in `src/lib/feed.ts`, which swaps the original URL for the preview. Only the admin export (`buildExportFeed`) and `scripts/export-photos.mts` read originals. Never return a raw `Post` from a guest-facing route. Posts with no preview (videos, GIFs, undecodable formats) expose their only file. A post's map location lives in the database (`lat`, `lng`, `location_source`), chosen by `resolveLocation`: EXIF, then a tagged event, then device location.
8. **Post BAC is a snapshot.** When a photo/video post is created and the poster's `showBacOnPosts` setting is on (default on, editable in their profile), the server computes their BAC once and stores it on the post (`bac_at_post`). It is never recomputed or backfilled; if the setting was off, it stays null and the feed shows no number. Comments follow the same rule (`bac_at_comment`); both go through `bacSnapshot()` in `src/lib/feed.ts`.
9. **Mobile first, day and night.** Design for a ~380px-wide phone. Every screen must work in both modes (toggle in the header; default follows the phone). Tap targets ≥ 44px, content clear of the bottom nav and the iOS safe area.

## Planned, not built

**M13 (achievements and merit badges)** is specified in plan.md and waits for Peter's go-ahead. It sits on the points economy and the games below and follows their rules. For M13 in particular:
- The trophy case goes on a public profile page (people can view each other's profiles); body metrics stay private.
- "Designated Driver" and "Take the Wheel Cap'n" (both at 0.08%) are built exactly as Peter wrote them: his explicit exception to rule 5 for those two badges only.
- Badges come from three sources behind one evaluator interface: manual, rule-based (a JSON rule built in Admin; `describeRule()` writes the plain-English preview from the same rule the evaluator runs) and coded (pure functions; read-only in Admin).
- Merit badges are checked on the event that can earn them and revoked when that drink, water or photo is deleted. Achievement holders are computed on read while the day runs and written at the cutoff by the M11 settlement.
- Badge points go through the ledger (`badge` source, unique key). Editing a badge's points affects future awards only unless an admin runs "Recalculate all".
- Photo tags travel with the post body; don't change Rahul's upload flow for them.

## Points economy (M11)

Logging a drink or a water earns points automatically; hourly and daily awards and admin-run multipliers sit on top. The rules as Peter set them are in plan.md under M11.

- **Every number is a setting.** `src/lib/points/settings.ts` holds the defaults and ranges; Admin > Points > Settings is generated from it and stores overrides in `app_settings`. No magic numbers in rules code: add a setting.
- **Rules are pure.** `score.ts` (drink, water, Cheers) and `awards.ts` (hourly and daily winners) take plain inputs, with no database and no clock, and are unit-tested. `service.ts` is the only place that joins them to the store.
- **Computed once, on the server, when the thing happens**, and written to the ledger with the breakdown that produced it. Changing a setting never rewrites history. Anything random (M12) is drawn on the server.
- **Order for one drink:** standard drinks → pace cap → × points per drink → multipliers, held to the maximum combined multiplier → BAC ceiling. Flat bonuses (Cheers) are separate entries.
- **Reversal:** deleting a drink or water voids every ledger entry linked to it (`drink_id`), and a Cheers left short is voided for everyone (`group_id`). Voided entries stay in the history, struck through; every total must skip them (`voidedAt`).
- **Idempotent awards:** every automatic entry has a unique `award_key` (`drink:<id>`, `hour:<iso>:winner`, `day:<day>:smooth`…). `addPointEvent` returns null when the key exists. There is no scheduler: `settleDue()` runs from the polled status endpoint, at most once per clock hour per server instance, and Admin has "Settle now". Last Man Standing is paid only when an admin confirms it.
- **A "day" is 4am to 4am party time** (`dayCutoffHour`), via `partyDayOf` / `partyDayBounds`.
- **Water is not a drink.** It lives in `water_logs` so drink counts and BAC never see it.
- **The BAC ceiling pauses points without commentary:** "points paused" and nothing more, consistent with rule 5.
- **The slot machine spins on every third drink a person logs** (`slotEveryDrinks`), so anything asserting exact drink points must pin it: tests pass `random` to `logDrink`, and the e2e scripts set the odds to 100% 1×.
- **Polling:** every tab polls `/api/points/status` (Happy Hour, Drink of the Day, the latest dispatches). Keep it small. `/api/points` returns the newest 150 entries; `?profile=<id>` returns one person's entries and their points by source.

## Games (M12)

Slot machine, Bartender's Choice, Groom Tax, curses, wagers with side bets, and the Snitch Line. Rules as built are in plan.md under M12 and on the in-app "How points work" page.

- **Code:** `src/lib/games/`, one file per game. `common.ts` has `notify` (per-person notices: the bell and a toast), `feedLine` (system lines in the Captain's Log), `spend` (nobody goes below zero) and `GameError` (a refusal whose message is shown to the player as is). Player routes go through `playerAction` in `games/http.ts`.
- **State is `game_records`:** one table of small JSON rows (`kind`, owner, `status`, `data`); each game's file documents its own shape. Use `updateRecord(id, patch, expectStatus)` for any step that must happen once (accept, settle, use up a Shield). Money always moves through the ledger with an `award_key`, so a repeated step can't pay twice.
- **Display identity:** wrap the store with `displayStore(getStore())` in every guest-facing read that shows names or avatars. It applies Name Hijack and Avatar Swap. Admin routes and exports use the plain store. Login names never change.
- **Everything a drink sets off carries its `drink_id`** (Jackpot, robbery, points paid forward, Groom Tax), so deleting the drink reverses it. A deleted drink's slot result is remembered and reused, so delete-and-relog is not a re-spin.
- **Random outcomes are drawn on the server** (`spinSlot`, `assignDrinks`); the reels in the browser only display the result that is already in the ledger.
- **Photos for Avatar Swap and the Snitch Line are picked from the feed** and stored as the preview URL, never the original (rule 11). Don't add a second upload path.
- `/api/games/me` is polled on every tab (balance, notices, Bartender's order, own curses); `/api/games` is the shared board. Keep both small.

## Access and identity

Two layers, both httpOnly signed cookies. Nothing guest-facing may trust a profile id sent by the client.

1. **Invite gate.** `src/proxy.ts` (Next 16's middleware) runs before every page and API request. Without a valid `nbp_gate` cookie, pages redirect to `/gate` and `/api/*` returns 401 `{ code: "gate" }`. Only the gate itself and a short allow-list of public files (manifest, icons, logo, link-preview image, `/brand`) pass. It fails closed: no `INVITE_CODE` or no `SESSION_SECRET` in production means nobody gets in. The cookie's signing key includes the invite code, so changing the code invalidates every gate cookie. A new route is gated automatically; never add to the allow-list casually.
2. **Accounts.** Display name (unique among accounts, case-insensitive) + password, hashed with `bcryptjs`. Never log, store or return a plaintext password or a hash. The session cookie `nbp_session` holds the profile id, the profile's `session_version` and an issue time; it lasts 30 days and is renewed by `GET /api/auth/me`. "Log out" clears that device's cookie; bumping `session_version` (password change, admin reset) signs every device out.
3. **In a route handler:** `const profile = await getRequestProfile(req)` from `src/lib/http.ts`, then 401 if null. It returns null for someone whose password was just reset (`mustChangePassword`) until they choose a new one; only `/api/auth/password` opts out of that.
4. **Rate limits** (`src/lib/rate-limit.ts`) are counted in the database (`auth_attempts`), never in memory. A name locks for 5 minutes after 10 wrong passwords; per-IP limits are loose because a whole house shares one address.
5. **Admin** is a separate password and cookie (`ADMIN_PASSWORD`, `src/lib/auth.ts`) on top of the gate. Admin > People can reset a password: it issues a temporary one (shown once), signs the person out everywhere and forces a change at next login.
6. **Legacy profiles.** Profiles made before accounts have no password and a per-device token in localStorage (`src/lib/identity.ts`). The welcome screen lets that device claim its profile by setting a password (`/api/auth/claim`); the token is then cleared. That file has no other purpose now.
7. **On the client** use `useSession()` / `useProfile()` / `useIdentity()` from `src/hooks/useProfile.ts`. `apiFetch` sends no identity; cookies carry it.
8. **Testing:** `npm run test:e2e` against a fresh `npm run dev:mock` (invite code `ahoy`, admin password `admin`) drives the whole flow with separate cookie jars. It trips the rate limits on purpose, so restart the mock server before re-running, and it refuses to run against anything but localhost.

Height is entered in feet/inches and weight in pounds, stored metric. Sex is male/female only and the form defaults to male.

## BAC math (`src/lib/bac.ts`, pure and unit-tested)

- Alcohol grams = volume oz × 29.5735 × ABV × 0.789. A "standard drink" is 14 g.
- Widmark: `BAC% = grams / (weight_g × r) × 100 − 0.015 × hours`.
- `r` from Seidl (height cm, weight kg): male `0.31608 − 0.004821·W + 0.004632·H`, female `0.31223 − 0.006446·W + 0.004466·H`. If the result is outside a sane range, fall back to 0.68 male / 0.55 female.
- Drinks are processed chronologically; elimination runs continuously from the first drink of a session and BAC is floored at 0 (hitting 0 ends the session). Absorption is treated as instant.
- The same function is used by the tracker (client, recalculated every minute) and the leaderboard (server).

## Folder structure (target)

```
src/
  proxy.ts                         the invite gate, in front of everything
  app/
    layout.tsx, globals.css        root layout, theme tokens
    manifest.ts, icon.png, apple-icon.png   home-screen install (PNGs are generated, don't hand-edit)
    (tabs)/                        layout with bottom nav
      schedule/ tracker/ leaderboard/ photos/
    admin/                         password-gated, not in the nav
    gate/, welcome/, password/     invite code; create profile or log in; change password
    profile/                       edit profile, change password, log out
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
    gate.ts, session.ts, signed.ts invite-gate and login cookies (HMAC-signed)
    password.ts, rate-limit.ts     bcrypt hashing and temp passwords; attempt counting
    limits.ts                      limits shared by browser and server
    leaderboard.ts, trends.ts      server-side totals, points history, chart series
    points/                        the points economy: settings, pure rules (score, awards), service, formatting
    games/                         the M12 games, one file each, plus shared notices, feed lines, spending
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
  make-logo.mjs                    regenerates public/logo.png and the link-preview image public/og.png
                                   from design/logo-source.webp (the mascot badge Peter supplied)
  export-photos.mts                downloads every post + photos.csv; runs on plain Node type-stripping,
                                   so anything it imports must use relative `.ts` paths and no `@/` alias
```

## Design: "private yacht club meets tropical rum bar"

Mock-serious maritime tradition against a gloriously unserious bachelor-party competition. The reference boards are denser than the product should be: real screens stay clean.

- **Proportions:** about 70% navy and sand, 20% gold and rum amber, 10% tropical accents.
- **Frame:** header and bottom nav are navy (`bg-chrome`) in both modes. Content is sand and white by day, deeper navy at night. The sea-chart background sits behind every page, veiled so it stays a texture.
- **Accent jobs:** gold = prestige and rewards (primary buttons via `goldFill`, points, the leader's row). Teal (`lagoon`) = progress and completion only, never on BAC. Coral = playful alerts ("Under way", deductions, errors).
- **Token pairs to know:** `primary`/`on-primary` is the gold fill with navy lettering. `accent` is gold-toned *text* (rum amber by day because gold is too pale on white, gold at night). `select`/`on-select` is the chosen tab or day. `link` is ocean by day. Fixed brand colours (`navy`, `sand`, `gold`, `gold-hi`, `coral`, `lagoon`, `sunset`…) are for things that must not change with the mode, such as lettering on photographs.
- **Type:** Fraunces Bold for page titles, event names and challenge titles; Inter for everything functional; Playfair italic is reserved for the splash text. Small-caps eyebrows (`text-xs font-semibold uppercase tracking-[0.16em]`) label sections. Use `PageTitle`.
- **No taglines.** Peter cut the written flourishes as corny ("Drink. Explore. Compete. Legend awaits." and similar): don't write slogans or jokey sublines. The one decorative line is `Splash`, which rotates the crew's spellings of the toast ("Slange Va!" …) exactly as Peter wrote them; it appears on the gate/welcome hero, in every `PageTitle` and on the Schedule hero.
- **Voice:** navigation labels stay plain (Schedule, Grog Log, Leaders, Capt's Log); headings and empty states carry the theme (The Voyage, Captain's Log, The Bridge, "Under way", "Next port of call", "Ledger"). Functional copy, errors and anything about money or safety stay literal.
- **Photography and marks** live in `public/brand` (built by `scripts/make-brand.mjs` from `design/brand`). Use them on a few chosen surfaces only: the welcome screen, the Schedule hero, the Grog Log gauge, the Challenges plaque. `PhotoBand` puts a navy wash under sand lettering. The crest (`lockup.webp`, the hat-and-tikis badge Peter supplied) works on any background. The Commodore's Challenge lockup has navy lettering, so it sits on sand, never on navy. The slot machine's seven symbols and its cabinet frame are in `design/brand/slot` (built to `public/brand/slot`); the frame's reel window position is hard-coded in `SlotReels.tsx`, so a new frame needs those numbers re-measured. Unused so far, kept in `design/brand`: waves, gulls, palm fronds, captain's hat, the tiki wordmark.
- **Icons:** lucide line icons (ShipWheel, BottleWine, Trophy, BookOpenText, Anchor…), gold on navy. The raster icon sheet in `design/brand` is reference only.

## Conventions

- Server Components by default; add `"use client"` only where state, effects, or SWR are needed.
- `cacheComponents` and `partialPrefetching` are on (create-next-app defaults). Consequences:
  - No `export const dynamic` / `revalidate` segment config. A GET route handler that reads no request data must call `await connection()` to stay uncached.
  - No `redirect()` from a page component (it fails the same validation); route-level redirects go in `next.config.ts`.
  - Every page must render something on the server. Never gate a page by returning `null` until the client mounts (Next reports a dropped segment). Browser-only values come from hooks that are `null`/`undefined` on the server: `useNow()` and `useIdentity()`. Never call `Date.now()` or read localStorage during render.
- Shared types come from `src/lib/store/types.ts`. Read env vars only through `src/lib/env.ts`.
- Timestamps are stored as UTC (`timestamptz`). Anything about the plan (schedule, admin event times, export file names) renders in the party timezone from `src/config.ts`. "When was this posted" stamps on photos and comments render in the viewer's own timezone (`formatDeviceWeekdayTime`).
- Points are a ledger (`point_events`); totals are always summed, never stored, and skip voided entries. Points have one decimal place: show them with `formatPoints` / `formatDelta`.
- Validate request bodies by hand in the route handler; return `{ error }` with a proper status.
- Admin: every `/api/admin/*` handler starts with `if (!(await isAdmin())) return jsonError("Not authorized", 401)`. Guest-facing reads of the same data live outside `/api/admin` and return only public fields.
- Client data: `usePolled(path)` for polled GETs, `useAction()` for mutations with a status line, then `mutate(key)` the affected paths.
- Charts are hand-written SVG (no chart library). One y-axis, 2 px lines, neutral lines with a single highlighted series, text in `ink`/`muted` tokens, and a ranked list under the chart that doubles as legend and table view.
- Keep dependencies minimal — ask before adding one.
