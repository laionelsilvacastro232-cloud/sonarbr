import Link from "next/link";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { albums, artists, tracks } from "@/db/schema";
import {
  checkAllTracks, checkTrack, deleteAlbum, deleteArtist, deleteTrack, importFromItunes, importFromJamendo, saveAlbum, saveArtist, saveTrack, setTrackStatus,
} from "@/app/admin/actions";
import { ABtn, AForm } from "@/components/AdminUi";

export const metadata = { title: "Conteúdo musical" };
export const dynamic = "force-dynamic";
const PER = 40;

type SP = { aba?: string; q?: string; p?: string; edit?: string; novo?: string };

export default async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const aba = sp.aba ?? "musicas";
  const page = Math.max(1, parseInt(sp.p ?? "1") || 1);
  const q = (sp.q ?? "").trim();
  const like = `%${q}%`;
  const allArtists = await db.select({ id: artists.id, name: artists.name }).from(artists).orderBy(asc(artists.name)).limit(500);
  const allAlbums = await db.select({ id: albums.id, title: albums.title }).from(albums).orderBy(asc(albums.title)).limit(500);
  const tabs = [["musicas", "Músicas"], ["artistas", "Artistas"], ["albuns", "Álbuns"], ["importar", "Importar e verificar"]];

  const pager = (n: number) => (
    <div className="mt-4 flex justify-between">
      {page > 1 ? <Link className="btn-outline" href={`/admin/conteudo?aba=${aba}&q=${encodeURIComponent(q)}&p=${page - 1}`}>Anterior</Link> : <span />}
      {n > PER && <Link className="btn-outline" href={`/admin/conteudo?aba=${aba}&q=${encodeURIComponent(q)}&p=${page + 1}`}>Próxima</Link>}
    </div>
  );
  const search = (
    <form className="mb-4 flex gap-2" action="/admin/conteudo">
      <input type="hidden" name="aba" value={aba} />
      <input name="q" defaultValue={q} placeholder="Buscar" className="field !w-72" />
      <button className="btn-outline">Buscar</button>
      <Link href={`/admin/conteudo?aba=${aba}&novo=1`} className="btn-primary !h-10">Novo</Link>
    </form>
  );

  let body;
  if (aba === "musicas") {
    const edit = sp.edit ? (await db.select().from(tracks).where(eq(tracks.id, sp.edit)).limit(1))[0] : undefined;
    const rows = await db
      .select({ t: tracks, artist: artists.name })
      .from(tracks)
      .innerJoin(artists, eq(artists.id, tracks.artistId))
      .where(q ? or(ilike(tracks.title, like), ilike(artists.name, like)) : undefined)
      .orderBy(desc(tracks.createdAt))
      .limit(PER + 1)
      .offset((page - 1) * PER);
    body = (
      <>
        {(edit || sp.novo) && (
          <section className="panel mb-6">
            <h2 className="mb-4 font-bold">{edit ? "Editar faixa" : "Nova faixa"}</h2>
            <AForm action={saveTrack} submit="Salvar faixa" className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" defaultValue={edit?.id} />
              <F label="Título"><input name="title" required defaultValue={edit?.title} className="field" /></F>
              <F label="Artista"><select name="artistId" required defaultValue={edit?.artistId} className="field"><option value="">Selecione</option>{allArtists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></F>
              <F label="Álbum"><select name="albumId" defaultValue={edit?.albumId ?? ""} className="field"><option value="">Sem álbum (faixa avulsa)</option>{allAlbums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></F>
              <F label="Nº da faixa"><input name="trackNumber" type="number" min={1} defaultValue={edit?.trackNumber ?? 1} className="field" /></F>
              <F label="Participações"><input name="featuring" defaultValue={edit?.featuring} className="field" /></F>
              <F label="Gênero"><input name="genre" defaultValue={edit?.genre} className="field" /></F>
              <F label="Duração (segundos; 0 = detectar na primeira reprodução)"><input name="durationSec" type="number" min={0} defaultValue={edit?.durationSec ?? 0} className="field" /></F>
              <F label="Data de lançamento"><input name="releaseDate" type="date" defaultValue={edit?.releaseDate ?? ""} className="field" /></F>
              <F label="Enviar áudio (MP3/M4A/OGG/WAV/FLAC, até 40 MB)"><input name="audio" type="file" accept="audio/*" className="field" /></F>
              <F label="ou URL de áudio licenciada"><input name="audioUrl" defaultValue={edit?.audioUrl && !edit.audioUrl.startsWith("/media/") ? edit.audioUrl : ""} placeholder="https://…" className="field" /></F>
              <F label="Tipo de fonte"><select name="sourceType" defaultValue={edit?.sourceType ?? "url"} className="field"><option value="url">URL licenciada / uso livre</option><option value="upload">Upload próprio</option><option value="preview">Prévia oficial</option><option value="jamendo">Jamendo (CC)</option><option value="external">Somente link externo</option></select></F>
              <F label="Link da fonte original"><input name="externalUrl" defaultValue={edit?.externalUrl ?? ""} className="field" /></F>
              <F label="Licença / autorização"><input name="licenseNote" defaultValue={edit?.licenseNote} placeholder="Ex.: autorizado pelo titular em 01/2026" className="field" /></F>
              <F label="Capa (imagem)"><input name="cover" type="file" accept="image/*" className="field" /></F>
              <F label="ou URL da capa"><input name="coverUrl" className="field" /></F>
              <F label="Disponibilidade"><select name="availability" defaultValue={edit?.availability ?? "available"} className="field"><option value="available">Disponível</option><option value="external_only">Somente fonte externa</option><option value="unavailable">Indisponível</option></select></F>
              <F label="Status"><select name="status" defaultValue={edit?.status ?? "draft"} className="field"><option value="published">Publicada</option><option value="draft">Rascunho</option><option value="pending">Em revisão</option></select></F>
              <div className="md:col-span-2"><F label="Créditos"><textarea name="credits" rows={3} defaultValue={edit?.credits} className="field" /></F></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="explicit" defaultChecked={edit?.explicit} /> Conteúdo explícito</label>
            </AForm>
          </section>
        )}
        {search}
        <div className="panel overflow-x-auto !p-0">
          <table className="tbl">
            <thead><tr><th>Título</th><th>Artista</th><th>Fonte</th><th>Status</th><th>Plays</th><th>Ações</th></tr></thead>
            <tbody>
              {rows.slice(0, PER).map(({ t, artist }) => (
                <tr key={t.id}>
                  <td className="max-w-[240px] truncate">{t.title}</td>
                  <td>{artist}</td>
                  <td className="text-white/55">{t.sourceType}{!t.audioUrl && " · sem áudio"}</td>
                  <td>{t.status === "published" ? "Publicada" : t.status === "pending" ? "Em revisão" : "Rascunho"}</td>
                  <td>{t.playCount}</td>
                  <td>
                    <div className="flex flex-wrap items-start gap-2">
                      <Link className="btn-outline !h-8 !px-3 !text-xs" href={`/admin/conteudo?aba=musicas&edit=${t.id}`}>Editar</Link>
                      <ABtn run={setTrackStatus.bind(null, t.id, t.status === "published" ? "draft" : "published")} label={t.status === "published" ? "Despublicar" : "Publicar"} />
                      {t.audioUrl && <ABtn run={checkTrack.bind(null, t.id)} label="Verificar fonte" />}
                      <ABtn run={deleteTrack.bind(null, t.id)} label="Remover" danger confirmText={`Remover "${t.title}"?`} />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="text-white/45">Nenhuma faixa.</td></tr>}
            </tbody>
          </table>
        </div>
        {pager(rows.length)}
      </>
    );
  } else if (aba === "artistas") {
    const edit = sp.edit ? (await db.select().from(artists).where(eq(artists.id, sp.edit)).limit(1))[0] : undefined;
    const rows = await db
      .select({ a: artists, n: sql<number>`(select count(*)::int from tracks t where t.artist_id = ${artists.id})` })
      .from(artists)
      .where(q ? ilike(artists.name, like) : undefined)
      .orderBy(asc(artists.name))
      .limit(PER + 1)
      .offset((page - 1) * PER);
    body = (
      <>
        {(edit || sp.novo) && (
          <section className="panel mb-6">
            <h2 className="mb-4 font-bold">{edit ? "Editar artista" : "Novo artista"}</h2>
            <AForm action={saveArtist} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" defaultValue={edit?.id} />
              <F label="Nome"><input name="name" required defaultValue={edit?.name} className="field" /></F>
              <F label="Foto autorizada (arquivo)"><input name="image" type="file" accept="image/*" className="field" /></F>
              <F label="ou URL da foto"><input name="imageUrl" className="field" /></F>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={edit?.published ?? true} /> Publicado</label>
              <div className="md:col-span-2"><F label="Biografia"><textarea name="bio" rows={4} defaultValue={edit?.bio} className="field" /></F></div>
              <div className="md:col-span-2"><F label="Links oficiais (um por linha: Rótulo|https://…)"><textarea name="links" rows={3} defaultValue={edit?.links.map((l) => `${l.label}|${l.url}`).join("\n")} className="field" /></F></div>
            </AForm>
          </section>
        )}
        {search}
        <div className="panel overflow-x-auto !p-0">
          <table className="tbl">
            <thead><tr><th>Nome</th><th>Faixas</th><th>Origem</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {rows.slice(0, PER).map(({ a, n }) => (
                <tr key={a.id}>
                  <td>{a.name}</td><td>{n}</td><td className="text-white/55">{a.externalSource ?? "manual"}</td><td>{a.published ? "Publicado" : "Oculto"}</td>
                  <td><div className="flex gap-2"><Link className="btn-outline !h-8 !px-3 !text-xs" href={`/admin/conteudo?aba=artistas&edit=${a.id}`}>Editar</Link><ABtn run={deleteArtist.bind(null, a.id)} label="Remover" danger confirmText={`Remover ${a.name} e todo o seu conteúdo?`} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pager(rows.length)}
      </>
    );
  } else if (aba === "albuns") {
    const edit = sp.edit ? (await db.select().from(albums).where(eq(albums.id, sp.edit)).limit(1))[0] : undefined;
    const rows = await db
      .select({ a: albums, artist: artists.name, n: sql<number>`(select count(*)::int from tracks t where t.album_id = ${albums.id})` })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(q ? or(ilike(albums.title, like), ilike(artists.name, like)) : undefined)
      .orderBy(desc(albums.createdAt))
      .limit(PER + 1)
      .offset((page - 1) * PER);
    body = (
      <>
        {(edit || sp.novo) && (
          <section className="panel mb-6">
            <h2 className="mb-4 font-bold">{edit ? "Editar álbum" : "Novo álbum"}</h2>
            <AForm action={saveAlbum} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" defaultValue={edit?.id} />
              <F label="Título"><input name="title" required defaultValue={edit?.title} className="field" /></F>
              <F label="Artista"><select name="artistId" required defaultValue={edit?.artistId} className="field"><option value="">Selecione</option>{allArtists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></F>
              <F label="Tipo"><select name="kind" defaultValue={edit?.kind ?? "album"} className="field"><option value="album">Álbum</option><option value="single">Single</option><option value="ep">EP</option></select></F>
              <F label="Lançamento"><input name="releaseDate" type="date" defaultValue={edit?.releaseDate ?? ""} className="field" /></F>
              <F label="Capa (arquivo)"><input name="cover" type="file" accept="image/*" className="field" /></F>
              <F label="ou URL da capa"><input name="coverUrl" className="field" /></F>
              <div className="md:col-span-2"><F label="Créditos"><textarea name="credits" rows={3} defaultValue={edit?.credits} className="field" /></F></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={edit?.published ?? true} /> Publicado</label>
            </AForm>
            <p className="mt-3 text-xs text-white/45">Para associar faixas ao álbum, edite a faixa e escolha o álbum e o número da faixa.</p>
          </section>
        )}
        {search}
        <div className="panel overflow-x-auto !p-0">
          <table className="tbl">
            <thead><tr><th>Título</th><th>Artista</th><th>Tipo</th><th>Faixas</th><th>Ações</th></tr></thead>
            <tbody>
              {rows.slice(0, PER).map(({ a, artist, n }) => (
                <tr key={a.id}>
                  <td>{a.title}</td><td>{artist}</td><td>{a.kind}</td><td>{n}</td>
                  <td><div className="flex gap-2"><Link className="btn-outline !h-8 !px-3 !text-xs" href={`/admin/conteudo?aba=albuns&edit=${a.id}`}>Editar</Link><ABtn run={deleteAlbum.bind(null, a.id)} label="Remover" danger confirmText={`Remover o álbum ${a.title}?`} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pager(rows.length)}
      </>
    );
  } else {
    body = (
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="mb-1 font-bold">Importar do iTunes Search API</h2>
          <p className="mb-4 text-sm text-white/50">Importa metadados, capas e <b>prévias oficiais de 30 s</b> com link para a faixa completa na fonte original. Não exige chave.</p>
          <AForm action={importFromItunes} submit="Importar" resetOnOk>
            <F label="Artista, álbum ou faixa"><input name="term" required className="field" /></F>
            <F label="Quantidade (até 25)"><input name="limit" type="number" min={1} max={25} defaultValue={10} className="field" /></F>
          </AForm>
        </section>
        <section className="panel">
          <h2 className="mb-1 font-bold">Importar do Jamendo</h2>
          <p className="mb-4 text-sm text-white/50">Músicas independentes com licenças Creative Commons e reprodução integral. Requer <code>JAMENDO_CLIENT_ID</code> no ambiente (gratuito para uso não comercial; uso comercial exige licenciamento com a Jamendo). {process.env.JAMENDO_CLIENT_ID ? "Chave configurada." : "Chave ainda não configurada."}</p>
          <AForm action={importFromJamendo} submit="Importar" resetOnOk>
            <F label="Termo de busca"><input name="term" required className="field" /></F>
          </AForm>
        </section>
        <section className="panel lg:col-span-2">
          <h2 className="mb-1 font-bold">Verificar fontes de áudio</h2>
          <p className="mb-4 text-sm text-white/50">Faz uma requisição a cada URL de áudio publicada e registra falhas no painel de erros.</p>
          <ABtn run={checkAllTracks} label="Verificar todas as faixas publicadas" small={false} />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Conteúdo musical</h1>
      <div className="mb-6 flex gap-2 overflow-x-auto">{tabs.map(([k, l]) => <Link key={k} href={`/admin/conteudo?aba=${k}`} data-active={aba === k} className="chip shrink-0">{l}</Link>)}</div>
      {body}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
