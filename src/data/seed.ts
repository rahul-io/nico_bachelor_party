import type { ChallengeInput, EventInput } from "@/lib/store/types";

const at = (day: string, time: string) => new Date(`${day}T${time}:00-07:00`).toISOString();

/** Placeholder schedule for mock mode. The real one is entered through Admin. */
export const seedEvents: EventInput[] = [
  {
    startsAt: at("2026-10-08", "15:00"),
    endsAt: at("2026-10-08", "17:00"),
    title: "Arrivals & check-in",
    location: "The house, Pacific Beach",
    mapsQuery: "Pacific Beach, San Diego, CA",
    notes: "Placeholder event. Door code goes here.",
  },
  {
    startsAt: at("2026-10-08", "19:00"),
    endsAt: at("2026-10-08", "21:00"),
    title: "Tacos & welcome beers",
    location: "Oscars Mexican Seafood",
    mapsQuery: "Oscars Mexican Seafood Pacific Beach San Diego",
    notes: null,
  },
  {
    startsAt: at("2026-10-08", "21:30"),
    endsAt: null,
    title: "Garnet Ave bar crawl",
    location: "Garnet Ave, Pacific Beach",
    mapsQuery: "Garnet Ave, Pacific Beach, San Diego",
    notes: "Stick together. Buy Nico's drinks.",
  },
  {
    startsAt: at("2026-10-09", "09:30"),
    endsAt: at("2026-10-09", "10:30"),
    title: "Breakfast burritos",
    location: "Kono's Cafe",
    mapsQuery: "Kono's Cafe San Diego",
    notes: null,
  },
  {
    startsAt: at("2026-10-09", "12:00"),
    endsAt: at("2026-10-09", "16:00"),
    title: "Golf",
    location: "Torrey Pines Golf Course",
    mapsQuery: "Torrey Pines Golf Course",
    notes: "Collared shirts. Tee times start at noon.",
  },
  {
    startsAt: at("2026-10-09", "19:30"),
    endsAt: at("2026-10-09", "21:30"),
    title: "Steak dinner",
    location: "Gaslamp Quarter",
    mapsQuery: "Gaslamp Quarter, San Diego",
    notes: "Reservation under Rahul.",
  },
  {
    startsAt: at("2026-10-09", "22:00"),
    endsAt: null,
    title: "Gaslamp night out",
    location: "Gaslamp Quarter",
    mapsQuery: "Gaslamp Quarter, San Diego",
    notes: null,
  },
  {
    startsAt: at("2026-10-10", "11:00"),
    endsAt: at("2026-10-10", "15:00"),
    title: "Beach day",
    location: "Mission Beach",
    mapsQuery: "Mission Beach, San Diego",
    notes: "Spikeball, cooler, sunscreen.",
  },
  {
    startsAt: at("2026-10-10", "16:00"),
    endsAt: at("2026-10-10", "18:30"),
    title: "Brewery hop",
    location: "Miramar",
    mapsQuery: "AleSmith Brewing Company San Diego",
    notes: null,
  },
  {
    startsAt: at("2026-10-10", "20:00"),
    endsAt: null,
    title: "The big night",
    location: "Little Italy",
    mapsQuery: "Little Italy, San Diego",
    notes: "Dress sharp.",
  },
  {
    startsAt: at("2026-10-11", "10:00"),
    endsAt: at("2026-10-11", "11:30"),
    title: "Recovery brunch",
    location: "The house",
    mapsQuery: "Pacific Beach, San Diego, CA",
    notes: null,
  },
  {
    startsAt: at("2026-10-11", "12:00"),
    endsAt: null,
    title: "Checkout & goodbyes",
    location: "The house",
    mapsQuery: "Pacific Beach, San Diego, CA",
    notes: "Clean up before you leave.",
  },
];

/** Placeholder challenges for mock mode. */
export const seedChallenges: Array<Omit<ChallengeInput, "active">> = [
  { title: "Buy Nico a shot", description: "Photo evidence required.", points: 10 },
  { title: "Beer pong champion", description: "Win a full game. Losers get nothing.", points: 25 },
  { title: "First in the ocean", description: "Fully under. Each morning counts.", points: 30 },
  { title: "Get a stranger to toast the groom", description: "Out loud, glass raised.", points: 15 },
];

/** Demo guests for mock mode, so the leaderboard has something in it. */
export const seedPeople = [
  { name: "Nico (demo)", heightCm: 180, weightKg: 80, drinks: 3, points: 40, reason: "Being the groom" },
  { name: "Rahul (demo)", heightCm: 175, weightKg: 74, drinks: 2, points: 25, reason: "Beer pong champion" },
  { name: "Marco (demo)", heightCm: 188, weightKg: 92, drinks: 4, points: 10, reason: "Buy Nico a shot" },
  { name: "Jules (demo)", heightCm: 170, weightKg: 68, drinks: 1, points: -5, reason: "Lost the room key" },
];
