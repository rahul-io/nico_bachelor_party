// End-to-end checks for badges, photo tags and profile pages (M13), with
// separate cookie jars standing in for separate phones.
//
//   1. npm run dev:mock        (in-memory data, invite code "ahoy", admin password "admin")
//   2. npm run test:e2e:badges
//
// Achievements lock in at the 4am cutoff, which depends on the clock, so that
// is covered by the unit tests in src/lib/badges. Run against a fresh dev:mock
// server only, and never against the live site.
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
      const type = response.headers.get("content-type") ?? "";
      return { status: response.status, type, data: type.includes("json") ? await response.json().catch(() => null) : null };
    },
  };
}

const suffix = Math.random().toString(36).slice(2, 8);
const beer = { name: "Pacifico", volumeOz: 12, abv: 0.045, category: "beer" };
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const phones = [];
for (let i = 0; i < 3; i++) {
  const phone = jar();
  await phone.call("POST", "/api/gate", { code: "ahoy" });
  const name = `Bosun ${i + 1} ${suffix}`;
  const signup = await phone.call("POST", "/api/auth/signup", {
    name, heightCm: 180, weightKg: 80, sex: "male", avatarUrl: null, showBacOnPosts: true, password: "rum-and-coke",
  });
  phones.push({ ...phone, name, id: signup.data?.profile?.id ?? signup.data?.id });
}
const [a, b, c] = phones;
check("three accounts created", phones.every((phone) => phone.id));

const admin = jar();
await admin.call("POST", "/api/gate", { code: "ahoy" });
await admin.call("POST", "/api/admin/login", { password: "admin" });
for (const profile of (await admin.call("GET", "/api/admin/profiles")).data ?? []) {
  if (profile.name.endsWith("(demo)")) await admin.call("DELETE", `/api/admin/profiles/${profile.id}`);
}
// No slot machine or Cheers, so points here are drinks and badges only.
await admin.call("PUT", "/api/admin/points/settings", { slotEveryDrinks: 20, cheersMinPeople: 30 });
const adminBadges = async () => (await admin.call("GET", "/api/admin/badges")).data;
const adminDo = (body) => admin.call("POST", "/api/admin/badges", body);
const page = async (viewer, person) => (await viewer.call("GET", `/api/people/${person.id}`)).data;
const names = (list) => list.map((badge) => badge.name);

// ---- The initial set
const initial = await adminBadges();
check("sixty badges are seeded", initial?.badges?.length === 60, String(initial?.badges?.length));
check("guests can't open Admin > Badges", (await a.call("GET", "/api/admin/badges")).status === 401);
check("or change one", (await a.call("POST", "/api/admin/badges", { action: "recalculate", badgeId: initial.badges[0].id })).status === 401);
const byName = (name) => initial.badges.find((badge) => badge.name === name);
// Only these are left on: the rest depend on the time of day or on chance (two phones logging in the same minute),
// and are covered by the unit tests.
const KEEP = [
  "Designated Driver", "Hydro Hero", "Perez Hilton", "Paparazzi", "Lightweight", "Sleeping Beauty", "Take the Wheel Cap'n",
  "Triple Kill", "Quadkill", "Pentakill", "Sophisticated Gentleman", "Second Wind",
  "Groundhog Day", "Mad Scientist", "Reply Guy", "Flamer", "Fireman",
];
for (const badge of initial.badges) {
  if (!KEEP.includes(badge.name)) await adminDo({ action: "save", id: badge.id, badge: { ...badge, active: false } });
}
check("rules come with a plain-English preview", byName("Triple Kill")?.condition === "Log 3 drinks within a rolling hour.", byName("Triple Kill")?.condition);
check("coded ones say what they need", byName("Lightweight")?.source === "coded" && /fewest drinks/.test(byName("Lightweight")?.condition ?? ""));
check("crests are served as public files", (await jar().call("GET", "/brand/badges/pentakill.webp")).status === 200);

