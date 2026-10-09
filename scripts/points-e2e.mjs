// End-to-end checks for drink points, water, multipliers, Cheers and reversal,
// with separate cookie jars standing in for separate phones.
//
//   1. npm run dev:mock        (in-memory data, invite code "ahoy", admin password "admin")
//   2. npm run test:e2e:points
//
// Hour and day settlement depend on the clock, so they are covered by the unit
// tests in src/lib/points; here "Settle now" is only checked for being safe to repeat.
// Run it against a fresh dev:mock server only: a Cheers left open by an earlier
// run would be joined by this one. Never point it at the live site: it changes
// the points settings.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE}: local servers only.`);
  process.exit(1);
}

let failures = 0;
function check(label, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  ${detail}`}`);
}

/** A browser's worth of cookies. */
function jar() {
  const cookies = new Map();
  return {
    async call(method, path, body) {
      const response = await fetch(BASE + path, {
        method,
        redirect: "manual",
        headers: {
          ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const line of response.headers.getSetCookie()) {
        const [pair] = line.split(";");
        const split = pair.indexOf("=");
        cookies.set(pair.slice(0, split), pair.slice(split + 1));
      }
      return { status: response.status, data: await response.json().catch(() => null) };
    },
  };
}

const suffix = Math.random().toString(36).slice(2, 8);
const beer = { name: "Pacifico", volumeOz: 12, abv: 0.045, category: "beer" };
const std = (12 * 29.5735 * 0.045 * 0.789) / 14;
const round = (points) => Math.round(points * 10) / 10;
// The slot machine (M12) spins on every drink; pin it to 1× so the sums here are exact.
const noSlot = { slotOdds1x: 100, slotOdds2x: 0, slotOdds3x: 0, slotOddsBust: 0, slotOddsJackpot: 0, slotOddsRob: 0, slotOddsForward: 0 };

// ---- Five phones and an admin
const phones = [];
for (let i = 0; i < 5; i++) {
  const phone = jar();
  await phone.call("POST", "/api/gate", { code: "ahoy" });
  const name = `Deckhand ${i + 1} ${suffix}`;
  const signup = await phone.call("POST", "/api/auth/signup", {
    name,
    heightCm: 180,
    weightKg: 80,
    sex: "male",
    avatarUrl: null,
    showBacOnPosts: true,
    password: "rum-and-coke",
  });
  phones.push({ ...phone, name, id: signup.data?.profile?.id ?? signup.data?.id });
}
check("five accounts created", phones.every((phone) => phone.id), JSON.stringify(phones.map((p) => p.id)));
const [a, b, c, d, e] = phones;

const admin = jar();
await admin.call("POST", "/api/gate", { code: "ahoy" });
check("admin login", (await admin.call("POST", "/api/admin/login", { password: "admin" })).status === 200);

// Badges (M13) add points of their own; switched off so the sums here stay exact.
for (const badge of (await admin.call("GET", "/api/admin/badges")).data?.badges ?? []) {
  await admin.call("POST", "/api/admin/badges", { action: "save", id: badge.id, badge: { ...badge, active: false } });
}

const pointsOf = async (phone) =>
  (await phone.call("GET", "/api/leaderboard")).data.find((entry) => entry.id === phone.id)?.points;

// ---- Settings
check("guests can read the rules", (await a.call("GET", "/api/points/settings")).data?.paceCap === 10);
check("guests can't edit them", (await a.call("PUT", "/api/admin/points/settings", { paceCap: 2 })).status === 401);
check("guests can't start a Happy Hour", (await a.call("POST", "/api/admin/points/happy-hour", {})).status === 401);
check("out-of-range setting is refused", (await admin.call("PUT", "/api/admin/points/settings", { ...noSlot, paceCap: 0 })).status === 400);
await admin.call("PUT", "/api/admin/points/settings", noSlot);
await admin.call("DELETE", "/api/admin/points/happy-hour");
// Cheers off for the first half, so each drink's own points can be checked exactly.
const edited = await admin.call("PUT", "/api/admin/points/settings", { ...noSlot, paceCap: 2.5, cheersMinPeople: 30 });
check("admin edits settings", edited.status === 200 && edited.data?.paceCap === 2.5 && edited.data?.pointsPerDrink === 3);

// ---- Base rate, water, hydration, pace cap
const first = await a.call("POST", "/api/drinks", beer);
check("a drink scores 3 per standard drink", first.status === 201 && first.data?.points === round(std * 3), JSON.stringify(first.data));
check("and shows its working", /std × 3 = /.test(first.data?.pointsLine ?? ""), first.data?.pointsLine);

const waters = [];
for (let i = 0; i < 3; i++) waters.push((await a.call("POST", "/api/waters")).data);
check("two waters an hour score, the third does not", waters.map((w) => w.points).join() === "1,1,0", JSON.stringify(waters));

const boosted = await a.call("POST", "/api/drinks", beer);
check("the drink after a water is 1.5×", boosted.data?.points === round(std * 3 * 1.5), JSON.stringify(boosted.data));
check("the working names the boost", /× 1\.5 hydration/.test(boosted.data?.pointsLine ?? ""), boosted.data?.pointsLine);

const third = await a.call("POST", "/api/drinks", beer);
const room = 2.5 - 2 * std;
check("the pace cap gives partial credit", third.data?.points === round(room * 3), JSON.stringify(third.data));
check("and says so", /under the pace cap/.test(third.data?.pointsLine ?? ""), third.data?.pointsLine);
const fourth = await a.call("POST", "/api/drinks", beer);
check("past the cap a drink logs for 0", fourth.status === 201 && fourth.data?.points === 0);

const expected = round(round(std * 3) + 2 + round(std * 3 * 1.5) + round(room * 3));
check("the leaderboard total is the sum", (await pointsOf(a)) === expected, `${await pointsOf(a)} vs ${expected}`);

// ---- Happy Hour and Drink of the Day
const today = (await a.call("GET", "/api/schedule")).status === 200 && ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
check("guests can't set the Drink of the Day", (await a.call("PUT", "/api/admin/points/drink-of-day", { day: today[0], type: "category", value: "beer" })).status === 401);
check("a day outside the party is refused", (await admin.call("PUT", "/api/admin/points/drink-of-day", { day: "2027-01-01", type: "category", value: "beer" })).status === 400);
for (const day of today) await admin.call("PUT", "/api/admin/points/drink-of-day", { day, type: "category", value: "beer" });
check("Happy Hour starts", (await admin.call("POST", "/api/admin/points/happy-hour", { minutes: 15 })).status === 201);

const status = (await b.call("GET", "/api/points/status")).data;
check("every phone sees the Happy Hour", status?.happyHour?.multiplier === 2, JSON.stringify(status?.happyHour));
const partyIsOn = status?.drinkOfDay !== null;
const stacked = await b.call("POST", "/api/drinks", beer);
check(
  partyIsOn ? "Happy Hour × Drink of the Day is 4×" : "Happy Hour alone is 2× (today is outside the party dates)",
  stacked.data?.points === round(std * 3 * (partyIsOn ? 4 : 2)),
  JSON.stringify(stacked.data),
);

await admin.call("PUT", "/api/admin/points/settings", { ...noSlot, paceCap: 2.5, cheersMinPeople: 30, maxMultiplier: 1.5 });
await b.call("POST", "/api/waters");
const capped = await b.call("POST", "/api/drinks", beer);
check("the maximum multiplier holds", capped.data?.points === round(Math.min(std, 2.5 - std) * 3 * 1.5), JSON.stringify(capped.data));
check("and the working says so", /\(max 1\.5×\)/.test(capped.data?.pointsLine ?? ""), capped.data?.pointsLine);

check("Happy Hour stops", (await admin.call("DELETE", "/api/admin/points/happy-hour")).status === 200);
check("and the banner goes", (await b.call("GET", "/api/points/status")).data?.happyHour === null);
for (const day of today) await admin.call("PUT", "/api/admin/points/drink-of-day", { day, type: "category", value: "" });

// ---- Cheers and reversal
// a and b logged moments ago, so they count towards the round: five people are needed here.
await admin.call("PUT", "/api/admin/points/settings", { ...noSlot, cheersMinPeople: 5 });
const before = await Promise.all([b, c, d, e].map(pointsOf));
const round1 = [];
for (const phone of [b, c, d]) round1.push((await phone.call("POST", "/api/drinks", beer)).data);
check("four people is not a Cheers yet", round1.every((drink) => !/Cheers/.test(drink.pointsLine ?? "")));
const fourthIn = (await e.call("POST", "/api/drinks", beer)).data;
check("the fifth makes it one", /Cheers \+3/.test(fourthIn.pointsLine ?? ""), fourthIn.pointsLine);
const after = await Promise.all([b, c, d, e].map(pointsOf));
check(
  "everyone who just logged got +3 on top of their drink",
  after.every((points, i) => round(points - before[i]) === round(round(std * 3) + 3)),
  JSON.stringify({ before, after }),
);
const dispatch = (await a.call("GET", "/api/points/status")).data?.dispatches?.[0];
check("it is announced once, naming everyone", dispatch?.text === "Cheers" && dispatch.profileName.split(", ").length === 5, JSON.stringify(dispatch));

check("deleting someone else's drink is refused", (await a.call("DELETE", `/api/drinks/${fourthIn.id}`)).status === 404);
check("deleting your own works", (await e.call("DELETE", `/api/drinks/${fourthIn.id}`)).status === 200);
const reversed = await Promise.all([b, c, d, e].map(pointsOf));
check(
  "the Cheers is taken back for everyone, and e's drink too",
  reversed.slice(0, 3).every((points, i) => round(after[i] - points) === 3) && reversed[3] === before[3],
  JSON.stringify({ after, reversed }),
);

const mine = (await a.call("GET", `/api/points?profile=${e.id}`)).data;
check("reversed entries stay in the history", mine?.entries?.filter((entry) => entry.voidedAt).length === 2, JSON.stringify(mine?.entries));
check("and count for nothing", mine?.bySource?.length === 0, JSON.stringify(mine?.bySource));

const bySource = (await b.call("GET", `/api/points?profile=${a.id}`)).data?.bySource;
check(
  "points by source",
  bySource?.find((item) => item.source === "water")?.points === 2 && bySource?.find((item) => item.source === "drink")?.points === round(expected - 2),
  JSON.stringify(bySource),
);

const water = (await a.call("GET", "/api/waters")).data;
check("waters are listed", water?.length === 3);
check("a was in the Cheers and lost it again", (await pointsOf(a)) === expected, String(await pointsOf(a)));
await a.call("DELETE", `/api/waters/${water.find((w) => w.points === 1).id}`);
check("deleting a water takes its point back", (await pointsOf(a)) === round(expected - 1), String(await pointsOf(a)));

// ---- Settle now
check("guests can't settle", (await a.call("POST", "/api/admin/points/settle")).status === 401);
const settle = await admin.call("POST", "/api/admin/points/settle");
check("Settle now runs", settle.status === 200 && Number.isInteger(settle.data?.paid), JSON.stringify(settle.data));
check("and pays nothing the second time", (await admin.call("POST", "/api/admin/points/settle")).data?.paid === 0);
check("Last Man Standing list loads", Array.isArray((await admin.call("GET", "/api/admin/points/last-man")).data));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
