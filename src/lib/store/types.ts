export type Sex = "male" | "female";

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
  heightCm: number;
  weightKg: number;
  sex: Sex;
  /** Whether new photo posts get a BAC snapshot attached. */
  showBacOnPosts: boolean;
  /** False for profiles made before accounts existed that haven't set a password yet. */
  hasPassword: boolean;
  /** Set when an admin resets the password; cleared when the person picks a new one. */
  mustChangePassword: boolean;
  /** Bumped to sign every device out. A session cookie is only valid for the current value. */
  sessionVersion: number;
  createdAt: string;
}

export type ProfileInput = Pick<
  Profile,
  "name" | "avatarUrl" | "heightCm" | "weightKg" | "sex" | "showBacOnPosts"
>;

/** What other guests are allowed to see of a profile. */
export type PublicProfile = Pick<Profile, "id" | "name" | "avatarUrl">;

export interface DrinkLog {
  id: string;
  profileId: string;
  name: string;
  /** Null for entries logged purely by alcohol mass (e.g. "standard drink"). */
  volumeOz: number | null;
  /** Fraction, e.g. 0.05 for 5%. */
  abv: number | null;
  alcoholG: number;
  /** Catalogue category (beer, cocktail…) when picked from the list; lets Drink of the Day match. */
  category: string | null;
  consumedAt: string;
}

export type DrinkInput = Pick<DrinkLog, "name" | "volumeOz" | "abv" | "alcoholG"> & { category?: string | null };

/** A logged water. Not a drink: it never counts towards drink totals or BAC. */
export interface WaterLog {
  id: string;
  profileId: string;
  consumedAt: string;
}

export interface ScheduleEvent {
  id: string;
  startsAt: string;
  endsAt: string | null;
  title: string;
  location: string | null;
  /** Search string for Google Maps; falls back to `location`. */
  mapsQuery: string | null;
  notes: string | null;
  /** Coordinates, so photos tagged with this event can go on the map. */
  lat: number | null;
  lng: number | null;
}

export type EventInput = Omit<ScheduleEvent, "id">;

export interface Challenge {
  id: string;
  title: string;
  description: string;
  points: number;
  /** Inactive challenges are hidden from guests. */
  active: boolean;
  createdAt: string;
}

export type ChallengeInput = Pick<Challenge, "title" | "description" | "points" | "active">;

/** What produced a ledger entry. */
export type PointSource = "admin" | "drink" | "water" | "cheers" | "hourly" | "award";

/** How a drink's points were worked out, kept with the entry so the history can show it. */
export interface DrinkBreakdown {
  /** Standard drinks in the pour. */
  std: number;
  /** The part of it that fit under the pace cap. */
  counted: number;
  /** Points per standard drink at the time. */
  rate: number;
  multipliers: Array<{ label: string; factor: number }>;
  /** Combined multiplier actually applied, after the maximum. */
  multiplier: number;
  /** True when the estimated BAC was at or over the ceiling, so the drink earned nothing. */
  paused: boolean;
}

/**
 * One entry in the points ledger. Totals are always summed from these,
 * skipping voided entries.
 */
export interface PointEvent {
  id: string;
  profileId: string;
  /** To one decimal place. */
  delta: number;
  reason: string | null;
  challengeId: string | null;
  source: PointSource;
  breakdown: DrinkBreakdown | null;
  /** The drink or water that caused this entry; deleting it voids the entry. */
  drinkId: string | null;
  /** Ties together entries from one cause, e.g. everyone in a Cheers. */
  groupId: string | null;
  /** Unique when set, so an award can never be paid twice. */
  awardKey: string | null;
  /** Set when the entry was reversed. Voided entries stay in the history, struck through. */
  voidedAt: string | null;
  createdAt: string;
}

export type PointEventInput = Pick<PointEvent, "profileId" | "delta" | "reason" | "challengeId"> &
  Partial<Pick<PointEvent, "source" | "breakdown" | "drinkId" | "groupId" | "awardKey" | "createdAt">>;

export interface LeaderboardEntry extends PublicProfile {
  points: number;
  drinks: number;
  /** Estimated BAC in percent, computed server-side. */
  bac: number;
}

export type MediaType = "image" | "video";

/** Where a post's coordinates came from: the photo's own GPS tag, a tagged event, or the phone at upload time. */
export type LocationSource = "exif" | "event" | "device";

export interface Post {
  id: string;
  profileId: string;
  /** Original upload, used by exports. */
  url: string;
  /** Smaller feed image; absent for older posts, videos or unsupported formats. */
  previewUrl?: string | null;
  mediaType: MediaType;
  caption: string | null;
  /** The poster's estimated BAC when they posted, if they had that setting on. Never recomputed. */
  bacAtPost: number | null;
  /** Where it was taken, for the photo map. Null when unknown. */
  lat: number | null;
  lng: number | null;
  locationSource: LocationSource | null;
  /** The schedule event the poster tagged, if any. */
  eventId: string | null;
  createdAt: string;
}

export type PostInput = Omit<Post, "id" | "createdAt">;

/** One emoji's tally on one post, from a given viewer's point of view. */
export interface ReactionCount {
  postId: string;
  emoji: string;
  count: number;
  /** Whether the viewer is one of the people who reacted with it. */
  mine: boolean;
}

export interface Reaction {
  postId: string;
  profileId: string;
  emoji: string;
}

export interface Comment {
  id: string;
  postId: string;
  profileId: string;
  body: string;
  /** The commenter's estimated BAC when they commented, if they had that setting on. Never recomputed. */
  bacAtComment: number | null;
  createdAt: string;
}

export type CommentInput = Omit<Comment, "id" | "createdAt">;

export interface FeedComment extends Comment {
  authorName: string;
  authorAvatarUrl: string | null;
}

