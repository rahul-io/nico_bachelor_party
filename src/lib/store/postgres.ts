import type {
  Challenge,
  Comment,
  DrinkLog,
  GameRecord,
  PointEvent,
  Post,
  Profile,
  ScheduleEvent,
  Store,
  WaterLog,
} from "./types";

type Row = Record<string, unknown>;

/** Tagged-template query function; values become bound parameters. Matches Neon's `neon()`. */
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

const iso = (value: unknown) => new Date(value as string | Date).toISOString();
const isoOrNull = (value: unknown) => (value == null ? null : iso(value));
/** jsonb arrives parsed from Neon; tolerate drivers that hand back text. */
const json = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : (value ?? null));

const toProfile = (row: Row): Profile => ({
  id: row.id as string,
  name: row.name as string,
  avatarUrl: row.avatar_url as string | null,
  heightCm: row.height_cm as number,
  weightKg: row.weight_kg as number,
  sex: row.sex as Profile["sex"],
  showBacOnPosts: row.show_bac_on_posts as boolean,
  hasPassword: row.has_password as boolean,
  mustChangePassword: row.must_change_password as boolean,
  sessionVersion: row.session_version as number,
  createdAt: iso(row.created_at),
});

const toDrink = (row: Row): DrinkLog => ({
  id: row.id as string,
  profileId: row.profile_id as string,
  name: row.name as string,
  volumeOz: row.volume_oz as number | null,
  abv: row.abv as number | null,
  alcoholG: row.alcohol_g as number,
  category: (row.category as string | null | undefined) ?? null,
  consumedAt: iso(row.consumed_at),
});

const toEvent = (row: Row): ScheduleEvent => ({
  id: row.id as string,
  startsAt: iso(row.starts_at),
  endsAt: isoOrNull(row.ends_at),
  title: row.title as string,
  location: row.location as string | null,
  mapsQuery: row.maps_query as string | null,
  notes: row.notes as string | null,
  lat: row.lat as number | null,
  lng: row.lng as number | null,
});

const toChallenge = (row: Row): Challenge => ({
  id: row.id as string,
  title: row.title as string,
  description: row.description as string,
  points: row.points as number,
  active: row.active as boolean,
  createdAt: iso(row.created_at),
});

const toPointEvent = (row: Row): PointEvent => ({
  id: row.id as string,
  profileId: row.profile_id as string,
  // numeric columns come back as strings.
  delta: Number(row.delta),
  reason: row.reason as string | null,
  challengeId: row.challenge_id as string | null,
  source: row.source as PointEvent["source"],
  breakdown: json(row.breakdown) as PointEvent["breakdown"],
  drinkId: row.drink_id as string | null,
  groupId: row.group_id as string | null,
  awardKey: row.award_key as string | null,
  voidedAt: isoOrNull(row.voided_at),
  createdAt: iso(row.created_at),
});

const toRecord = (row: Row): GameRecord => ({
  id: row.id as string,
  kind: row.kind as string,
  profileId: row.profile_id as string | null,
  status: row.status as string,
  data: (json(row.data) ?? {}) as Record<string, unknown>,
  createdAt: iso(row.created_at),
});

const toWater = (row: Row): WaterLog => ({
  id: row.id as string,
  profileId: row.profile_id as string,
  consumedAt: iso(row.consumed_at),
});

const toPost = (row: Row): Post => ({
  id: row.id as string,
  profileId: row.profile_id as string,
  url: row.url as string,
  previewUrl: (row.preview_url as string | null | undefined) ?? null,
  mediaType: row.media_type as Post["mediaType"],
  caption: row.caption as string | null,
  bacAtPost: row.bac_at_post as number | null,
  lat: row.lat as number | null,
  lng: row.lng as number | null,
  locationSource: row.location_source as Post["locationSource"],
  eventId: row.event_id as string | null,
  createdAt: iso(row.created_at),
});

const toComment = (row: Row): Comment => ({
  id: row.id as string,
  postId: row.post_id as string,
  profileId: row.profile_id as string,
  body: row.body as string,
  bacAtComment: row.bac_at_comment as number | null,
  createdAt: iso(row.created_at),
});

