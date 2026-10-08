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
  /** Also removes the profile's drinks and point events. */
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
}
