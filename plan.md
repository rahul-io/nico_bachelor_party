# Plan

Status: **scaffold done, waiting for approval to start M1.**

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
| `profiles` | id, token, name, avatar_url, height_cm, weight_kg, sex, created_at |
| `drink_logs` | id, profile_id, name, volume_oz, abv, alcohol_g, consumed_at |
| `events` | id, starts_at, ends_at?, title, location?, maps_query?, notes? |
| `challenges` | id, title, description, points, active, created_at |
| `point_events` | id, profile_id, delta, reason?, challenge_id?, created_at |
| `posts` | id, profile_id, blob_url, media_type, caption?, created_at |

Points totals and drink counts are derived by query. The ~100-drink catalogue is a static JSON file, not a table.

## Milestones

### M1 — App shell, Schedule, Sobriety Tracker (mock data)
- [ ] Theme tokens in `globals.css`; UI primitives (Button, Card, Sheet, Input, Avatar)
- [ ] `(tabs)` layout with bottom nav, safe-area padding, header with profile avatar
- [ ] `Store` interface + in-memory store + seed data; `env.ts`, `config.ts`
- [ ] Minimal profile create/edit (name, height, weight, sex) — pulled forward from M2 because the tracker can't work without it; photo comes in M2
- [ ] Schedule: day picker, event cards, Google Maps links, current/next highlight
- [ ] `drinks.json` (~100 drinks) + fuzzy search
- [ ] Tracker: search, quick-select buttons, category / standard drink / custom fallback, drink log with delete, BAC recalculated every minute, "rough estimate for fun" labelling
- [ ] `bac.ts` with unit tests (adds `vitest` as a dev dependency)

### M2 — Profiles, Leaderboard, Admin (mock data)
- [ ] Profile photo (client-side resize) and full edit screen
- [ ] Leaderboard: avatar, name, points, drinks, BAC; sort toggle
- [ ] Challenges list and points history on the Leaderboard tab
- [ ] Admin login/logout with cookie session
- [ ] Admin: schedule CRUD, challenge CRUD, award/deduct points with reason

### M3 — Postgres + polling
- [ ] `db/schema.sql`, `npm run db:setup`, optional seed script
- [ ] Postgres `Store` implementation
- [ ] SWR polling + optimistic updates everywhere; demo-mode banner
- [ ] Test against a real Neon database via `vercel env pull` (needs Rahul's setup)

### M4 — Photo Feed + Vercel Blob
- [ ] `handleUpload` route with type/size checks
- [ ] Composer (photo/video + caption, progress bar), feed newest-first with uploader and time
- [ ] Delete own post; admin delete any (also removes the blob)
- [ ] "Open shared Google Photos album" button
- [ ] Move avatars to Blob

### M5 — Polish, install, deploy
- [ ] Visual pass (type, colour, motion, empty/loading/error states)
- [ ] `manifest.ts`, icons, apple-touch-icon, theme-color, standalone display
- [ ] Real schedule entered; test on an actual iPhone and Android phone
- [ ] Deploy checklist walked through with Rahul

## Open questions for Peter

1. **Dates, city and timezone** of the weekend? Needed for the day picker and the "current/next" logic (events render in the party's timezone, not the phone's).
2. **Units**: I'm assuming feet/inches and pounds for input (stored metric). OK?
3. **Sex field**: male/female only (what the formula needs), or add a "prefer not to say" that uses the average of the two constants?
4. **Lost profile**: if someone clears their browser or switches phones they'd make a new profile. Good enough, or should Admin be able to delete/merge stale profiles?
5. **Upload caps** of 10 MB photos / 100 MB videos — fine? Vercel Blob quota depends on Rahul's plan; a weekend of phone videos can add up, which is another reason to steer bulk uploads to the Google Photos album.
6. **Admin tab visibility**: visible to everyone in the nav with a password gate (as specified), or hidden behind a long-press / `/admin` URL so the nav has four tabs for normal guests?
