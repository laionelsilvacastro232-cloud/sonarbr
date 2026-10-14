import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { albums, artists, homeSections, playlists, tracks } from "@/db/schema";
import { addSection, createEditorialPlaylist, deletePlaylistAdmin, deleteSection, moveSection, toggleSection } from "@/app/admin/actions";
import { ABtn, AForm } from "@/components/AdminUi";

export const metadata = { title: "Página inicial" };
export const dynamic = "force-dynamic";

const KINDS: [string, string][] = [
  ["continue", "Continue ouvindo (pessoal)"],
  ["recommended", "Recomendações (pessoal)"],
  ["my_playlists", "Playlists do usuário (pessoal)"],
  ["activity", "Atividade de quem segue (pessoal)"],
  ["new_releases", "Lançamentos (automático)"],
  ["popular_tracks", "Populares (automático)"],
  ["artists", "Artistas (automático)"],
  ["genres", "Gêneros (automático)"],
  ["public_playlists", "Playlists da comunidade (automático)"],
  ["editorial_playlists", "Playlists editoriais (automático ou escolha)"],
  ["manual_tracks", "Músicas escolhidas"],
  ["manual_albums", "Álbuns escolhidos"],
  ["manual_artists", "Artistas escolhidos"],
  ["manual_playlists", "Playlists escolhidas"],
  ["banner", "Banner / destaque"],
];

export default async function HomeAdmin() {
  const [secs, tr, al, ar, pl, ed] = await Promise.all([
    db.select().from(homeSections).orderBy(asc(homeSections.position)),
    db.select({ id: tracks.id, title: tracks.title }).from(tracks).orderBy(desc(tracks.createdAt)).limit(120),
    db.select({ id: albums.id, title: albums.title }).from(albums).orderBy(desc(albums.createdAt)).limit(120),
    db.select({ id: artists.id, name: artists.name }).from(artists).orderBy(asc(artists.name)).limit(150),
    db.select({ id: playlists.id, name: playlists.name }).from(playlists).where(eq(playlists.isPublic, true)).orderBy(desc(playlists.updatedAt)).limit(100),
    db.select({ id: playlists.id, name: playlists.name }).from(playlists).where(eq(playlists.editorial, true)),
  ]);
  const Pick = ({ title, items }: { title: string; items: { id: string; label: string }[] }) => (
    <details className="rounded-lg border border-white/10 p-3">
      <summary className="cursor-pointer text-sm font-semibold">{title} ({items.length})</summary>
      <div className="mt-2 grid max-h-52 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
        {items.map((i) => <label key={i.id} className="flex items-center gap-2"><input type="checkbox" name="itemIds" value={i.id} /> <span className="truncate">{i.label}</span></label>)}
      </div>
    </details>
  );
  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Página inicial</h1>
      <section className="panel mb-6 !p-0">
        <table className="tbl">
          <thead><tr><th>#</th><th>Seção</th><th>Tipo</th><th>Itens</th><th>Ações</th></tr></thead>
          <tbody>
            {secs.map((s, i) => (
              <tr key={s.id} className={s.enabled ? "" : "opacity-50"}>
                <td>{i + 1}</td><td>{s.title}</td><td className="text-white/55">{KINDS.find((k) => k[0] === s.kind)?.[1] ?? s.kind}</td><td>{s.itemIds.length || "auto"}</td>
                <td><div className="flex flex-wrap gap-2">
                  <ABtn run={moveSection.bind(null, s.id, "up")} label="↑" />
                  <ABtn run={moveSection.bind(null, s.id, "down")} label="↓" />
                  <ABtn run={toggleSection.bind(null, s.id, !s.enabled)} label={s.enabled ? "Ocultar" : "Exibir"} />
                  <ABtn run={deleteSection.bind(null, s.id)} label="Remover" danger confirmText="Remover esta seção?" />
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel mb-6">
        <h2 className="mb-4 font-bold">Adicionar seção</h2>
        <AForm action={addSection} submit="Adicionar seção" resetOnOk>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Tipo</label><select name="kind" required className="field">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label className="label">Título</label><input name="title" required maxLength={100} className="field" /></div>
            <div className="md:col-span-2"><label className="label">Subtítulo (opcional)</label><input name="subtitle" maxLength={160} className="field" /></div>
          </div>
          <p className="text-xs text-white/45">Para seções “escolhidas” e “editoriais”, marque os itens abaixo. Para banner, preencha os campos de banner.</p>
          <Pick title="Músicas" items={tr.map((t) => ({ id: t.id, label: t.title }))} />
          <Pick title="Álbuns" items={al.map((t) => ({ id: t.id, label: t.title }))} />
          <Pick title="Artistas" items={ar.map((t) => ({ id: t.id, label: t.name }))} />
          <Pick title="Playlists públicas / editoriais" items={pl.map((t) => ({ id: t.id, label: t.name }))} />
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Banner: texto</label><input name="text" maxLength={300} className="field" /></div>
            <div><label className="label">Banner: URL da imagem autorizada</label><input name="imageUrl" className="field" /></div>
            <div><label className="label">Banner: link (/rota ou https://…)</label><input name="href" className="field" /></div>
            <div><label className="label">Banner: texto do botão</label><input name="cta" maxLength={40} className="field" /></div>
          </div>
        </AForm>
      </section>

      <section className="panel mb-6">
        <h2 className="mb-1 font-bold">Nova playlist editorial</h2>
        <p className="mb-4 text-sm text-white/50">Playlists da casa, públicas, sem dono. Escolha as faixas e depois inclua em uma seção.</p>
        <AForm action={createEditorialPlaylist} submit="Criar playlist" resetOnOk>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Nome</label><input name="name" required maxLength={100} className="field" /></div>
            <div><label className="label">Descrição</label><input name="description" maxLength={300} className="field" /></div>
            <div><label className="label">Capa (arquivo)</label><input name="cover" type="file" accept="image/*" className="field" /></div>
            <div><label className="label">ou URL da capa</label><input name="coverUrl" className="field" /></div>
          </div>
          <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm font-semibold">Faixas ({tr.length})</summary>
            <div className="mt-2 grid max-h-52 gap-1 overflow-y-auto text-sm sm:grid-cols-2">{tr.map((t) => <label key={t.id} className="flex items-center gap-2"><input type="checkbox" name="trackIds" value={t.id} /><span className="truncate">{t.title}</span></label>)}</div>
          </details>
        </AForm>
        {ed.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">{ed.map((p) => <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"><span>{p.name}</span><ABtn run={deletePlaylistAdmin.bind(null, p.id)} label="Excluir" danger confirmText="Excluir playlist editorial?" /></li>)}</ul>
        )}
      </section>
    </div>
  );
}
