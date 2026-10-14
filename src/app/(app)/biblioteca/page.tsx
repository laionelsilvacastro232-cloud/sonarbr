import Link from "next/link";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { libraryData } from "@/lib/queries";
import { AlbumCardC, ArtistCardC, Empty, PageHeader, PlaylistCardC } from "@/components/Cards";
import { TrackList } from "@/components/TrackList";
import { NewPlaylistButton } from "@/components/Misc";
import { PlayAllButton } from "@/components/Interactive";

export const metadata = { title: "Sua biblioteca" };
export const dynamic = "force-dynamic";

const TABS = [
  ["playlists", "Playlists"],
  ["curtidas", "Curtidas"],
  ["salvas", "Playlists salvas"],
  ["albuns", "Álbuns"],
  ["artistas", "Artistas"],
  ["recentes", "Recentes"],
] as const;

export default async function Library({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; ordem?: string }> }) {
  await requireUser();
  const user = (await getCurrentUser())!;
  const { aba = "playlists", q = "", ordem = "recentes" } = await searchParams;
  const d = await libraryData(user.id);
  const term = q.trim().toLowerCase();
  const has = (s: string) => !term || s.toLowerCase().includes(term);
  const sortBy = <T,>(arr: T[], name: (x: T) => string) => (ordem === "az" ? [...arr].sort((a, b) => name(a).localeCompare(name(b), "pt-BR")) : arr);

  const mine = sortBy(d.mine.filter((p) => has(p.name)), (p) => p.name);
  const saved = sortBy(d.saved.filter((p) => has(p.name)), (p) => p.name);
  const albs = sortBy(d.savedAlb.filter((a) => has(a.title + a.artistName)), (a) => a.title);
  const arts = sortBy(d.followed.filter((a) => has(a.name)), (a) => a.name);
  const liked = sortBy(d.liked.filter((t) => has(t.title + t.artistName)), (t) => t.title);
  const recent = d.recent.filter((t) => has(t.title + t.artistName));

  const grid = "grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 [&>div]:!w-full";
  const base = (extra: string) => `/biblioteca?aba=${aba}${extra}`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Biblioteca" title="Sua biblioteca"><NewPlaylistButton /></PageHeader>
      <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar" role="tablist">
        {TABS.map(([k, l]) => (
          <Link key={k} role="tab" aria-selected={aba === k} data-active={aba === k} href={`/biblioteca?aba=${k}`} className="chip shrink-0">{l}</Link>
        ))}
      </div>
      <form className="mb-6 flex flex-wrap items-center gap-3" action="/biblioteca">
        <input type="hidden" name="aba" value={aba} />
        <input name="q" defaultValue={q} placeholder="Filtrar nesta aba" aria-label="Filtrar" className="field !w-64" />
        <select name="ordem" defaultValue={ordem} aria-label="Ordenar" className="field !w-44">
          <option value="recentes">Mais recentes</option>
          <option value="az">Ordem alfabética</option>
        </select>
        <button className="btn-outline">Aplicar</button>
        {(q || ordem !== "recentes") && <Link href={base("")} className="text-sm text-white/55 underline">Limpar</Link>}
      </form>

      {aba === "playlists" && (mine.length ? <div className={grid}>{mine.map((p) => <PlaylistCardC key={p.id} p={p} />)}</div> : <Empty title="Nenhuma playlist" text="Crie playlists para organizar suas músicas." action={<NewPlaylistButton />} />)}
      {aba === "salvas" && (saved.length ? <div className={grid}>{saved.map((p) => <PlaylistCardC key={p.id} p={p} />)}</div> : <Empty title="Nenhuma playlist salva" text="Salve playlists públicas para encontrá-las aqui." />)}
      {aba === "albuns" && (albs.length ? <div className={grid}>{albs.map((a) => <AlbumCardC key={a.id} a={a} />)}</div> : <Empty title="Nenhum álbum salvo" text="Use “Salvar álbum” na página do álbum." />)}
      {aba === "artistas" && (arts.length ? <div className={grid}>{arts.map((a) => <ArtistCardC key={a.id} a={a} />)}</div> : <Empty title="Você ainda não segue artistas" text="Siga artistas para vê-los aqui." />)}
      {aba === "curtidas" && (
        <>
          <div className="mb-4 flex items-center gap-4"><PlayAllButton tracks={liked} size="md" /><span className="text-sm text-white/55">{liked.length} músicas curtidas</span></div>
          <TrackList tracks={liked} emptyText="Toque no coração de uma música para salvá-la aqui." />
        </>
      )}
      {aba === "recentes" && <TrackList tracks={recent} emptyText="Reproduza músicas para ver seus conteúdos recentes." />}
    </div>
  );
}
