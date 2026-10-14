import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { searchAll } from "@/lib/queries";
import { SearchBox } from "@/components/SearchBox";
import { TrackList } from "@/components/TrackList";
import { AlbumCardC, ArtistCardC, Empty, GenreTile, PlaylistCardC, Shelf } from "@/components/Cards";
import { Cover } from "@/components/Cover";
import { getSettings } from "@/lib/settings";
import { saveSearch } from "@/app/actions";

export const metadata = { title: "Buscar" };
export const dynamic = "force-dynamic";

const FILTERS = [
  ["todos", "Tudo"],
  ["musicas", "Músicas"],
  ["artistas", "Artistas"],
  ["albuns", "Álbuns"],
  ["playlists", "Playlists"],
  ["perfis", "Perfis"],
] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const { q = "", tipo = "todos" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const social = settings.socialEnabled === "true";

  let content;
  if (query.length < 2) {
    const g = await db.execute<{ genre: string }>(sql`select genre from tracks where status = 'published' and genre <> '' group by genre order by count(*) desc limit 24`);
    content = (
      <div>
        <h2 className="mb-4 text-xl font-bold">Explorar por gênero</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>a]:!w-full">
          {g.rows.map((r, i) => <GenreTile key={r.genre} name={r.genre} index={i} />)}
        </div>
        {social && <p className="mt-8 text-sm text-white/45">Procurando pessoas? Digite um nome ou @usuário e filtre por <b>Perfis</b>.</p>}
      </div>
    );
  } else {
    const r = await searchAll(query, user?.id, tipo === "todos" ? 8 : 40);
    const users = social ? r.users : [];
    const total = r.tracks.length + r.artists.length + r.albums.length + r.playlists.length + users.length;
    const show = (k: string) => tipo === "todos" || tipo === k;
    content = total === 0 ? (
      <Empty title={`Nenhum resultado para “${query}”`} text="Verifique a ortografia ou tente termos mais gerais, como o nome de um artista." />
    ) : (
      <div>
        {show("musicas") && r.tracks.length > 0 && (
          <section className="mb-9">
            <h2 className="mb-3 text-[22px] font-bold">Músicas</h2>
            <TrackList tracks={r.tracks} showIndex={false} />
          </section>
        )}
        {show("artistas") && r.artists.length > 0 && <Shelf title="Artistas">{r.artists.map((a) => <ArtistCardC key={a.id} a={a} />)}</Shelf>}
        {show("albuns") && r.albums.length > 0 && <Shelf title="Álbuns">{r.albums.map((a) => <AlbumCardC key={a.id} a={a} />)}</Shelf>}
        {show("playlists") && r.playlists.length > 0 && <Shelf title="Playlists">{r.playlists.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf>}
        {show("perfis") && users.length > 0 && (
          <section className="mb-9">
            <h2 className="mb-3 text-[22px] font-bold">Perfis</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {users.map((u) => (
                <Link key={u.id} href={`/perfil/${u.username}`} className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3 hover:bg-white/[0.12]">
                  <div className="h-12 w-12"><Cover src={u.avatarUrl} seed={u.id} title={u.displayName} round /></div>
                  <div className="min-w-0"><div className="truncate font-semibold">{u.displayName}</div><div className="truncate text-xs text-white/45">@{u.username}</div></div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
    if (user) await saveSearch(query);
  }

  void desc;
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-5 md:hidden"><SearchBox initial={query} loggedIn={!!user} /></div>
      {query.length >= 2 && (
        <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filtros">
          {FILTERS.filter(([k]) => k !== "perfis" || social).map(([k, label]) => (
            <Link key={k} role="tab" aria-selected={tipo === k} data-active={tipo === k} href={`/buscar?q=${encodeURIComponent(query)}&tipo=${k}`} className="chip shrink-0">{label}</Link>
          ))}
        </div>
      )}
      {content}
    </div>
  );
}
