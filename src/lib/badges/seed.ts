import type { CodedKey, Rule } from "./rules";

/**
 * The initial set. Created in the database the first time badges are read;
 * after that Admin owns them (name, description, image, points, on/off), and
 * a badge deleted from here stays in the database. Rule-based wherever the
 * builder can express the condition, coded only where it can't.
 *
 * Artwork is Peter's, built from design/brand/badges by scripts/make-brand.mjs.
 * The badge's name is lettered on each crest.
 */

interface Seed {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  imageUrl: string | null;
  kind: "achievement" | "merit";
  source: "rule" | "coded" | "manual";
  rule: Rule | null;
  coded: CodedKey | null;
  points: number;
  active: boolean;
  hidden: boolean;
}

const image = (slug: string) => `/brand/badges/${slug}.webp`;

const rule = (slug: string, name: string, emoji: string, description: string, value: Rule, hasImage = true): Seed => {
  const achievement = value.type === "first" || value.type === "most";
  return {
    slug,
    name,
    description,
    emoji,
    imageUrl: hasImage ? image(slug) : null,
    kind: achievement ? "achievement" : "merit",
    source: "rule",
    rule: value,
    coded: null,
    points: achievement ? 5 : 2,
    active: true,
    hidden: false,
  };
};

const coded = (
  slug: string,
  name: string,
  emoji: string,
  description: string,
  key: CodedKey,
  kind: "achievement" | "merit",
  points: number,
  hasImage = true,
): Seed => ({
  slug,
  name,
  description,
  emoji,
  imageUrl: hasImage ? image(slug) : null,
  kind,
  source: "coded",
  rule: null,
  coded: key,
  points,
  active: true,
  hidden: false,
});

/** Awarded by hand in Admin, as many times as it happens. Points can be negative. */
const manual = (slug: string, name: string, emoji: string, description: string, kind: "achievement" | "merit", points: number): Seed => ({
  slug,
  name,
  description,
  emoji,
  imageUrl: null,
  kind,
  source: "manual",
  rule: null,
  coded: null,
  points,
  active: true,
  hidden: false,
});

/** The same badge, shown as "???" in the trophy case until someone earns it. */
const hidden = (seed: Seed): Seed => ({ ...seed, hidden: true });

/** A coded badge with no artwork yet. */
const plain = (slug: string, name: string, emoji: string, description: string, key: CodedKey, kind: "achievement" | "merit" = "merit"): Seed =>
  coded(slug, name, emoji, description, key, kind, kind === "achievement" ? 5 : 2, false);

