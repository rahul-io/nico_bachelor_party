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
  consumedAt: string;
}

export type DrinkInput = Pick<DrinkLog, "name" | "volumeOz" | "abv" | "alcoholG">;

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

/** One entry in the points ledger. Totals are always summed from these. */
export interface PointEvent {
  id: string;
  profileId: string;
  delta: number;
  reason: string | null;
  challengeId: string | null;
  createdAt: string;
}

export type PointEventInput = Pick<PointEvent, "profileId" | "delta" | "reason" | "challengeId">;

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
  url: string;
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

/**
 * The single data seam. Route handlers only talk to this interface; the mock
 * and Postgres stores both implement it.
 */
export interface Store {
  createProfile(input: ProfileInput): Promise<{ profile: Profile; token: string }>;
  /** Returns the profile only if the token matches. */
  getProfileByToken(id: string, token: string): Promise<Profile | null>;
  updateProfile(id: string, input: ProfileInput): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;
  /** Also removes the profile's drinks, point events, posts, reactions and comments (but not the posts' files). */
  deleteProfile(id: string): Promise<boolean>;
  /** The avatar image as a data URL, kept apart from the profile so lists stay small. */
  setAvatarData(id: string, dataUrl: string | null): Promise<void>;
  getAvatarData(id: string): Promise<string | null>;

  /** Newest first. */
  listDrinks(profileId: string): Promise<DrinkLog[]>;
  listAllDrinks(): Promise<DrinkLog[]>;
  addDrink(profileId: string, input: DrinkInput): Promise<DrinkLog>;
  deleteDrink(profileId: string, drinkId: string): Promise<boolean>;

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

  /** Newest first. */
  listPointEvents(): Promise<PointEvent[]>;
  addPointEvent(input: PointEventInput): Promise<PointEvent>;

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
