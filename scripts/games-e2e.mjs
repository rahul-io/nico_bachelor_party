// End-to-end checks for the games (M12): slot machine, Bartender's Choice,
// Groom Tax, curses, wagers with side bets, the Snitch Line and notices,
// with separate cookie jars standing in for separate phones.
//
//   1. npm run dev:mock        (in-memory data, invite code "ahoy", admin password "admin")
//   2. npm run test:e2e:games
//
// Run it against a fresh dev:mock server only. Never point it at the live
// site: it changes the points settings and sets the groom.
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
      return { status: response.status, data: await response.json().catch(() => null) };
    },
  };
}

const suffix = Math.random().toString(36).slice(2, 8);
const beer = { name: "Pacifico", volumeOz: 12, abv: 0.045, category: "beer" };
const std = (12 * 29.5735 * 0.045 * 0.789) / 14;
const round = (points) => Math.round(points * 10) / 10;
const drinkPoints = round(std * 3);
// A 1×1 PNG: mock mode takes small inline images.
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const odds = (winner) => ({
  slotOdds1x: 0, slotOdds2x: 0, slotOdds3x: 0, slotOddsBust: 0, slotOddsJackpot: 0, slotOddsRob: 0, slotOddsForward: 0,
  [winner]: 100,
  // The default is a spin every third drink; here every drink spins.
  slotEveryDrinks: 1,
  // Cheers off, so drink sums are exact.
  cheersMinPeople: 30,
});

const phones = [];
for (let i = 0; i < 5; i++) {
  const phone = jar();
  await phone.call("POST", "/api/gate", { code: "ahoy" });
  const name = `Mate ${i + 1} ${suffix}`;
  const signup = await phone.call("POST", "/api/auth/signup", {
    name, heightCm: 180, weightKg: 80, sex: "male", avatarUrl: null, showBacOnPosts: true, password: "rum-and-coke",
  });
  phones.push({ ...phone, name, id: signup.data?.profile?.id ?? signup.data?.id });
}
const [a, b, c, d, e] = phones;
check("five accounts created", phones.every((phone) => phone.id));

const admin = jar();
await admin.call("POST", "/api/gate", { code: "ahoy" });
await admin.call("POST", "/api/admin/login", { password: "admin" });

// Badges (M13) add points of their own; switched off so the sums here stay exact.
for (const badge of (await admin.call("GET", "/api/admin/badges")).data?.badges ?? []) {
  await admin.call("POST", "/api/admin/badges", { action: "save", id: badge.id, badge: { ...badge, active: false } });
}
// The mock store's demo guests have points and recent drinks, which would make them the leader and active players.
for (const profile of (await admin.call("GET", "/api/admin/profiles")).data ?? []) {
  if (profile.name.endsWith("(demo)")) await admin.call("DELETE", `/api/admin/profiles/${profile.id}`);
}
const setOdds = (winner) => admin.call("PUT", "/api/admin/points/settings", odds(winner));
const adminDo = (body) => admin.call("POST", "/api/admin/games", body);
const me = async (phone) => (await phone.call("GET", "/api/games/me")).data;
const board = async (phone) => (await phone.call("GET", "/api/games")).data;
const give = (phone, delta) => admin.call("POST", "/api/admin/points", { profileId: phone.id, delta, reason: "Test float", challengeId: null });
const post = (phone, extra = {}) => phone.call("POST", "/api/posts", { url: pixel, caption: "", ...extra });
const lines = async () => (await a.call("GET", "/api/posts")).data.lines.map((line) => line.text);

check("guests can't use the admin games route", (await a.call("POST", "/api/admin/games", { action: "bartender" })).status === 401);
check("odds that don't total 100 are refused", (await admin.call("PUT", "/api/admin/points/settings", { slotOdds1x: 50 })).status === 400);

// ---- Slot machine
await setOdds("slotOdds3x");
const triple = (await a.call("POST", "/api/drinks", beer)).data;
check("3× triples the drink and says so", triple.points === round(std * 9) && triple.slot?.outcome === "3x" && /slot 3×/.test(triple.pointsLine), JSON.stringify(triple));