// Profile queries list their columns explicitly so avatar_data is never pulled by accident.
export function createPostgresStore(sql: Sql): Store {
  return {
    async createProfile(input, passwordHash = null) {
      const [row] = await sql`
        insert into profiles (name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, password_hash)
        values (${input.name}, ${input.avatarUrl}, ${input.heightCm}, ${input.weightKg}, ${input.sex}, ${input.showBacOnPosts}, ${passwordHash})
        returning id, token, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, created_at, password_hash is not null as has_password, must_change_password, session_version`;
      return { profile: toProfile(row), token: row.token as string };
    },

    async getProfileByToken(id, token) {
      const rows = await sql`
        select id, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, created_at, password_hash is not null as has_password, must_change_password, session_version
        from profiles where id = ${id} and token is not null and token = ${token}`;
      return rows[0] ? toProfile(rows[0]) : null;
    },

    async getProfile(id) {
      const rows = await sql`
        select id, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, created_at, password_hash is not null as has_password, must_change_password, session_version
        from profiles where id = ${id}`;
      return rows[0] ? toProfile(rows[0]) : null;
    },

    async findAccountByName(name) {
      const rows = await sql`
        select id, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, created_at, password_hash is not null as has_password, must_change_password, session_version, password_hash
        from profiles where lower(name) = lower(${name.trim()}) and password_hash is not null`;
      return rows[0] ? { profile: toProfile(rows[0]), passwordHash: rows[0].password_hash as string } : null;
    },

    async isNameTaken(name, exceptId) {
      const rows = await sql`
        select 1 from profiles
        where lower(name) = lower(${name.trim()}) and password_hash is not null and id <> ${exceptId ?? ""}
        limit 1`;
      return rows.length > 0;
    },

    async setPassword(id, passwordHash, options) {
      const rows = await sql`
        update profiles set
          password_hash = ${passwordHash},
          must_change_password = ${options.mustChange},
          session_version = session_version + ${options.signOutEverywhere ? 1 : 0},
          token = null
        where id = ${id}
        returning id, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, created_at, password_hash is not null as has_password, must_change_password, session_version`;
      return rows[0] ? toProfile(rows[0]) : null;
    },

    async recordAttempt(key) {
      await sql`insert into auth_attempts (key) values (${key})`;
      // Old rows are only ever read within a five-minute window; keep the table from growing.
      await sql`delete from auth_attempts where attempted_at < now() - interval '1 day'`;
    },

    async countAttempts(key, sinceMs) {
      const [row] = await sql`
        select count(*)::int as count from auth_attempts
        where key = ${key} and attempted_at >= ${new Date(sinceMs).toISOString()}`;
      return row.count as number;
    },

    async clearAttempts(key) {
      await sql`delete from auth_attempts where key = ${key}`;
    },

    async updateProfile(id, input) {
      const rows = await sql`
        update profiles set
          name = ${input.name},
          avatar_url = ${input.avatarUrl},
          height_cm = ${input.heightCm},
          weight_kg = ${input.weightKg},
          sex = ${input.sex},
          show_bac_on_posts = ${input.showBacOnPosts}
        where id = ${id}
        returning id, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, created_at, password_hash is not null as has_password, must_change_password, session_version`;
      if (!rows[0]) throw new Error(`Profile ${id} not found`);
      return toProfile(rows[0]);
    },

    async listProfiles() {
      const rows = await sql`
        select id, name, avatar_url, height_cm, weight_kg, sex, show_bac_on_posts, created_at, password_hash is not null as has_password, must_change_password, session_version
        from profiles order by created_at`;
      return rows.map(toProfile);
    },

    async deleteProfile(id) {
      const rows = await sql`delete from profiles where id = ${id} returning id`;
      return rows.length > 0;
    },

    async setAvatarData(id, dataUrl) {
      await sql`update profiles set avatar_data = ${dataUrl} where id = ${id}`;
    },

    async getAvatarData(id) {
      const rows = await sql`select avatar_data from profiles where id = ${id}`;
      return (rows[0]?.avatar_data as string | null | undefined) ?? null;
    },

    async listDrinks(profileId) {
      const rows = await sql`
        select * from drink_logs where profile_id = ${profileId} order by consumed_at desc`;
      return rows.map(toDrink);
    },

    async listAllDrinks() {
      return (await sql`select * from drink_logs`).map(toDrink);
    },

    async addDrink(profileId, input) {
      const [row] = await sql`
        insert into drink_logs (profile_id, name, volume_oz, abv, alcohol_g, category)
        values (${profileId}, ${input.name}, ${input.volumeOz}, ${input.abv}, ${input.alcoholG}, ${input.category ?? null})
        returning *`;
      return toDrink(row);
    },

    async deleteDrink(profileId, drinkId) {
      const rows = await sql`
        delete from drink_logs where id = ${drinkId} and profile_id = ${profileId} returning id`;
      return rows.length > 0;
    },

    async listWaters(profileId) {
      const rows = await sql`
        select * from water_logs where profile_id = ${profileId} order by consumed_at desc`;
      return rows.map(toWater);
    },

    async listAllWaters() {
      return (await sql`select * from water_logs`).map(toWater);
    },

    async addWater(profileId) {
      const [row] = await sql`insert into water_logs (profile_id) values (${profileId}) returning *`;
      return toWater(row);
    },

    async deleteWater(profileId, waterId) {
      const rows = await sql`
        delete from water_logs where id = ${waterId} and profile_id = ${profileId} returning id`;
      return rows.length > 0;
    },

    async listEvents() {
      return (await sql`select * from events order by starts_at`).map(toEvent);
    },

    async createEvent(input) {
      const [row] = await sql`
        insert into events (starts_at, ends_at, title, location, maps_query, notes, lat, lng)
        values (${input.startsAt}, ${input.endsAt}, ${input.title}, ${input.location}, ${input.mapsQuery}, ${input.notes}, ${input.lat}, ${input.lng})
        returning *`;
      return toEvent(row);
    },

    async updateEvent(id, input) {
      const rows = await sql`
        update events set
          starts_at = ${input.startsAt},
          ends_at = ${input.endsAt},
          title = ${input.title},
          location = ${input.location},
          maps_query = ${input.mapsQuery},
          notes = ${input.notes},
          lat = ${input.lat},
          lng = ${input.lng}
        where id = ${id}
        returning *`;
      return rows[0] ? toEvent(rows[0]) : null;
    },

    async deleteEvent(id) {
      const rows = await sql`delete from events where id = ${id} returning id`;
      return rows.length > 0;
    },

    async listChallenges() {
      return (await sql`select * from challenges order by created_at`).map(toChallenge);
    },

    async createChallenge(input) {
      const [row] = await sql`
        insert into challenges (title, description, points, active)
        values (${input.title}, ${input.description}, ${input.points}, ${input.active})
        returning *`;
      return toChallenge(row);
    },

    async updateChallenge(id, input) {
      const rows = await sql`
        update challenges set
          title = ${input.title},
          description = ${input.description},
          points = ${input.points},
          active = ${input.active}
        where id = ${id}
        returning *`;
      return rows[0] ? toChallenge(rows[0]) : null;
    },

    async deleteChallenge(id) {
      // point_events.challenge_id is ON DELETE SET NULL, so awarded points stay.
      const rows = await sql`delete from challenges where id = ${id} returning id`;
      return rows.length > 0;
    },

    async listPointEvents(profileId) {
      const rows = profileId
        ? await sql`select * from point_events where profile_id = ${profileId} order by created_at desc`
        : await sql`select * from point_events order by created_at desc`;
      return rows.map(toPointEvent);
    },

    async addPointEvent(input) {
      const rows = await sql`
        insert into point_events
          (profile_id, delta, reason, challenge_id, source, breakdown, drink_id, group_id, award_key, created_at)
        values (
          ${input.profileId}, ${input.delta}, ${input.reason}, ${input.challengeId},
          ${input.source ?? "admin"},
          ${input.breakdown ? JSON.stringify(input.breakdown) : null}::jsonb,
          ${input.drinkId ?? null}, ${input.groupId ?? null}, ${input.awardKey ?? null},
          coalesce(${input.createdAt ?? null}::timestamptz, now())
        )
        on conflict (award_key) where award_key is not null do nothing
        returning *`;
      return rows[0] ? toPointEvent(rows[0]) : null;
    },

    async voidPointEvents(match) {
      const rows =
        "drinkId" in match
          ? await sql`
              update point_events set voided_at = now()
              where drink_id = ${match.drinkId} and voided_at is null returning *`
          : await sql`
              update point_events set voided_at = now()
              where group_id = ${match.groupId} and voided_at is null returning *`;
      return rows.map(toPointEvent);
    },

    async listRecords(kind, status) {
      const rows =
        status === undefined
          ? await sql`select * from game_records where kind = ${kind} order by created_at desc`
          : await sql`
              select * from game_records where kind = ${kind} and status = ${status} order by created_at desc`;
      return rows.map(toRecord);
    },

    async getRecord(id) {
      const rows = await sql`select * from game_records where id = ${id}`;
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async addRecord(input) {
      const [row] = await sql`
        insert into game_records (kind, profile_id, status, data)
        values (${input.kind}, ${input.profileId}, ${input.status}, ${JSON.stringify(input.data)}::jsonb)
        returning *`;
      return toRecord(row);
    },

    async updateRecord(id, patch, expectStatus) {
      const rows = await sql`
        update game_records set
          status = coalesce(${patch.status ?? null}, status),
          data = coalesce(${patch.data === undefined ? null : JSON.stringify(patch.data)}::jsonb, data)
        where id = ${id} and (${expectStatus ?? null}::text is null or status = ${expectStatus ?? null})
        returning *`;
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async getSetting(key) {
      const rows = await sql`select value from app_settings where key = ${key}`;
      return rows[0] ? json(rows[0].value) : null;
    },

    async setSetting(key, value) {
      await sql`
        insert into app_settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
    },

    async listPosts() {
      return (await sql`select * from posts order by created_at desc`).map(toPost);
    },

    async getPost(id) {
      const rows = await sql`select * from posts where id = ${id}`;
      return rows[0] ? toPost(rows[0]) : null;
    },

    async createPost(input) {
      const [row] = await sql`
        insert into posts (profile_id, url, preview_url, media_type, caption, bac_at_post, lat, lng, location_source, event_id)
        values (${input.profileId}, ${input.url}, ${input.previewUrl ?? null}, ${input.mediaType}, ${input.caption}, ${input.bacAtPost},
                ${input.lat}, ${input.lng}, ${input.locationSource}, ${input.eventId})
        returning *`;
      return toPost(row);
    },

    async deletePost(id) {
      const rows = await sql`delete from posts where id = ${id} returning id`;
      return rows.length > 0;
    },

    async reactionCounts(viewerId) {
      const rows = await sql`
        select post_id, emoji, count(*)::int as count, coalesce(bool_or(profile_id = ${viewerId}), false) as mine
        from post_reactions group by post_id, emoji`;
      return rows.map((row) => ({
        postId: row.post_id as string,
        emoji: row.emoji as string,
        count: row.count as number,
        mine: row.mine as boolean,
      }));
    },

    async listPostReactions(postId) {
      const rows = await sql`
        select post_id, profile_id, emoji from post_reactions where post_id = ${postId} order by created_at`;
      return rows.map((row) => ({
        postId: row.post_id as string,
        profileId: row.profile_id as string,
        emoji: row.emoji as string,
      }));
    },

    async setReaction(reaction, on) {
      if (on) {
        await sql`
          insert into post_reactions (post_id, profile_id, emoji)
          values (${reaction.postId}, ${reaction.profileId}, ${reaction.emoji})
          on conflict do nothing`;
      } else {
        await sql`
          delete from post_reactions
          where post_id = ${reaction.postId} and profile_id = ${reaction.profileId} and emoji = ${reaction.emoji}`;
      }
    },

    async commentCounts() {
      const rows = await sql`select post_id, count(*)::int as count from post_comments group by post_id`;
      return rows.map((row) => ({ postId: row.post_id as string, count: row.count as number }));
    },

    async listComments(postId) {
      return (await sql`select * from post_comments where post_id = ${postId} order by created_at`).map(toComment);
    },

    async listAllComments() {
      return (await sql`select * from post_comments order by created_at`).map(toComment);
    },

    async getComment(id) {
      const rows = await sql`select * from post_comments where id = ${id}`;
      return rows[0] ? toComment(rows[0]) : null;
    },

    async addComment(input) {
      const [row] = await sql`
        insert into post_comments (post_id, profile_id, body, bac_at_comment)
        values (${input.postId}, ${input.profileId}, ${input.body}, ${input.bacAtComment})
        returning *`;
      return toComment(row);
    },

    async deleteComment(id) {
      const rows = await sql`delete from post_comments where id = ${id} returning id`;
      return rows.length > 0;
    },
  };
}
