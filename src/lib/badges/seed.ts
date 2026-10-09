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
  source: "rule" | "coded";
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
];