await setOdds("slotOddsJackpot");
const jackpot = (await a.call("POST", "/api/drinks", beer)).data;
check("Jackpot pays +15 on top", (await me(a)).balance === round(round(std * 9) + drinkPoints + 15), String((await me(a)).balance));
check("and is announced in the Captain's Log", (await lines()).includes(`${a.name} hit JACKPOT`));
await a.call("DELETE", `/api/drinks/${jackpot.id}`);
check("deleting the drink takes the Jackpot back", (await me(a)).balance === round(std * 9), String((await me(a)).balance));

await setOdds("slotOdds1x");
const again = (await a.call("POST", "/api/drinks", beer)).data;
check("logging again reuses the Jackpot rather than spinning", again.slot?.outcome === "jackpot", JSON.stringify(again.slot));

await setOdds("slotOddsRob");
const aBefore = (await me(a)).balance;
const robber = (await b.call("POST", "/api/drinks", beer)).data;
check("Rob the Leader moves 5 from first place", robber.slot?.outcome === "rob" && (await me(b)).balance === round(drinkPoints + 5) && (await me(a)).balance === round(aBefore - 5));
check("the leader is told", (await me(a)).notices.some((notice) => /Rob the Leader/.test(notice.text)));

await setOdds("slotOddsForward");
const before = await Promise.all([a, b].map(async (phone) => (await me(phone)).balance));
const giver = (await c.call("POST", "/api/drinks", beer)).data;
const after = await Promise.all([a, b].map(async (phone) => (await me(phone)).balance));
check(
  "Pay It Forward gives the drink's points to another player",
  giver.points === 0 && /paid forward to/.test(giver.pointsLine) && round(after[0] + after[1] - before[0] - before[1]) === drinkPoints,
  JSON.stringify({ giver, before, after }),
);
await setOdds("slotOdds1x");

