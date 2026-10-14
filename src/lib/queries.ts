import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  albums,
  artistFollows,
  artists,
  likedTracks,
  playHistory,
  playlistCollaborators,
  playlistTracks,
  playlists,
  savedAlbums,
  savedPlaylists,
  tracks,
  userFollows,
  users,
} from "@/db/schema";

export type TrackDTO = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  albumTitle: string | null;
  coverUrl: string | null;
  durationSec: number;
  audioUrl: string | null;
  externalUrl: string | null;
  availability: string;
  sourceType: string;
  featuring: string;
  genre: string;
  explicit: boolean;
  liked: boolean;
};

export type TrackDetail = TrackDTO & { credits: string; licenseNote: string; releaseDate: string | null; playCount: number };

export const playable = (t: Pick<TrackDTO, "audioUrl" | "availability">) => !!t.audioUrl && t.availability === "available";

const trackFields = {
  id: tracks.id,
  title: tracks.title,
  artistId: tracks.artistId,
  artistName: artists.name,
  albumId: tracks.albumId,
  albumTitle: albums.title,
  coverUrl: sql<string | null>`coalesce(${tracks.coverUrl}, ${albums.coverUrl})`,
  durationSec: tracks.durationSec,
  audioUrl: tracks.audioUrl,
  externalUrl: tracks.externalUrl,
  availability: tracks.availability,
  sourceType: tracks.sourceType,
  featuring: tracks.featuring,
  genre: tracks.genre,
  explicit: tracks.explicit,
};

export const visibleTrack = and(eq(tracks.status, "published"), eq(artists.published, true))!;

function trackBase(userId?: string | null) {
  const liked = userId
    ? sql<boolean>`exists(select 1 from ${likedTracks} lt where lt.track_id = ${tracks.id} and lt.user_id = ${userId})`
    : sql<boolean>`false`;
  return db
    .select({ ...trackFields, liked })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId));
}

export async function queryTracks(opts: { where?: SQL; order?: SQL[]; limit?: number; offset?: number; userId?: string | null }) {
  const q = trackBase(opts.userId)
    .where(and(visibleTrack, opts.where))
    .orderBy(...(opts.order ?? [desc(tracks.playCount)]))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
  return (await q) as TrackDTO[];
}

export async function tracksByIds(ids: string[], userId?: string | null) {
  if (!ids.length) return [];
  const rows = await queryTracks({ where: inArray(tracks.id, ids), userId, limit: ids.length });
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((i) => map.get(i)).filter(Boolean) as TrackDTO[];
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* ---------------- cartões ---------------- */
export type AlbumCard = { id: string; title: string; artistName: string; artistId: string; coverUrl: string | null; kind: string; releaseDate: string | null };
export type ArtistCard = { id: string; name: string; imageUrl: string | null; followers?: number };
export type PlaylistCard = { id: string; name: string; description: string; coverUrl: string | null; ownerName: string | null; isPublic: boolean; editorial: boolean; trackCount: number; covers: string[] };

const albumFields = {
  id: albums.id,
  title: albums.title,
  artistName: artists.name,
  artistId: albums.artistId,
  coverUrl: albums.coverUrl,
  kind: albums.kind,
  releaseDate: albums.releaseDate,
};

export async function queryAlbums(opts: { where?: SQL; order?: SQL[]; limit?: number; offset?: number }) {
  return (await db
    .select(albumFields)
    .from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(and(eq(albums.published, true), eq(artists.published, true), opts.where))
    .orderBy(...(opts.order ?? [desc(albums.releaseDate)]))
    .limit(opts.limit ?? 20)
    .offset(opts.offset ?? 0)) as AlbumCard[];
}

export async function queryArtists(opts: { where?: SQL; limit?: number; offset?: number; order?: SQL[] }) {
  return (await db
    .select({
      id: artists.id,
      name: artists.name,
      imageUrl: artists.imageUrl,
      followers: sql<number>`(select count(*)::int from ${artistFollows} af where af.artist_id = ${artists.id})`,
    })
    .from(artists)
    .where(and(eq(artists.published, true), opts.where))
    .orderBy(...(opts.order ?? [asc(artists.name)]))
    .limit(opts.limit ?? 20)
    .offset(opts.offset ?? 0)) as ArtistCard[];
}

export async function queryPlaylists(opts: { where?: SQL; limit?: number; offset?: number; order?: SQL[] }) {
  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      coverUrl: playlists.coverUrl,
      ownerName: users.displayName,
      isPublic: playlists.isPublic,
      editorial: playlists.editorial,
      trackCount: sql<number>`(select count(*)::int from ${playlistTracks} pt where pt.playlist_id = ${playlists.id})`,
    })
    .from(playlists)
    .leftJoin(users, eq(users.id, playlists.ownerId))
    .where(opts.where)
    .orderBy(...(opts.order ?? [desc(playlists.updatedAt)]))
    .limit(opts.limit ?? 20)
    .offset(opts.offset ?? 0);
  return withCovers(rows);
}