// ---- Profile pages
const fresh = await page(b, a);
check("anyone can open anyone's profile", fresh?.person?.name === a.name && fresh.total === 0);
check("with every active badge still to earn", fresh?.trophies?.earned.length === 0 && fresh.trophies.locked.length === KEEP.length);
check("and no body metrics", !("heightCm" in (fresh?.person ?? {})) && !("weightKg" in (fresh?.person ?? {})) && !("sex" in (fresh?.person ?? {})));
check("an unknown person is a 404", (await b.call("GET", "/api/people/nobody")).status === 404);

// ---- Merit badges from the log
const drinks = [];
for (let i = 0; i < 3; i++) drinks.push((await a.call("POST", "/api/drinks", beer)).data);
let mine = await page(a, a);
check("three drinks in an hour is a Triple Kill", names(mine.trophies.earned).includes("Triple Kill"), JSON.stringify(names(mine.trophies.earned)));
check("worth 2 points, under Badges in points by source", mine.bySource.find((item) => item.source === "badge")?.points === 2, JSON.stringify(mine.bySource));
const me = (await a.call("GET", "/api/games/me")).data;
check("it queues a full-screen pop", me?.pops?.length === 1 && me.pops[0].name === "Triple Kill" && me.pops[0].imageUrl === "/brand/badges/triple-kill.webp", JSON.stringify(me?.pops));
check("someone else can't dismiss it", (await b.call("POST", "/api/badges/seen", { awardId: me.pops[0].awardId })).status === 200 && (await a.call("GET", "/api/games/me")).data.pops.length === 1);
await a.call("POST", "/api/badges/seen", { awardId: me.pops[0].awardId });
check("the earner can", (await a.call("GET", "/api/games/me")).data.pops.length === 0);
const lines = async () => (await a.call("GET", "/api/posts")).data.lines.map((line) => line.text);
check("and it is announced in the Captain's Log", (await lines()).includes(`${a.name} earned TRIPLE KILL`));

await a.call("POST", "/api/drinks", beer);
await a.call("POST", "/api/drinks", beer);
mine = await page(a, a);
check(
  "five in the hour adds Quadkill and Pentakill, and 0.08% adds Take the Wheel Cap'n",
  ["Triple Kill", "Quadkill", "Pentakill", "Take the Wheel Cap'n"].every((name) => names(mine.trophies.earned).includes(name)),
  JSON.stringify(names(mine.trophies.earned)),
);
check("being first to 0.08% leads Designated Driver for today", names(mine.trophies.leading).includes("Designated Driver"), JSON.stringify(names(mine.trophies.leading)));
check("which is announced once", (await lines()).filter((line) => line.includes("DESIGNATED DRIVER")).length === 1);

await a.call("DELETE", `/api/drinks/${drinks[0].id}`);
mine = await page(a, a);
check("deleting a drink takes back the badges resting on it", !names(mine.trophies.earned).includes("Triple Kill") && !names(mine.trophies.earned).includes("Pentakill"), JSON.stringify(names(mine.trophies.earned)));

await b.call("POST", "/api/drinks", { name: "Mai Tai", volumeOz: 6, abv: 0.2, category: "cocktail" });
check("a fruity cocktail makes a Sophisticated Gentleman", names((await page(a, b)).trophies.earned).includes("Sophisticated Gentleman"));

// ---- Admin: edit, rule builder, manual award, recalculate
const triple = byName("Triple Kill");
await adminDo({ action: "save", id: triple.id, badge: { ...triple, active: false } });
await c.call("POST", "/api/drinks", beer);
await c.call("POST", "/api/drinks", beer);
await c.call("POST", "/api/drinks", beer);
check("a badge switched off isn't earned", !names((await page(a, c)).trophies.earned).includes("Triple Kill"));