export const seedBadges: Seed[] = [
  // Achievements: one holder a day, locked in at the cutoff.
  rule("designated-driver", "Designated Driver", "🚗", "First to reach 0.080% that day.", { type: "first", bac: 0.08 }),
  rule("hydro-hero", "Hydro Hero", "💧", "Most waters logged that day.", { type: "most", metric: "waters" }),
  rule("perez-hilton", "Perez Hilton", "🦜", "Most photos posted that day.", { type: "most", metric: "photos" }),
  rule("paparazzi", "Paparazzi", "📸", "Most photos that day that tag someone else.", {
    type: "most",
    metric: "taggedPhotos",
  }),
  coded("lightweight", "Lightweight", "🥥", "Reached 0.100% that day on the fewest drinks.", "lightweight", "achievement", 5),
  coded(
    "sleeping-beauty",
    "Sleeping Beauty",
    "😴",
    "First caught asleep that day: a photo marked asleep with you tagged, confirmed by an admin.",
    "sleepingBeauty",
    "achievement",
    10,
  ),

  // Merit badges: anyone who meets the condition.
  rule("take-the-wheel-capn", "Take the Wheel Cap'n", "🐙", "Reached 0.080%.", { type: "threshold", bac: 0.08 }),
  rule("triple-kill", "Triple Kill", "🎮", "3 drinks in a rolling hour.", {
    type: "count",
    what: { kind: "drink" },
    n: 3,
    window: "hour",
  }),
  rule("quadkill", "Quadkill", "⚡", "4 drinks in a rolling hour.", {
    type: "count",
    what: { kind: "drink" },
    n: 4,
    window: "hour",
  }),
  rule("pentakill", "Pentakill", "👑", "5 drinks in a rolling hour.", {
    type: "count",
    what: { kind: "drink" },
    n: 5,
    window: "hour",
  }),
  rule("sophisticated-gentleman", "Sophisticated Gentleman", "🍹", "Logged a fruity cocktail.", {
    type: "count",
    what: { kind: "drink", tag: "fruity" },
    n: 1,
    window: "day",
  }),
  rule("breakfast-of-champions", "Breakfast of Champions", "🍳", "A drink before 10am.", {
    type: "time",
    what: { kind: "drink" },
    when: "before",
    time: "10:00",
  }),
  coded(
    "hair-of-the-dog",
    "Hair of the Dog",
    "🐶",
    "First drink of the day before noon, after going over 0.080% the night before.",
    "hairOfTheDog",
    "merit",
    2,
  ),
  coded(
    "second-wind",
    "Second Wind",
    "🌬️",
    "Dropped back to 0.000%, then climbed back over 0.050%, the same day.",
    "secondWind",
    "merit",
    2,
    // No artwork yet: shows its emoji.
    false,
  ),

  // ---- Added 2026-10-09. Only the obscure ones have artwork so far (see LATER_ARTWORK); the rest show their emoji. ----

  // Achievements: one holder a day.
  rule("groomsman-of-the-year", "Groomsman of the Year", "🤵", "Most Groom Taxes that day.", { type: "most", metric: "groomTaxes" }, false),
  plain("early-bird", "Early Bird", "🐦", "First drink of the day.", "earlyBird", "achievement"),
  plain("night-owl", "Night Owl", "🦉", "Last drink before the day ends.", "nightOwl", "achievement"),
  rule("whale", "Whale", "🐋", "Most points staked on wagers that day.", { type: "most", metric: "pointsStaked" }, false),
  rule("the-house", "The House", "🏦", "Most net wager winnings that day.", { type: "most", metric: "wagerWinnings" }, false),
  rule("robin-hood", "Robin Hood", "🏹", "Most points stolen with the slot machine that day.", { type: "most", metric: "slotStolen" }, false),
  rule("most-wanted", "Most Wanted", "🎯", "Most curses received that day.", { type: "most", metric: "cursesReceived" }, false),
  rule("rat-king", "Rat King", "🐀", "Most Snitch Line reports upheld that day.", { type: "most", metric: "snitchReports" }, false),
  plain("influencer", "Influencer", "🤳", "The photo with the most reactions that day.", "influencer", "achievement"),
  rule("reply-guy", "Reply Guy", "💬", "Most comments that day.", { type: "most", metric: "comments" }, false),
  rule("sommelier", "Sommelier", "🍷", "Most different drinks logged that day.", { type: "most", metric: "distinctDrinks" }, false),
  plain("wooden-spoon", "Wooden Spoon", "🥄", "Last place when the day ends, with at least one drink logged that day.", "woodenSpoon", "achievement"),

  // Merit badges.
  plain("jackpot", "Jackpot", "🎰", "Hit a Jackpot on the slot machine.", "jackpot"),
  plain("bust-out", "Bust Out", "💥", "Three slot busts in a row.", "bustOut"),
  plain("robbed-blind", "Robbed Blind", "🦹", "Robbed by someone's slot.", "robbedBlind"),
  plain("bad-beat", "Bad Beat", "🃏", "Lost a wager of 20 points or more.", "badBeat"),
  plain("comeback-kid", "Comeback Kid", "📈", "Last place to the top three within one day.", "comebackKid"),
  rule("shot-caller", "Shot Caller", "🥃", "5 shots in a day.", { type: "count", what: { kind: "drink", category: "shot" }, n: 5, window: "day" }, false),
  plain("variety-pack", "Variety Pack", "🧃", "A beer, a wine, a shot, a cocktail and a seltzer in one day.", "varietyPack"),
  plain("midori-sour-survivor", "Midori Sour Survivor", "🍈", "Completed a Bartender's Choice.", "bartenderDone"),
  // Who a drink was for isn't recorded, so an admin awards this one.
  manual("appletini-dealer", "Appletini Dealer", "🍏", "3 appletinis for Nico.", "merit", 2),
  plain("witch", "Witch", "🧙", "Cast all four kinds of curse.", "witch"),
  plain("identity-crisis", "Identity Crisis", "🪪", "Got name-hijacked.", "identityCrisis"),
  plain("corporate-drone", "Corporate Drone", "👔", "A Snitch Line report against you was upheld.", "corporateDrone"),
  plain("nicos-shadow", "Nico's Shadow", "👥", "Tagged in 10 photos with Nico.", "groomShadow"),

  // Obscure: hidden until someone earns them.
  hidden(plain("nice", "Nice.", "😏", "A drink took your estimated BAC to exactly 0.069%.", "nice")),
  hidden(plain("blaze-it", "Blaze It", "🌿", "Estimated BAC of 0.042% at 4:20, am or pm.", "blazeIt")),
  hidden(plain("jinx", "Jinx", "🤞", "Two players logged the same drink in the same minute.", "jinx")),
  hidden(plain("groundhog-day", "Groundhog Day", "🦫", "The same drink five times in a row.", "groundhogDay")),
  hidden(plain("perfectly-balanced", "Perfectly Balanced", "⚖️", "Equal drinks and waters in a day, five or more of each.", "perfectlyBalanced")),
  hidden(plain("butterfingers", "Butterfingers", "🧈", "Deleted three drinks in a day.", "butterfingers")),
  hidden(plain("mad-scientist", "Mad Scientist", "🧪", "Logged a custom drink over 50% alcohol.", "madScientist")),
  hidden(plain("uno-reverse", "Uno Reverse", "🔄", "Cursed your curser back within five minutes.", "unoReverse")),
  hidden(plain("self-own", "Self-Own", "🤦", "Your Pay It Forward went to whoever last cursed you.", "selfOwn")),
  hidden(plain("regicide", "Regicide", "🗡️", "Cursed the groom.", "regicide")),
  hidden(plain("lazarus", "Lazarus", "🧟", "Logged a drink within an hour of your confirmed Sleeping Beauty photo.", "lazarus")),
  hidden(plain("midnight-snack", "Midnight Snack", "🕛", "Logged a drink at exactly 12:00am.", "midnightSnack")),
  hidden(plain("same-time-tomorrow", "Same Time Tomorrow", "⏰", "Drinks at the same minute of the clock on two days running.", "sameTimeTomorrow")),
  hidden(plain("sunday-scaries", "Sunday Scaries", "😵", "First Sunday drink before 9am.", "sundayScaries")),
  hidden(plain("nice-ii", "Nice II", "💯", "Had exactly 69 points at some moment.", "niceTwo")),

  // Awarded by hand, as many times as it happens.
  manual("flamer", "Flamer", "🔥", "Started an accidental fire.", "achievement", -15),
  manual("fireman", "Fireman", "🧯", "Put out a fire.", "achievement", 15),
  manual("wheres-the-remote", "Where's the Remote?", "📺", "Where's the remote?", "achievement", 1),
  manual("anyone-can-cook", "Anyone Can Cook", "🧑‍🍳", "Someone in the kitchen.", "achievement", 2),
  manual("bucket-brigade", "Bucket Brigade", "🪣", "Helped clean up after a fire.", "merit", 10),
  manual("leave-no-trace", "Leave No Trace", "🧹", "Cleaning.", "merit", 5),
];

/** Crests that arrived after their badge was first seeded (the obscure set, 2026-10-09). */
const LATER_ARTWORK = [
  "nice", "blaze-it", "jinx", "groundhog-day", "perfectly-balanced", "butterfingers", "mad-scientist", "uno-reverse",
  "self-own", "regicide", "lazarus", "midnight-snack", "same-time-tomorrow", "sunday-scaries", "nice-ii",
];
for (const seed of seedBadges) {
  if (LATER_ARTWORK.includes(seed.slug)) seed.imageUrl = image(seed.slug);
}

/**
 * The crest a seeded badge should show when the database has none for it.
 * Badges are only seeded once, so artwork added to this file later reaches
 * existing badges through this rather than through the seed.
 */
export function seedImage(slug: string | null): string | null {
  return seedBadges.find((seed) => seed.slug === slug)?.imageUrl ?? null;
}
