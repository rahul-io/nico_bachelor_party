// End-to-end checks for the invite gate and accounts, with separate cookie jars
// standing in for separate browsers.
//
//   1. npm run dev:mock        (in-memory data, invite code "ahoy", admin password "admin")
//   2. npm run test:e2e
//
// Run it against a fresh dev:mock server only: it deliberately trips the rate
// limits, and those stay tripped for five minutes. Never point it at the live site.
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
    has: (name) => cookies.has(name),
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
        const name = pair.slice(0, split);
        const value = pair.slice(split + 1);
        if (value === "" || /max-age=0|expires=thu, 01 jan 1970/i.test(line)) cookies.delete(name);
        else cookies.set(name, value);
      }
      const data = await response.json().catch(() => null);
      return { status: response.status, data, location: response.headers.get("location") };
    },
  };
}

const person = (name) => ({ name, heightCm: 180, weightKg: 80, sex: "male", avatarUrl: null, showBacOnPosts: true });
const suffix = Math.random().toString(36).slice(2, 8);
const skipper = `Skipper ${suffix}`;
const bosun = `Bosun ${suffix}`;

// ---- 1. The gate can't be bypassed by calling the API directly
const stranger = jar();
for (const [method, path] of [
  ["GET", "/api/leaderboard"],
  ["GET", "/api/posts"],
  ["GET", "/api/schedule"],
  ["GET", "/api/auth/me"],
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/signup"],
  ["GET", "/api/admin/profiles"],
  ["POST", "/api/admin/login"],
  ["POST", "/api/blob/upload"],
  ["GET", "/api/drinks/search?q=rum"],
]) {
  const { status, data } = await stranger.call(method, path, method === "POST" ? {} : undefined);
  check(`no gate cookie: ${method} ${path} is 401`, status === 401 && data?.code === "gate", `got ${status}`);
}
for (const path of ["/schedule", "/tracker", "/leaderboard", "/photos", "/profile", "/admin", "/welcome"]) {
  const { status, location } = await stranger.call("GET", path);
  check(`no gate cookie: ${path} redirects to /gate`, status === 307 && location?.endsWith("/gate"), `got ${status} ${location}`);
}
// "/" is a plain redirect to /schedule (set in next.config), which is then gated like any page.
check("no gate cookie: / never serves the app", (await stranger.call("GET", "/")).status === 307);
check("the gate page itself is reachable", (await stranger.call("GET", "/gate")).status === 200);

// ---- 2. Invite code
check("wrong invite code is rejected", (await stranger.call("POST", "/api/gate", { code: "letmein" })).status === 401);
check("wrong code sets no cookie", !stranger.has("nbp_gate"));

const phoneA = jar();
const phoneB = jar();
const admin = jar();
check("right code is accepted, ignoring case and spaces", (await phoneA.call("POST", "/api/gate", { code: "  AHOY " })).status === 200);
await phoneB.call("POST", "/api/gate", { code: "ahoy" });
await admin.call("POST", "/api/gate", { code: "ahoy" });
check("past the gate, the API answers", (await phoneA.call("GET", "/api/leaderboard")).status === 200);
check("past the gate but signed out: me is null", (await phoneA.call("GET", "/api/auth/me")).data?.profile === null);
check("past the gate but signed out: can't log a drink", (await phoneA.call("POST", "/api/drinks", { name: "Beer", volumeOz: 12, abv: 0.05 })).status === 401);

// ---- 3. Create an account on phone A
check("short password is refused", (await phoneA.call("POST", "/api/auth/signup", { ...person(skipper), password: "12345" })).status === 400);
const signup = await phoneA.call("POST", "/api/auth/signup", { ...person(skipper), password: "rum-and-coke" });
check("signup creates the profile and signs in", signup.status === 201 && signup.data?.profile?.name === skipper, JSON.stringify(signup.data));
check("no password or hash in the response", !JSON.stringify(signup.data).match(/rum-and-coke|\$2[aby]\$/));
const profileId = signup.data?.profile?.id;
check("phone A is signed in", (await phoneA.call("GET", "/api/auth/me")).data?.profile?.id === profileId);
check("phone A can log a drink", (await phoneA.call("POST", "/api/drinks", { name: "Beer", volumeOz: 12, abv: 0.05 })).status === 201);
check("same name, different case, is taken", (await phoneB.call("POST", "/api/auth/signup", { ...person(skipper.toUpperCase()), password: "another-one" })).status === 409);