async function withCovers<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return [] as (T & { covers: string[] })[];
  const ids = rows.map((r) => r.id);
  const cov = await db.execute<{ playlist_id: string; cover: string }>(sql`
    select playlist_id, cover from (
      select pt.playlist_id, coalesce(t.cover_url, a.cover_url) as cover,
             row_number() over (partition by pt.playlist_id order by pt.position) rn
      from playlist_tracks pt join tracks t on t.id = pt.track_id left join albums a on a.id = t.album_id
      where pt.playlist_id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}) and coalesce(t.cover_url, a.cover_url) is not null
    ) x where rn <= 4`);
  const map = new Map<string, string[]>();
  for (const r of cov.rows) map.set(r.playlist_id, [...(map.get(r.playlist_id) ?? []), r.cover]);
  return rows.map((r) => ({ ...r, covers: map.get(r.id) ?? [] }));
}

/* ---------------- permissões de playlist ---------------- */
export async function playlistAccess(playlistId: string, userId?: string | null) {
  const [pl] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1);
  if (!pl) return null;
  const isOwner = !!userId && pl.ownerId === userId;
  let isCollab = false;
  if (userId && pl.collaborative && !isOwner) {
    const c = await db.select().from(playlistCollaborators).where(and(eq(playlistCollaborators.playlistId, playlistId), eq(playlistCollaborators.userId, userId))).limit(1);
    isCollab = c.length > 0;
  }
  const canView = pl.isPublic || isOwner || isCollab;
  return { playlist: pl, isOwner, canEdit: isOwner || isCollab, canView };
}

export async function playlistTrackList(playlistId: string, userId?: string | null) {
  const liked = userId
    ? sql<boolean>`exists(select 1 from ${likedTracks} lt where lt.track_id = ${tracks.id} and lt.user_id = ${userId})`
    : sql<boolean>`false`;
  const rows = await db
    .select({ ...trackFields, liked, itemId: playlistTracks.id, position: playlistTracks.position })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(and(eq(playlistTracks.playlistId, playlistId), visibleTrack))
    .orderBy(asc(playlistTracks.position), asc(playlistTracks.addedAt));
  return rows as (TrackDTO & { itemId: string; position: number })[];
}

/* ---------------- busca ---------------- */
export async function searchAll(q: string, userId?: string | null, limit = 8) {
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const [t, a, al, p, u] = await Promise.all([
    queryTracks({ where: or(ilike(tracks.title, like), ilike(artists.name, like), ilike(albums.title, like), ilike(tracks.genre, like)), userId, limit }),
    queryArtists({ where: ilike(artists.name, like), limit }),
    queryAlbums({ where: or(ilike(albums.title, like), ilike(artists.name, like)), limit }),
    queryPlaylists({
      where: and(
        or(eq(playlists.isPublic, true), userId ? eq(playlists.ownerId, userId) : undefined),
        or(ilike(playlists.name, like), ilike(playlists.description, like)),
      ),
      limit,
    }),
    db
      .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(eq(users.status, "active"), eq(users.profilePublic, true), or(ilike(users.username, like), ilike(users.displayName, like))))
      .limit(limit),
  ]);
  return { tracks: t, artists: a, albums: al, playlists: p, users: u };
}

