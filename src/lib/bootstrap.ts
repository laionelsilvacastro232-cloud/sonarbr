import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { albums, artists, homeSections, playlistTracks, playlists, siteSettings, tracks } from "@/db/schema";

type ItunesItem = {
  trackId: number;
  artistId: number;
  collectionId?: number;
  artistName: string;
  collectionName?: string;
  trackName: string;
  previewUrl?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  trackNumber?: number;
  collectionArtistName?: string;
  trackExplicitness?: string;
};

/** Importa prévias oficiais (30s) da iTunes Search API. Não exige chave. */
export async function importItunes(term: string, limit = 8, country = "BR") {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}&country=${country}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`iTunes Search respondeu ${res.status}`);
  const json = (await res.json()) as { results: ItunesItem[] };
  let created = 0;
  for (const it of json.results) {
    if (!it.previewUrl || !it.trackId) continue;
    const exists = await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.externalSource, "itunes"), eq(tracks.externalId, String(it.trackId)))).limit(1);
    if (exists.length) continue;
    const mainName = it.collectionArtistName && it.collectionArtistName !== "Various Artists" ? it.collectionArtistName : it.artistName;
    let [artist] = await db.select().from(artists).where(and(eq(artists.externalSource, "itunes"), eq(artists.externalId, String(it.artistId)))).limit(1);
    if (!artist) [artist] = await db.select().from(artists).where(eq(artists.name, mainName)).limit(1);
    if (!artist) {
      [artist] = await db.insert(artists).values({ name: mainName, externalSource: "itunes", externalId: String(it.artistId) }).returning();
    }
    const cover = it.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null;
    let albumId: string | null = null;
    if (it.collectionId) {
      let [album] = await db.select().from(albums).where(and(eq(albums.externalSource, "itunes"), eq(albums.externalId, String(it.collectionId)))).limit(1);
      if (!album) {
        [album] = await db
          .insert(albums)
          .values({
            title: it.collectionName ?? it.trackName,
            artistId: artist.id,
            coverUrl: cover,
            releaseDate: it.releaseDate?.slice(0, 10),
            externalSource: "itunes",
            externalId: String(it.collectionId),
          })
          .returning();
      }
      albumId = album.id;
    }
    await db.insert(tracks).values({
      title: it.trackName,
      artistId: artist.id,
      albumId,
      trackNumber: it.trackNumber ?? 1,
      featuring: it.artistName !== mainName ? it.artistName.replace(mainName, "").replace(/^[\s&,]+/, "") : "",
      durationSec: 30,
      releaseDate: it.releaseDate?.slice(0, 10),
      genre: it.primaryGenreName ?? "",
      coverUrl: cover,
      sourceType: "preview",
      audioUrl: it.previewUrl,
      externalUrl: it.trackViewUrl,
      licenseNote: "Prévia de 30s fornecida pela iTunes Search API. Faixa completa disponível na fonte original.",
      explicit: it.trackExplicitness === "explicit",
      externalSource: "itunes",
      externalId: String(it.trackId),
    });
    created++;
  }
  return created;
}

const SEED_TERMS = ["Djavan", "Marisa Monte", "Tom Jobim", "Miles Davis", "Radiohead", "Daft Punk", "Gilberto Gil", "Nina Simone"];

async function seed() {
  const [flag] = await db.select().from(siteSettings).where(eq(siteSettings.key, "_seeded")).limit(1);
  if (flag) return;
  await db.insert(siteSettings).values({ key: "_seeded", value: new Date().toISOString() }).onConflictDoNothing();

  try {
    await db.execute(sql`create extension if not exists pg_trgm`);
    await db.execute(sql`create index if not exists tracks_title_trgm on tracks using gin (title gin_trgm_ops)`);
    await db.execute(sql`create index if not exists artists_name_trgm on artists using gin (name gin_trgm_ops)`);
    await db.execute(sql`create index if not exists albums_title_trgm on albums using gin (title gin_trgm_ops)`);
  } catch {
    /* pg_trgm opcional: a busca continua funcionando com ILIKE */
  }

  // Fonte própria/livre: exemplos SoundHelix (música algorítmica distribuída livremente).
  const [sh] = await db
    .insert(artists)
    .values({
      name: "SoundHelix",
      bio: "SoundHelix é um framework para criação algorítmica de música. Os exemplos de áudio publicados pelo projeto são distribuídos para uso livre em demonstrações.",
      links: [{ label: "Site oficial", url: "https://www.soundhelix.com" }],
    })
    .returning();
  const [album] = await db
    .insert(albums)
    .values({ title: "SoundHelix Examples", artistId: sh.id, kind: "album", releaseDate: "2011-03-05", credits: "Composição algorítmica: SoundHelix (Thomas Schürger)." })
    .returning();
  const shTracks = await db
    .insert(tracks)
    .values(
      Array.from({ length: 17 }, (_, i) => ({
        title: `Song ${i + 1}`,
        artistId: sh.id,
        albumId: album.id,
        trackNumber: i + 1,
        genre: "Eletrônica",
        releaseDate: "2011-03-05",
        sourceType: "url",
        audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${i + 1}.mp3`,
        externalUrl: "https://www.soundhelix.com/audio-examples",
        licenseNote: "Exemplo de áudio SoundHelix, de uso livre conforme soundhelix.com.",
        credits: "Composição algorítmica: SoundHelix",
        durationSec: 0,
      })),
    )
    .returning();

  await Promise.allSettled(SEED_TERMS.map((t) => importItunes(t, 6)));

  const all = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.sourceType, "preview")).limit(10);
  const [pl] = await db
    .insert(playlists)
    .values({ name: "Destaques do catálogo", description: "Seleção editorial inicial da plataforma.", isPublic: true, editorial: true })
    .returning();
  const ids = [...all.map((a) => a.id), ...shTracks.slice(0, 5).map((t) => t.id)];
  if (ids.length) await db.insert(playlistTracks).values(ids.map((trackId, position) => ({ playlistId: pl.id, trackId, position })));

  const secs: { title: string; subtitle?: string; kind: string; itemIds?: string[] }[] = [
    { title: "Continue ouvindo", kind: "continue" },
    { title: "Feito para você", subtitle: "Baseado no que você curte", kind: "recommended" },
    { title: "Suas playlists", kind: "my_playlists" },
    { title: "Atividade de quem você segue", kind: "activity" },
    { title: "Lançamentos", subtitle: "Álbuns e singles mais recentes", kind: "new_releases" },
    { title: "Em alta", subtitle: "Mais reproduzidas na plataforma", kind: "popular_tracks" },
    { title: "Playlists editoriais", kind: "editorial_playlists", itemIds: [pl.id] },
    { title: "Artistas", kind: "artists" },
    { title: "Gêneros", kind: "genres" },
    { title: "Playlists da comunidade", kind: "public_playlists" },
  ];
  await db.insert(homeSections).values(secs.map((s, i) => ({ title: s.title, subtitle: s.subtitle ?? "", kind: s.kind, itemIds: s.itemIds ?? [], position: i })));
}

const g = globalThis as typeof globalThis & { __bootstrap?: Promise<void> };
export function ensureBootstrap() {
  if (!g.__bootstrap) {
    g.__bootstrap = seed().catch((e) => {
      console.error("bootstrap falhou", e);
      g.__bootstrap = undefined;
    });
  }
  return g.__bootstrap;
}