check("an incomplete rule is refused", (await adminDo({ action: "save", badge: { name: "Bad", points: 1, rule: { type: "count", what: { kind: "drink" }, n: 0, window: "hour" } } })).status === 400);
const camel = await adminDo({
  action: "save",
  badge: { name: "Camel", description: "", emoji: "🐪", points: 3, active: true, hidden: false, rule: { type: "count", what: { kind: "water" }, n: 2, window: "day" } },
});
check("a rule badge is built with no code", camel.status === 200 && camel.data?.source === "rule" && camel.data?.kind === "merit", JSON.stringify(camel.data));
await c.call("POST", "/api/waters");
await c.call("POST", "/api/waters");
check("and starts working straight away", names((await page(a, c)).trophies.earned).includes("Camel"));

const upload = await adminDo({ action: "image", dataUrl: pixel });
check("an uploaded image gets its own URL", /^\/api\/badges\/image\//.test(upload.data?.imageUrl ?? ""), JSON.stringify(upload.data));
const served = await a.call("GET", upload.data.imageUrl);
check("which serves the picture", served.status === 200 && served.type === "image/png", `${served.status} ${served.type}`);
check("a non-image is refused", (await adminDo({ action: "image", dataUrl: "data:text/html;base64,AAAA" })).status === 400);

const secret = await adminDo({
  action: "save",
  badge: { name: "Best Dressed", description: "Voted at dinner.", emoji: "🎩", imageUrl: upload.data.imageUrl, kind: "achievement", points: 4, active: true, hidden: true },
});
check("a manual badge can be hidden until earned", (await page(a, b)).trophies.locked.some((badge) => badge.id === secret.data.id && badge.name === "???"));
await adminDo({ action: "award", badgeId: secret.data.id, profileId: b.id, reason: "Captain's hat and a blazer" });
const dressed = await page(a, b);
check("awarding by hand shows on the profile", dressed.trophies.earned.some((badge) => badge.name === "Best Dressed" && badge.imageUrl === upload.data.imageUrl));
check("with the reason in the points history", dressed.entries.some((entry) => entry.reason === "Badge · Best Dressed · Captain's hat and a blazer" && entry.delta === 4));
check("and is no longer a mystery to others", (await page(a, c)).trophies.locked.some((badge) => badge.name === "Best Dressed"));

const before = (await page(a, b)).total;
await adminDo({ action: "save", id: secret.data.id, badge: { ...secret.data, points: 9 } });
check("a points change leaves past awards alone", (await page(a, b)).total === before);
check("until Recalculate all", (await adminDo({ action: "recalculate", badgeId: secret.data.id })).data?.changed === 1 && (await page(a, b)).total === before + 5);
const holder = (await adminBadges()).badges.find((badge) => badge.id === secret.data.id).holders[0];
await adminDo({ action: "revoke", awardId: holder.awardId });
const revoked = await page(a, b);
check("revoking takes the badge and its points back", !names(revoked.trophies.earned).includes("Best Dressed") && revoked.total === before - 4, `${revoked.total} vs ${before - 4}`);

// ---- The second batch: detector badges, new achievements, hand-awarded ones with negative points
const lockedBefore = names((await page(b, c)).trophies.locked);
check("obscure badges are a mystery until earned", lockedBefore.includes("???") && !lockedBefore.includes("Mad Scientist"), JSON.stringify(lockedBefore));
const strong = await c.call("POST", "/api/drinks", { name: "Jungle Juice", volumeOz: 2, abv: 0.6 });
check("a custom drink over 50% makes a Mad Scientist", strong.status === 201 && names((await page(a, c)).trophies.earned).includes("Mad Scientist"));
check("which stops being a mystery", (await page(a, b)).trophies.locked.some((badge) => badge.name === "Mad Scientist"));
check("a catalogue drink at any strength doesn't", !names((await page(a, b)).trophies.earned).includes("Mad Scientist"));
check("five of the same in a row was a Groundhog Day", (await lines()).includes(`${a.name} earned GROUNDHOG DAY`));

const flamer = byName("Flamer");
const beforeFire = (await page(a, a)).total;
await adminDo({ action: "award", badgeId: flamer.id, profileId: a.id, reason: "The grill" });
await adminDo({ action: "award", badgeId: flamer.id, profileId: a.id, reason: "The toaster" });
await adminDo({ action: "award", badgeId: byName("Fireman").id, profileId: a.id, reason: "" });
const burned = await page(b, a);
check("a hand-awarded badge can be given twice and shows a count", burned.trophies.earned.find((badge) => badge.name === "Flamer")?.count === 2, JSON.stringify(burned.trophies.earned.map((badge) => [badge.name, badge.count])));
check("negative points come off the total", Math.round((burned.total - beforeFire) * 10) / 10 === -15, `${burned.total} vs ${beforeFire}`);
check("each one is in the points history", burned.entries.filter((entry) => entry.reason?.startsWith("Badge · Flamer") && entry.delta === -15).length === 2);

// ---- Photo tags and Sleeping Beauty
const posted = await a.call("POST", "/api/posts", { url: pixel, caption: "Out cold", taggedIds: [b.id, c.id, "nobody", b.id], asleep: true });
const feedPost = async () => (await c.call("GET", "/api/posts")).data.posts.find((post) => post.id === posted.data.id);
check("a photo can tag people and be marked asleep", (await feedPost())?.asleep === true && (await feedPost()).tagged.map((person) => person.name).join() === [b.name, c.name].join(), JSON.stringify((await feedPost())?.tagged));
check("a bystander can't change the tags", (await jar().call("PUT", `/api/posts/${posted.data.id}/tags`, { taggedIds: [] })).status === 401);
check("a tagged person can't add anyone", (await c.call("PUT", `/api/posts/${posted.data.id}/tags`, { taggedIds: [a.id, b.id] })).status === 403);
check("but can remove themselves", (await c.call("PUT", `/api/posts/${posted.data.id}/tags`, { taggedIds: [b.id] })).status === 200 && (await feedPost()).tagged.length === 1);
check("and the poster can tag them back", (await a.call("PUT", `/api/posts/${posted.data.id}/tags`, { taggedIds: [b.id, c.id] })).status === 200 && (await feedPost()).tagged.length === 2);
const leading = names((await page(b, a)).trophies.leading);
check("tagging someone else leads Paparazzi and Perez Hilton", ["Paparazzi", "Perez Hilton"].every((name) => leading.includes(name)), JSON.stringify(leading));
await b.call("POST", `/api/posts/${posted.data.id}/comments`, { body: "Out like a light" });
check("the only commenter leads Reply Guy", names((await page(a, b)).trophies.leading).includes("Reply Guy"), JSON.stringify(names((await page(a, b)).trophies.leading)));

const queue = (await adminBadges()).sleeping[0];
check("Admin sees the asleep photo waiting", queue?.postId === posted.data.id && queue.sleepers.length === 2 && queue.confirmed === false, JSON.stringify(queue));
check("guests can't confirm it", (await a.call("POST", "/api/admin/badges", { action: "confirmSleeping", day: queue.day })).status === 401);
check("confirming awards everyone tagged", (await adminDo({ action: "confirmSleeping", day: queue.day })).data?.given === 2);
check("only once", (await adminDo({ action: "confirmSleeping", day: queue.day })).data?.given === 0);
const sleepers = await Promise.all([b, c].map(async (phone) => names((await page(a, phone)).trophies.earned)));
check("both sleepers have the badge", sleepers.every((earned) => earned.includes("Sleeping Beauty")), JSON.stringify(sleepers));
// c: Camel 3, Mad Scientist 2, and the strong drink also made it four in the hour (Quadkill 2) and 0.08% (Take the Wheel Cap'n 2).
check("worth 10", (await page(a, c)).bySource.find((item) => item.source === "badge")?.points === 19, JSON.stringify((await page(a, c)).bySource));
await a.call("POST", "/api/posts", { url: pixel, caption: "Later" });
const feed = (await c.call("GET", "/api/posts")).data.posts;
check("and the photo is pinned to the top of the feed", feed[0].id === posted.data.id && !!feed[0].pinnedUntil, feed.map((post) => post.caption).join());

await admin.call("DELETE", "/api/admin/points/settings");
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