export interface FeedPost extends Post {
  posterName: string;
  posterAvatarUrl: string | null;
  /** Only emojis someone has used, in the fixed display order. */
  reactions: Array<Pick<ReactionCount, "emoji" | "count" | "mine">>;
  commentCount: number;
}

/** Everything shown when a photo is opened. */
export interface PostDetail {
  post: FeedPost;
  reactors: Array<{ emoji: string; names: string[] }>;
  comments: FeedComment[];
}

export interface Feed {
  /** False in mock mode, where only small images can be posted. */
  uploadsEnabled: boolean;
  posts: FeedPost[];
}

export type TrendMetric = "points" | "drinks" | "bac";

/** One value per entry in `Trends.times` for each metric. */
export type TrendPlayer = PublicProfile & Record<TrendMetric, number[]>;

export interface Trends {
  /** Sample instants in ms, ascending; the last one is "now". */
  times: number[];
  players: TrendPlayer[];
}

export interface PointHistoryEntry extends PointEvent {
  profileName: string;
}

/** A drink in the person's own log, with what it earned (its own points plus any Cheers). */
export interface LoggedDrink extends DrinkLog {
  points: number | null;
  /** "1.4 std × 3 = 4.2", for the line under the drink. */
  pointsLine: string | null;
}

export interface LoggedWater extends WaterLog {
  points: number | null;
}

/**
 * The single data seam. Route handlers only talk to this interface; the mock
 * and Postgres stores both implement it.
 */
export interface Store {
  /** With a password hash this is an account; without one, a legacy device-only profile. */
  createProfile(input: ProfileInput, passwordHash?: string | null): Promise<{ profile: Profile; token: string }>;
  getProfile(id: string): Promise<Profile | null>;
  /** Legacy device token, used only to claim a pre-accounts profile. */
  getProfileByToken(id: string, token: string): Promise<Profile | null>;
  /** Case-insensitive, accounts (profiles with a password) only. */
  findAccountByName(name: string): Promise<{ profile: Profile; passwordHash: string } | null>;
  /** Whether another account already uses this name, ignoring case. */
  isNameTaken(name: string, exceptId?: string): Promise<boolean>;
  /** Stores a new hash and clears the legacy token. `signOutEverywhere` invalidates all sessions. */
  setPassword(
    id: string,
    passwordHash: string,
    options: { mustChange: boolean; signOutEverywhere: boolean },
  ): Promise<Profile | null>;

  /** Failed sign-in or invite-code attempts, for rate limiting. */
  recordAttempt(key: string): Promise<void>;
  countAttempts(key: string, sinceMs: number): Promise<number>;
  clearAttempts(key: string): Promise<void>;

  updateProfile(id: string, input: ProfileInput): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;
  /** Also removes the profile's drinks, waters, point events, posts, reactions and comments (but not the posts' files). */
  deleteProfile(id: string): Promise<boolean>;
  /** The avatar image as a data URL, kept apart from the profile so lists stay small. */
  setAvatarData(id: string, dataUrl: string | null): Promise<void>;
  getAvatarData(id: string): Promise<string | null>;

  /** Newest first. */
  listDrinks(profileId: string): Promise<DrinkLog[]>;
  listAllDrinks(): Promise<DrinkLog[]>;
  addDrink(profileId: string, input: DrinkInput): Promise<DrinkLog>;
  deleteDrink(profileId: string, drinkId: string): Promise<boolean>;

  /** Newest first. */
  listWaters(profileId: string): Promise<WaterLog[]>;
  listAllWaters(): Promise<WaterLog[]>;
  addWater(profileId: string): Promise<WaterLog>;
  deleteWater(profileId: string, waterId: string): Promise<boolean>;

  /** Ordered by start time. */
  listEvents(): Promise<ScheduleEvent[]>;
  createEvent(input: EventInput): Promise<ScheduleEvent>;
  updateEvent(id: string, input: EventInput): Promise<ScheduleEvent | null>;
  deleteEvent(id: string): Promise<boolean>;

  /** Oldest first, including inactive ones. */
  listChallenges(): Promise<Challenge[]>;
  createChallenge(input: ChallengeInput): Promise<Challenge>;
  updateChallenge(id: string, input: ChallengeInput): Promise<Challenge | null>;
  deleteChallenge(id: string): Promise<boolean>;

  /** Newest first, voided entries included. Pass a profile id for one person's entries. */
  listPointEvents(profileId?: string): Promise<PointEvent[]>;
  /** Null when an entry with the same award key already exists. */
  addPointEvent(input: PointEventInput): Promise<PointEvent | null>;
  /** Marks live entries as reversed; returns the ones it voided. */
  voidPointEvents(match: { drinkId: string } | { groupId: string }): Promise<PointEvent[]>;

  /** Small JSON values edited in Admin (points settings, Happy Hour, Drink of the Day). */
  getSetting(key: string): Promise<unknown | null>;
  setSetting(key: string, value: unknown): Promise<void>;

  /** Newest first. */
  listPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(input: PostInput): Promise<Post>;
  deletePost(id: string): Promise<boolean>;

  /** Per-post, per-emoji counts for the whole feed in one query. */
  reactionCounts(viewerId: string | null): Promise<ReactionCount[]>;
  listPostReactions(postId: string): Promise<Reaction[]>;
  /** Adding twice or removing something absent is a no-op. */
  setReaction(reaction: Reaction, on: boolean): Promise<void>;

  commentCounts(): Promise<Array<{ postId: string; count: number }>>;
  /** Oldest first. */
  listComments(postId: string): Promise<Comment[]>;
  listAllComments(): Promise<Comment[]>;
  getComment(id: string): Promise<Comment | null>;
  addComment(input: CommentInput): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
}
