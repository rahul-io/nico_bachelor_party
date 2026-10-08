import { getSettings } from "@/lib/points/settings-store";
import type { GameRecord, Profile, Store } from "@/lib/store/types";
import { GameError, feedLine, nameOf, notify, str } from "./common";

/**
 * Snitch Line: report a player with a photo from the Captain's Log and a
 * reason. If enough other players upvote in time, the accused loses points
 * and the reporter gains some. Records are kind "snitch", owned by the
 * reporter: data { accusedId, reason, photoUrl, votes: string[], expiresAt },
 * status "open" | "upheld".
 */

const MAX_REASON = 140;

const votesOf = (record: GameRecord) => (Array.isArray(record.data.votes) ? (record.data.votes as string[]) : []);
const isOpen = (record: GameRecord, now: number) =>
  record.status === "open" && Date.parse(str(record.data.expiresAt)) > now;

export async function reportPlayer(
  store: Store,
  reporter: Profile,
  input: { accusedId: string; reason: string; postId: string },
  now = Date.now(),
): Promise<void> {
  const [settings, profiles, open] = await Promise.all([
    getSettings(store),
    store.listProfiles(),
    store.listRecords("snitch", "open"),
  ]);
  const accused = profiles.find((profile) => profile.id === input.accusedId);
  const reason = input.reason.trim();
  if (!accused || accused.id === reporter.id) throw new GameError("Pick someone else to report.");
  if (reason.length < 1 || reason.length > MAX_REASON) throw new GameError(`Give a reason (max ${MAX_REASON} characters).`);
  if (open.some((record) => record.profileId === reporter.id && isOpen(record, now))) {
    throw new GameError("You already have a report open. One at a time.");
  }
  const post = await store.getPost(input.postId);
  if (!post || post.mediaType !== "image") throw new GameError("Attach a photo from the Captain's Log.");

  await store.addRecord({
    kind: "snitch",
    profileId: reporter.id,
    status: "open",
    data: {
      accusedId: accused.id,
      reason,
      // The preview, never the original file: see forGuests in feed.ts.
      photoUrl: post.previewUrl ?? post.url,
      votes: [],
      expiresAt: new Date(now + settings.snitchMinutes * 60_000).toISOString(),
    },
  });
  await notify(store, accused.id, `${reporter.name} reported you to the Snitch Line: ${reason}`);
}

/** Upvotes a report. The reporter and the accused can't vote. */
export async function upvote(store: Store, voter: Profile, reportId: string, now = Date.now()): Promise<void> {
  const [settings, record] = await Promise.all([getSettings(store), store.getRecord(reportId)]);
  if (!record || record.kind !== "snitch" || !isOpen(record, now)) throw new GameError("That report has closed.");
  const accusedId = str(record.data.accusedId);
  if (voter.id === record.profileId || voter.id === accusedId) {
    throw new GameError("The reporter and the accused don't get a vote.", 403);
  }
  const votes = votesOf(record);
  if (votes.includes(voter.id)) return;

  const next = [...votes, voter.id];
  const upheld = next.length >= settings.snitchVotes;
  const updated = await store.updateRecord(
    record.id,
    { data: { ...record.data, votes: next }, status: upheld ? "upheld" : "open" },
    "open",
  );
  if (!updated || !upheld) return;

  const profiles = await store.listProfiles();
  const reason = str(record.data.reason);
  await store.addPointEvent({
    profileId: accusedId,
    delta: -settings.snitchPenalty,
    reason: `Snitch Line · ${reason}`,
    challengeId: null,
    source: "snitch",
    groupId: record.id,
    awardKey: `snitch:${record.id}:accused`,
  });
  await store.addPointEvent({
    profileId: record.profileId!,
    delta: settings.snitchReward,
    reason: `Snitch Line · reported ${nameOf(profiles, accusedId)}`,
    challengeId: null,
    source: "snitch",
    groupId: record.id,
    awardKey: `snitch:${record.id}:reporter`,
  });
  await notify(store, accusedId, `The Snitch Line upheld the report against you: ${reason}`);
  await notify(store, record.profileId!, `Your report was upheld: ${reason}`);
  await feedLine(store, "🐀", `${nameOf(profiles, accusedId)} was snitched on: ${reason}`);
}

export interface SnitchView {
  id: string;
  reporter: { id: string; name: string };
  accused: { id: string; name: string };
  reason: string;
  photoUrl: string;
  votes: number;
  needed: number;
  voted: boolean;
  expiresAt: string;
}

/** Open reports with their countdown. Names are display names. */
export async function listReports(store: Store, viewerId: string | null, now = Date.now()): Promise<SnitchView[]> {
  const [settings, records, profiles] = await Promise.all([
    getSettings(store),
    store.listRecords("snitch", "open"),
    store.listProfiles(),
  ]);
  return records
    .filter((record) => isOpen(record, now))
    .map((record) => ({
      id: record.id,
      reporter: { id: record.profileId ?? "", name: nameOf(profiles, record.profileId ?? "") },
      accused: { id: str(record.data.accusedId), name: nameOf(profiles, str(record.data.accusedId)) },
      reason: str(record.data.reason),
      photoUrl: str(record.data.photoUrl),
      votes: votesOf(record).length,
      needed: settings.snitchVotes,
      voted: viewerId !== null && votesOf(record).includes(viewerId),
      expiresAt: str(record.data.expiresAt),
    }));
}