// ---- 4. Log in on a second phone restores the same profile
check("wrong password is rejected", (await phoneB.call("POST", "/api/auth/login", { name: skipper, password: "wrong-one" })).status === 401);
check("unknown name is rejected the same way", (await phoneB.call("POST", "/api/auth/login", { name: "Nobody Here", password: "wrong-one" })).status === 401);
const login = await phoneB.call("POST", "/api/auth/login", { name: skipper.toLowerCase(), password: "rum-and-coke" });
check("login on phone B gives the same profile", login.status === 200 && login.data?.profile?.id === profileId);
check("phone B sees the drink logged on phone A", (await phoneB.call("GET", "/api/drinks")).data?.length === 1);

// ---- 5. Log out on one phone doesn't affect the other
check("logout on phone A", (await phoneA.call("POST", "/api/auth/logout")).status === 200);
check("phone A is signed out", (await phoneA.call("GET", "/api/auth/me")).data?.profile === null);
check("phone A can no longer read its drinks", (await phoneA.call("GET", "/api/drinks")).status === 401);
check("phone B is still signed in", (await phoneB.call("GET", "/api/auth/me")).data?.profile?.id === profileId);

// ---- 6. Wrong passwords are rate-limited per name
await phoneA.call("POST", "/api/auth/signup", { ...person(bosun), password: "dark-and-stormy" });
await phoneA.call("POST", "/api/auth/logout");
let lastWrong = 0;
for (let i = 0; i < 10; i++) lastWrong = (await phoneA.call("POST", "/api/auth/login", { name: bosun, password: `guess-${i}` })).status;
check("ten wrong passwords are each rejected", lastWrong === 401, `last was ${lastWrong}`);
check("the eleventh try is locked out", (await phoneA.call("POST", "/api/auth/login", { name: bosun, password: "guess-10" })).status === 429);
check("even the right password is refused while locked", (await phoneA.call("POST", "/api/auth/login", { name: bosun, password: "dark-and-stormy" })).status === 429);
check("another name is unaffected", (await phoneA.call("POST", "/api/auth/login", { name: skipper, password: "rum-and-coke" })).status === 200);

// ---- 7. Admin reset logs the user out everywhere and forces a new password
check("admin login", (await admin.call("POST", "/api/admin/login", { password: "admin" })).status === 200);
check("reset needs the admin cookie", (await phoneB.call("POST", `/api/admin/profiles/${profileId}/password`)).status === 401);
const reset = await admin.call("POST", `/api/admin/profiles/${profileId}/password`);
const temporary = reset.data?.password;
check("admin reset returns a temporary password", reset.status === 200 && /^[a-z]+-\d{4}$/.test(temporary ?? ""), JSON.stringify(reset.data));
check("phone B was signed out by the reset", (await phoneB.call("GET", "/api/auth/me")).data?.profile === null);
check("phone A was signed out by the reset", (await phoneA.call("GET", "/api/auth/me")).data?.profile === null);
check("the old password no longer works", (await phoneB.call("POST", "/api/auth/login", { name: skipper, password: "rum-and-coke" })).status === 401);
const tempLogin = await phoneB.call("POST", "/api/auth/login", { name: skipper, password: temporary });
check("the temporary password logs in and demands a change", tempLogin.status === 200 && tempLogin.data?.profile?.mustChangePassword === true);
check("nothing else works until the password is changed", (await phoneB.call("GET", "/api/drinks")).status === 401);
const changed = await phoneB.call("POST", "/api/auth/password", { next: "painkiller-22" });
check("choosing a new password clears the flag", changed.status === 200 && changed.data?.profile?.mustChangePassword === false);
check("phone B works again", (await phoneB.call("GET", "/api/drinks")).status === 200);
check("the temporary password is dead", (await phoneA.call("POST", "/api/auth/login", { name: skipper, password: temporary })).status === 401);
check("the new password works on another phone", (await phoneA.call("POST", "/api/auth/login", { name: skipper, password: "painkiller-22" })).status === 200);
check("changing a password needs the current one", (await phoneA.call("POST", "/api/auth/password", { current: "nope", next: "mai-tai-1944" })).status === 401);

// ---- 8. Wrong invite codes are rate-limited (last: this locks the gate for this address)
// Earlier wrong codes from this address count too, so the lock arrives within twenty more tries.
let rejected = 0;
let locked = false;
for (let i = 0; i < 20 && !locked; i++) {
  const { status } = await stranger.call("POST", "/api/gate", { code: `guess-${i}` });
  if (status === 401) rejected++;
  locked = status === 429;
}
check("wrong codes are rejected one by one, then the gate locks", locked && rejected >= 1, `rejected ${rejected}, locked ${locked}`);
check("the lock holds", (await stranger.call("POST", "/api/gate", { code: "guess-again" })).status === 429);
check("locked even for the right code", (await stranger.call("POST", "/api/gate", { code: "ahoy" })).status === 429);
check("people already aboard are unaffected", (await phoneA.call("GET", "/api/leaderboard")).status === 200);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