/* ---------------- biblioteca ---------------- */
export async function libraryData(userId: string) {
  const [liked, mine, saved, followed, savedAlb, recent] = await Promise.all([
    queryTracks({ where: sql`exists(select 1 from ${likedTracks} lt where lt.track_id = ${tracks.id} and lt.user_id = ${userId})`, order: [sql`(select created_at from ${likedTracks} lt where lt.track_id = ${tracks.id} and lt.user_id = ${userId}) desc`], userId, limit: 200 }),
    queryPlaylists({
      where: or(
        eq(playlists.ownerId, userId),
        sql`exists(select 1 from ${playlistCollaborators} pc where pc.playlist_id = ${playlists.id} and pc.user_id = ${userId})`,
      ),
      limit: 100,
    }),
    queryPlaylists({ where: sql`exists(select 1 from ${savedPlaylists} sp where sp.playlist_id = ${playlists.id} and sp.user_id = ${userId})`, limit: 100 }),
    queryArtists({ where: sql`exists(select 1 from ${artistFollows} af where af.artist_id = ${artists.id} and af.user_id = ${userId})`, limit: 100 }),
    queryAlbums({ where: sql`exists(select 1 from ${savedAlbums} sa where sa.album_id = ${albums.id} and sa.user_id = ${userId})`, limit: 100 }),
    recentTracks(userId, 12),
  ]);
  return { liked, mine, saved, followed, savedAlb, recent };
}

export async function recentTracks(userId: string, limit = 12) {
  const ids = await db.execute<{ track_id: string }>(sql`
    select track_id from (select track_id, max(played_at) m from play_history where user_id = ${userId} group by track_id) x order by m desc limit ${limit}`);
  return tracksByIds(ids.rows.map((r) => r.track_id), userId);
}

export async function historyData(userId: string, limit = 100, offset = 0) {
  const rows = await db
    .select({ ...trackFields, liked: sql<boolean>`false`, historyId: playHistory.id, playedAt: playHistory.playedAt })
    .from(playHistory)
    .innerJoin(tracks, eq(tracks.id, playHistory.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(playHistory.userId, userId))
    .orderBy(desc(playHistory.playedAt))
    .limit(limit)
    .offset(offset);
  return rows as (TrackDTO & { historyId: string; playedAt: Date })[];
}

/* ---------------- recomendações ---------------- */
export async function recommendedTracks(userId?: string | null, limit = 12) {
  if (userId) {
    const g = await db.execute<{ genre: string; n: number }>(sql`
      select t.genre, count(*)::int n from (
        select track_id from liked_tracks where user_id = ${userId}
        union all select track_id from play_history where user_id = ${userId}
      ) s join tracks t on t.id = s.track_id where t.genre <> '' group by t.genre order by n desc limit 3`);
    const genres = g.rows.map((r) => r.genre);
    if (genres.length) {
      const list = await queryTracks({
        where: and(inArray(tracks.genre, genres), sql`not exists(select 1 from ${likedTracks} lt where lt.track_id = ${tracks.id} and lt.user_id = ${userId})`),
        userId,
        limit,
        order: [sql`random()`],
      });
      if (list.length >= 3) return { tracks: list, personalized: true };
    }
  }
  return { tracks: await queryTracks({ userId, limit }), personalized: false };
}

export async function friendActivity(userId: string, limit = 8) {
  const rows = await db.execute<{ user_id: string; username: string; display_name: string; avatar_url: string | null; track_id: string; played_at: Date }>(sql`
    select u.id user_id, u.username, u.display_name, u.avatar_url, ph.track_id, ph.played_at
    from user_follows uf join users u on u.id = uf.following_id
    join lateral (select track_id, played_at from play_history where user_id = u.id order by played_at desc limit 1) ph on true
    where uf.follower_id = ${userId} and u.show_activity and not u.history_private and u.status = 'active'
    order by ph.played_at desc limit ${limit}`);
  const tr = await tracksByIds(rows.rows.map((r) => r.track_id), userId);
  const map = new Map(tr.map((t) => [t.id, t]));
  return rows.rows
    .map((r) => ({ userId: r.user_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, playedAt: r.played_at, track: map.get(r.track_id) }))
    .filter((r) => r.track);
}

export async function userCounts(userId: string) {
  const r = await db.execute<{ followers: number; following: number; playlists: number }>(sql`
    select (select count(*)::int from user_follows where following_id = ${userId}) followers,
           (select count(*)::int from user_follows where follower_id = ${userId}) following,
           (select count(*)::int from playlists where owner_id = ${userId} and is_public) playlists`);
  return r.rows[0];
}

export const fmtDuration = (sec: number) => {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const fmtTotal = (sec: number) => {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};
