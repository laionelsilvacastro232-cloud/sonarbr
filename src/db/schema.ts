import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  date,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("user"), // user | artist | admin
    status: text("status").notNull().default("active"), // active | suspended
    suspendedReason: text("suspended_reason"),
    artistId: uuid("artist_id"),
    artistRequest: boolean("artist_request").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    // privacidade
    profilePublic: boolean("profile_public").notNull().default(true),
    historyPrivate: boolean("history_private").notNull().default(false),
    showActivity: boolean("show_activity").notNull().default(true),
    recordHistory: boolean("record_history").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_username_idx").on(t.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // reset | verify
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash)],
);

export const artists = pgTable(
  "artists",
  {
    id: id(),
    name: text("name").notNull(),
    bio: text("bio").notNull().default(""),
    imageUrl: text("image_url"),
    links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),
    published: boolean("published").notNull().default(true),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [index("artists_name_idx").on(t.name), index("artists_ext_idx").on(t.externalSource, t.externalId)],
);

export const albums = pgTable(
  "albums",
  {
    id: id(),
    title: text("title").notNull(),
    artistId: uuid("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("album"), // album | single | ep
    coverUrl: text("cover_url"),
    releaseDate: date("release_date"),
    credits: text("credits").notNull().default(""),
    published: boolean("published").notNull().default(true),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [index("albums_artist_idx").on(t.artistId), index("albums_release_idx").on(t.releaseDate), index("albums_ext_idx").on(t.externalSource, t.externalId)],
);

export const tracks = pgTable(
  "tracks",
  {
    id: id(),
    title: text("title").notNull(),
    artistId: uuid("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" }),
    albumId: uuid("album_id").references(() => albums.id, { onDelete: "set null" }),
    trackNumber: integer("track_number").notNull().default(1),
    featuring: text("featuring").notNull().default(""),
    durationSec: integer("duration_sec").notNull().default(0),
    releaseDate: date("release_date"),
    genre: text("genre").notNull().default(""),
    credits: text("credits").notNull().default(""),
    coverUrl: text("cover_url"),
    // fonte de áudio: upload | url (licenciada) | preview (prévia oficial) | jamendo | external (somente link)
    sourceType: text("source_type").notNull().default("url"),
    audioUrl: text("audio_url"),
    externalUrl: text("external_url"),
    licenseNote: text("license_note").notNull().default(""),
    availability: text("availability").notNull().default("available"), // available | unavailable | external_only
    status: text("status").notNull().default("published"), // published | draft | pending
    explicit: boolean("explicit").notNull().default(false),
    playCount: integer("play_count").notNull().default(0),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("tracks_artist_idx").on(t.artistId),
    index("tracks_album_idx").on(t.albumId),
    index("tracks_status_idx").on(t.status),
    index("tracks_genre_idx").on(t.genre),
    index("tracks_plays_idx").on(t.playCount),
    index("tracks_ext_idx").on(t.externalSource, t.externalId),
  ],
);

/** Novidades e atualizações publicadas pelo artista para os ouvintes. */
export const artistPosts = pgTable(
  "artist_posts",
  {
    id: id(),
    artistId: uuid("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    coverUrl: text("cover_url"),
    status: text("status").notNull().default("published"), // published | draft
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ap_artist_idx").on(t.artistId, t.createdAt)],
);

export const playlists = pgTable(
  "playlists",
  {
    id: id(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    coverUrl: text("cover_url"),
    isPublic: boolean("is_public").notNull().default(false),
    collaborative: boolean("collaborative").notNull().default(false),
    editorial: boolean("editorial").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("playlists_owner_idx").on(t.ownerId), index("playlists_public_idx").on(t.isPublic)],
);

export const playlistTracks = pgTable(
  "playlist_tracks",
  {
    id: id(),
    playlistId: uuid("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" }),
    trackId: uuid("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    addedAt: createdAt(),
  },
  (t) => [index("pt_playlist_idx").on(t.playlistId, t.position)],
);

export const playlistCollaborators = pgTable(
  "playlist_collaborators",
  {
    playlistId: uuid("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.playlistId, t.userId] })],
);

export const likedTracks = pgTable(
  "liked_tracks",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    trackId: uuid("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.trackId] }), index("liked_user_idx").on(t.userId, t.createdAt)],
);

export const savedAlbums = pgTable(
  "saved_albums",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    albumId: uuid("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.albumId] })],
);

export const savedPlaylists = pgTable(
  "saved_playlists",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    playlistId: uuid("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.playlistId] })],
);

export const artistFollows = pgTable(
  "artist_follows",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistId] }), index("af_artist_idx").on(t.artistId)],
);

export const userFollows = pgTable(
  "user_follows",
  {
    followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] }), index("uf_following_idx").on(t.followingId)],
);

export const playHistory = pgTable(
  "play_history",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    trackId: uuid("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    listenedSec: integer("listened_sec").notNull().default(0),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ph_user_idx").on(t.userId, t.playedAt)],
);

export const searchHistory = pgTable(
  "search_history",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sh_user_idx").on(t.userId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.createdAt)],
);

/** Central de ajuda: conversas entre o usuário e o suporte oficial do aplicativo. */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("open"), // open | answered | closed
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("st_user_idx").on(t.userId, t.updatedAt), index("st_status_idx").on(t.status, t.updatedAt)],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: id(),
    ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    fromSupport: boolean("from_support").notNull().default(false),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sm_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type").notNull(), // user | playlist | track | artist
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("open"), // open | resolved | dismissed
    resolution: text("resolution"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)],
);

export const homeSections = pgTable("home_sections", {
  id: id(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  kind: text("kind").notNull(),
  itemIds: jsonb("item_ids").$type<string[]>().notNull().default([]),
  config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
  position: integer("position").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    target: text("target"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const eventLogs = pgTable(
  "event_logs",
  {
    id: id(),
    level: text("level").notNull().default("error"),
    source: text("source").notNull(),
    message: text("message").notNull(),
    trackId: uuid("track_id"),
    createdAt: createdAt(),
  },
  (t) => [index("events_created_idx").on(t.createdAt)],
);
