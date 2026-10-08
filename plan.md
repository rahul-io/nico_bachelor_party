# Plan

Status: **M1 done (2026-10-07), verified in the browser on mock data. M2 is next.**

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
| `profiles` | id, token, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts (default true), created_at |
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
- [ ] Profile photo (client-side resize) and full edit screen
- [ ] Leaderboard: avatar, name, points, drinks, BAC; sort toggle
- [ ] Challenges list and points history on the Leaderboard tab
- [ ] Admin at `/admin` (not in the bottom nav): login/logout with cookie session
- [ ] Admin: schedule CRUD, challenge CRUD, award/deduct points with reason
- [ ] Admin: delete stale profiles (and their drinks, points, posts)

### M3 — Postgres + polling
- [ ] `db/schema.sql`, `npm run db:setup`, optional seed script
- [ ] Postgres `Store` implementation
- [ ] SWR polling + optimistic updates everywhere; demo-mode banner
- [ ] Test against a real Neon database via `vercel env pull` (needs Rahul's setup)

### M4 — Photo Feed + Vercel Blob
- [ ] `handleUpload` route with type/size checks
- [ ] Composer (photo/video + caption, progress bar), feed newest-first with uploader and time
- [ ] Delete own post; admin delete any (also removes the blob)
- [ ] BAC snapshot on posts: store `bac_at_post` at creation when the poster's "show BAC on my posts" setting is on; feed renders "Rahul (0.06%) posted a photo"; never recomputed
- [ ] "Open shared Google Photos album" button
- [ ] Move avatars to Blob

### M5 — Polish, install, deploy
- [ ] Visual pass (type, colour, motion, empty/loading/error states)
- [ ] `manifest.ts`, icons, apple-touch-icon, theme-color, standalone display
- [ ] Real schedule entered; test on an actual iPhone and Android phone
- [ ] Deploy checklist walked through with Rahul

## Decisions from Peter (2026-10-07)

1. Oct 8–11, 2026, San Diego, Pacific time.
2. Height in feet/inches, weight in pounds (stored metric).
3. Sex: male/female only, no third option; the form defaults to male.
4. A lost device means a new profile; Admin can delete stale profiles.
5. Upload caps: 10 MB photos, 100 MB videos.
6. Admin is not in the bottom nav; guests see four tabs and admins go to `/admin`.