// ---- Bartender's Choice
const poured = await adminDo({ action: "bartender" });
check("a round is poured for everyone who has logged", poured.data?.assigned === 3, JSON.stringify(poured.data));
const order = (await me(b)).bartender;
check("the order shows with its multiplier", order?.multiplier === 3 && !!order?.name, JSON.stringify(order));
check("someone who hasn't logged gets none", (await me(e)).bartender === null);
const ordered = (await b.call("POST", "/api/drinks", { name: order.name, volumeOz: order.volumeOz, abv: order.abv, category: order.category })).data;
check("logging it scores 3×", /× 3 Bartender's Choice/.test(ordered.pointsLine), ordered.pointsLine);
check("and uses the order up", (await me(b)).bartender === null);

// ---- Groom Tax
check("Groom Tax needs a groom", /No groom/.test((await post(d, { groomTaxPlayerId: d.id })).data?.groomTax ?? ""));
await adminDo({ action: "setGroom", profileId: e.id });
check("the groom is known to every phone", (await me(a)).groomId === e.id);
await e.call("POST", "/api/drinks", beer);
await d.call("POST", "/api/drinks", beer);
check("a third person can't claim it", /Only the groom or the player/.test((await post(a, { groomTaxPlayerId: d.id })).data?.groomTax ?? ""));
const taxed = await post(d, { groomTaxPlayerId: d.id });
check("the player's photo claims it", taxed.status === 201 && taxed.data?.groomTax === "Groom Tax paid.", JSON.stringify(taxed.data?.groomTax));
check("the drink is doubled and the groom gets +1", (await me(d)).balance === round(drinkPoints * 2) && (await me(e)).balance === round(drinkPoints + 1));
check("the same drink can't be taxed twice", /No Groom Tax/.test((await post(e, { groomTaxPlayerId: d.id })).data?.groomTax ?? ""));
const taxes = (await admin.call("GET", "/api/admin/games")).data?.groomTaxes;
await adminDo({ action: "voidGroomTax", id: taxes?.[0]?.id });
check("an admin can void it", (await me(d)).balance === drinkPoints && (await me(e)).balance === drinkPoints);

// ---- Curses
for (const phone of phones) await give(phone, 40);
const start = Object.fromEntries(await Promise.all(phones.map(async (phone) => [phone.id, (await me(phone)).balance])));
check("the board lists prices", (await board(a)).prices?.name === 10 && (await board(a)).prices?.shield === 5);
check("you can't curse yourself", (await a.call("POST", "/api/games/curses", { type: "deadweight", targetId: a.id })).status === 400);

await a.call("POST", "/api/games/curses", { type: "name", targetId: b.id, value: "Bilge Rat" });
const shown = (await c.call("GET", "/api/leaderboard")).data.find((entry) => entry.id === b.id);
check("Name Hijack changes the name everyone sees", shown?.name === "Bilge Rat", shown?.name);
check("and costs 10", (await me(a)).balance === round(start[a.id] - 10));
check("the target is told who", (await me(b)).notices.some((notice) => notice.text === `${a.name} cursed you: Name Hijack.`));
check("it shows in the wager picker too", (await board(c)).people.some((person) => person.name === "Bilge Rat"));
const curseId = (await board(c)).curses[0]?.id;
await adminDo({ action: "revertCurse", id: curseId });
check("an admin can lift it", (await c.call("GET", "/api/leaderboard")).data.find((entry) => entry.id === b.id)?.name === b.name);

const photoId = taxed.data.id;
await a.call("POST", "/api/games/curses", { type: "avatar", targetId: b.id, value: photoId });
check("Avatar Swap uses a photo from the log", (await c.call("GET", "/api/leaderboard")).data.find((entry) => entry.id === b.id)?.avatarUrl === pixel);

await a.call("POST", "/api/games/curses", { type: "deadweight", targetId: c.id });
const dead = (await c.call("POST", "/api/drinks", beer)).data;
check("Dead Weight zeroes the next drink, with no spin", dead.points === 0 && dead.slot === null && /Dead Weight/.test(dead.pointsLine), JSON.stringify(dead));
check("only the next one", (await c.call("POST", "/api/drinks", beer)).data.points === drinkPoints);

await d.call("POST", "/api/games/curses", { type: "shield" });
const blocked = await a.call("POST", "/api/games/curses", { type: "name", targetId: d.id, value: "Nope" });
check("a Shield blocks the next curse", blocked.data?.result === "blocked" && (await c.call("GET", "/api/leaderboard")).data.find((entry) => entry.id === d.id)?.name === d.name);
check("the curser still pays", (await me(a)).balance === round(start[a.id] - 10 - 6 - 8 - 10), String((await me(a)).balance));

// ---- Wagers
const held = Object.fromEntries(await Promise.all(phones.map(async (phone) => [phone.id, (await me(phone)).balance])));
check("a stake you can't cover is refused", (await a.call("POST", "/api/games/wagers", { opponentId: b.id, stake: 50, description: "Too rich" })).status === 400);
await a.call("POST", "/api/games/wagers", { opponentId: b.id, stake: 10, description: "Beer pong" });
check("one unanswered challenge per pair", (await a.call("POST", "/api/games/wagers", { opponentId: b.id, stake: 1, description: "More" })).status === 400);
const wager = (await board(c)).wagers.find((item) => item.description === "Beer pong");
check("the challenge is on the board", wager?.status === "pending" && wager.stake === 10);
const wrongAccept = await c.call("POST", `/api/games/wagers/${wager.id}`, { action: "accept" });
check("only the opponent can accept", wrongAccept.status === 403, JSON.stringify(wrongAccept));
check("no side bets before it is accepted", (await c.call("POST", `/api/games/wagers/${wager.id}`, { action: "bet", side: a.id, stake: 2 })).status === 400);
await b.call("POST", `/api/games/wagers/${wager.id}`, { action: "accept" });
check("stakes are held", (await me(a)).balance === round(held[a.id] - 10) && (await me(b)).balance === round(held[b.id] - 10));
check("players can't side bet", (await a.call("POST", `/api/games/wagers/${wager.id}`, { action: "bet", side: a.id, stake: 2 })).status === 400);
await c.call("POST", `/api/games/wagers/${wager.id}`, { action: "bet", side: a.id, stake: 10 });
await d.call("POST", `/api/games/wagers/${wager.id}`, { action: "bet", side: a.id, stake: 5 });
await e.call("POST", `/api/games/wagers/${wager.id}`, { action: "bet", side: b.id, stake: 6 });
await a.call("POST", `/api/games/wagers/${wager.id}`, { action: "report", winnerId: a.id });
check("side bets close at the first report", (await e.call("POST", `/api/games/wagers/${wager.id}`, { action: "bet", side: b.id, stake: 1 })).status === 400);
await b.call("POST", `/api/games/wagers/${wager.id}`, { action: "report", winnerId: a.id });
const paid = Object.fromEntries(await Promise.all(phones.map(async (phone) => [phone.id, round((await me(phone)).balance - held[phone.id])])));
check(
  "winner +10, loser −10, side pot split 14 / 7 between the backers",
  paid[a.id] === 10 && paid[b.id] === -10 && paid[c.id] === 4 && paid[d.id] === 2 && paid[e.id] === -6,
  JSON.stringify(Object.values(paid)),
);

await a.call("POST", "/api/games/wagers", { opponentId: b.id, stake: 5, description: "Rematch" });
const rematch = (await board(c)).wagers.find((item) => item.description === "Rematch");
await b.call("POST", `/api/games/wagers/${rematch.id}`, { action: "accept" });
await a.call("POST", `/api/games/wagers/${rematch.id}`, { action: "report", winnerId: a.id });
await b.call("POST", `/api/games/wagers/${rematch.id}`, { action: "report", winnerId: b.id });
check("a disagreement goes to Admin", (await board(c)).wagers.find((item) => item.id === rematch.id)?.status === "disputed");
await adminDo({ action: "voidWager", id: rematch.id });
check("calling it off refunds the stakes", round((await me(a)).balance - held[a.id]) === 10 && round((await me(b)).balance - held[b.id]) === -10);

// ---- Snitch Line
const snitchBefore = Object.fromEntries(await Promise.all([a, b].map(async (phone) => [phone.id, (await me(phone)).balance])));
check("a report needs a photo from the log", (await a.call("POST", "/api/games/snitches", { accusedId: b.id, reason: "x", postId: "nope" })).status === 400);
await a.call("POST", "/api/games/snitches", { accusedId: b.id, reason: "Poured one out", postId: photoId });
check("one open report at a time", (await a.call("POST", "/api/games/snitches", { accusedId: c.id, reason: "y", postId: photoId })).status === 400);
const filed = (await board(c)).reports[0];
check("the report is listed with its photo", filed?.reason === "Poured one out" && filed.photoUrl === pixel && filed.needed === 2);
check("the accused can't vote", (await b.call("POST", `/api/games/snitches/${filed.id}`)).status === 403);
check("nor can the reporter", (await a.call("POST", `/api/games/snitches/${filed.id}`)).status === 403);
await c.call("POST", `/api/games/snitches/${filed.id}`);
await c.call("POST", `/api/games/snitches/${filed.id}`);
check("one vote each", (await board(c)).reports[0]?.votes === 1 && (await board(c)).reports[0]?.voted === true);
await d.call("POST", `/api/games/snitches/${filed.id}`);
check(
  "two votes: accused −5, reporter +3",
  round((await me(b)).balance - snitchBefore[b.id]) === -5 && round((await me(a)).balance - snitchBefore[a.id]) === 3,
);
check("and the report closes", (await board(c)).reports.length === 0);

// ---- Notices and the ledger
const unread = (await me(b)).notices.filter((notice) => !notice.seen).length;
check("notices pile up unread", unread >= 4, String(unread));
await b.call("POST", "/api/games/me");
check("and can be marked read", (await me(b)).notices.every((notice) => notice.seen));
const sources = (await c.call("GET", `/api/points?profile=${a.id}`)).data?.bySource.map((item) => item.source);
check("points by source includes the games", ["slot", "wager", "curse", "snitch"].every((source) => sources.includes(source)), JSON.stringify(sources));
const feed = await lines();
check(
  "the Captain's Log tells the story",
  [/hit JACKPOT/, /Bartender's Choice/, /Groom Tax/, /put a Name Hijack on/, /riding on: Beer pong/, /won 10 off/, /was snitched on/].every((pattern) => feed.some((line) => pattern.test(line))),
  JSON.stringify(feed),
);

await admin.call("DELETE", "/api/admin/points/settings");
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
