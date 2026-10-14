import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlistTracks, playlists, tracks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, playable, queryTracks, queryPlaylists, type TrackDetail } from "@/lib/queries";
import { Cover } from "@/components/Cover";
import { LikeButton, PlayAllButton, ReportButton, ShareButton } from "@/components/Interactive";
import { TrackList } from "@/components/TrackList";
import { PlaylistCardC, Shelf } from "@/components/Cards";
import { fmtDate, fmtDuration } from "@/lib/format";
import { IconExternal } from "@/components/Icons";

export const dynamic = "force-dynamic";

async function load(id: string, uid?: string | null) {
  if (!isUuid(id)) return null;
  const [t] = await queryTracks({ where: eq(tracks.id, id), userId: uid, limit: 1 });
  if (!t) return null;
  const [d] = await db.select({ credits: tracks.credits, licenseNote: tracks.licenseNote, releaseDate: tracks.releaseDate, playCount: tracks.playCount }).from(tracks).where(eq(tracks.id, id));
  return { ...t, ...d } as TrackDetail;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = await load((await params).id);
  return t ? { title: `${t.title} — ${t.artistName}`, openGraph: { title: t.title, description: `${t.artistName}${t.albumTitle ? ` · ${t.albumTitle}` : ""}`, images: t.coverUrl ? [t.coverUrl] : [] } } : { title: "Música não encontrada" };
}

const SOURCE: Record<string, string> = {
  upload: "Enviado pelo artista / detentor dos direitos",
  url: "Fonte licenciada ou de uso livre",
  preview: "Prévia oficial de 30 segundos (API pública do iTunes)",
  jamendo: "Jamendo — licença Creative Commons",
  external: "Somente link para a fonte original",
};

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const t = await load(id, user?.id);
  if (!t) notFound();
  const [more, pls] = await Promise.all([
    queryTracks({ where: and(eq(tracks.artistId, t.artistId), ne(tracks.id, t.id)), userId: user?.id, limit: 5 }),
    queryPlaylists({
      where: and(eq(playlists.isPublic, true), sql`exists(select 1 from ${playlistTracks} pt where pt.playlist_id = ${playlists.id} and pt.track_id = ${t.id})`),
      limit: 10,
    }),
  ]);
  void desc;
  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-col items-center gap-6 pt-4 sm:flex-row sm:items-end">
        <div className="w-56 shrink-0 shadow-2xl shadow-black sm:w-60"><Cover src={t.coverUrl} seed={t.albumId ?? t.id} title={t.title} /></div>
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Música</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-6xl">{t.title}</h1>
          <p className="mt-3 text-sm text-white/70">
            <Link href={`/artista/${t.artistId}`} className="font-semibold text-white hover:underline">{t.artistName}</Link>
            {t.featuring && <> · feat. {t.featuring}</>}
            {t.albumId && <> · <Link href={`/album/${t.albumId}`} className="hover:underline">{t.albumTitle}</Link></>}
            {t.releaseDate && <> · {fmtDate(t.releaseDate)}</>} · {fmtDuration(t.durationSec)}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <PlayAllButton tracks={[t]} />
        <LikeButton track={t} />
        <ShareButton path={`/musica/${t.id}`} title={`${t.title} — ${t.artistName}`} />
        <ReportButton type="track" id={t.id} label={t.title} />
        {t.externalUrl && (
          <a href={t.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-outline"><IconExternal size={16} /> Abrir na fonte original</a>
        )}
      </div>
      {!playable(t) && (
        <p className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
          Esta faixa não possui áudio liberado para reprodução nesta plataforma{t.externalUrl ? ". Você pode ouvi-la na fonte original pelo botão acima." : "."}
        </p>
      )}

      <section className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="panel">
          <h2 className="mb-3 font-bold">Créditos</h2>
          <p className="whitespace-pre-line text-sm text-white/70">{t.credits || "Créditos não informados para esta faixa."}</p>
        </div>
        <div className="panel">
          <h2 className="mb-3 font-bold">Detalhes</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm text-white/70">
            <dt className="text-white/40">Gênero</dt><dd>{t.genre || "—"}</dd>
            <dt className="text-white/40">Disponibilidade</dt><dd>{t.availability === "available" ? "Disponível" : t.availability === "external_only" ? "Somente fonte externa" : "Indisponível"}</dd>
            <dt className="text-white/40">Fonte de áudio</dt><dd>{SOURCE[t.sourceType] ?? t.sourceType}</dd>
            <dt className="text-white/40">Reproduções</dt><dd>{t.playCount}</dd>
            {t.licenseNote && (<><dt className="text-white/40">Licença</dt><dd>{t.licenseNote}</dd></>)}
          </dl>
        </div>
      </section>

      {more.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold">Mais de {t.artistName}</h2>
          <TrackList tracks={more} />
        </section>
      )}
      {pls.length > 0 && <div className="mt-10"><Shelf title="Em playlists públicas">{pls.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf></div>}
    </div>
  );
}
