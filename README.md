# The Crider Cup

Mobile-first web app for Nico's bachelor party weekend: schedule, sobriety tracker, leaderboard, photo feed, admin.

```bash
npm install
npm run dev
```

Runs on mock data with no setup. Use `npm run dev:mock` to stay on mock data even when `.env.local` has live credentials; the invite code there is `ahoy` and the admin password is `admin`. Copy `.env.example` to `.env.local` to connect real services.

Photo uploads preserve the original file (up to 50 MB) and store a smaller JPEG preview for the feed when the browser can decode it. GIFs and unsupported formats use the original in the feed. Admin ZIP downloads and `npm run export-photos` fetch originals. Demo mode stores smaller inline images only. Previously compressed uploads cannot regain their original quality.

Before deploying the original-photo upload change to an existing database, run `npm run db:setup` to add the nullable `posts.preview_url` column. The schema update is idempotent and preserves existing posts.

See [plan.md](plan.md) for milestones and [CLAUDE.md](CLAUDE.md) for stack and conventions.

cheers!

cheers! again
