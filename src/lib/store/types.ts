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
  "name" | "heightCm" | "weightKg" | "sex" | "showBacOnPosts"
>;

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

/**
 * The single data seam. Route handlers only talk to this interface; the mock
 * and Postgres stores both implement it.
 */
export interface Store {
  createProfile(input: ProfileInput): Promise<{ profile: Profile; token: string }>;
  /** Returns the profile only if the token matches. */
  getProfileByToken(id: string, token: string): Promise<Profile | null>;
  updateProfile(id: string, input: ProfileInput): Promise<Profile>;

  /** Newest first. */
  listDrinks(profileId: string): Promise<DrinkLog[]>;
  addDrink(profileId: string, input: DrinkInput): Promise<DrinkLog>;
  deleteDrink(profileId: string, drinkId: string): Promise<boolean>;

  /** Ordered by start time. */
  listEvents(): Promise<ScheduleEvent[]>;
}
