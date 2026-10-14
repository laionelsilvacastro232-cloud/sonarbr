"use client";

import { useActionState } from "react";
import Link from "next/link";
import { studioCreatePost, studioCreateTrack, studioUpdateArtist, studioUpdatePost, studioUpdateTrack, type FormState } from "@/app/actions";

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return s.error ? <p role="alert" className="text-sm text-white/85">Erro: {s.error}</p> : s.ok ? <p role="status" className="text-sm text-white/70">{s.ok}</p> : null;
}

type TrackRow = { id: string; title: string; genre: string; featuring: string; credits: string; externalUrl: string | null; audioUrl: string | null; availability: string; status: string; licenseNote: string; releaseDate: string | null };
type PostRow = { id: string; title: string; body: string; coverUrl: string | null; status: string };

export function StudioForms({
  bio, name, links, editTrack, editPost,
}: {
  bio: string;
  name: string;
  links: string;
  editTrack?: TrackRow;
  editPost?: PostRow;
}) {
  const [s1, a1, p1] = useActionState<FormState, FormData>(studioCreateTrack, undefined);
  const [s2, a2, p2] = useActionState<FormState, FormData>(studioUpdateArtist, undefined);
  const [s3, a3, p3] = useActionState<FormState, FormData>(studioUpdateTrack, undefined);
  const [s4, a4, p4] = useActionState<FormState, FormData>(studioCreatePost, undefined);
  const [s5, a5, p5] = useActionState<FormState, FormData>(studioUpdatePost, undefined);

  return (
    <div className="space-y-6">
      {/* ---------- perfil artístico ---------- */}
      <form action={a2} className="panel space-y-4">
        <h2 className="text-lg font-bold">Perfil artístico</h2>
        <p className="-mt-2 text-xs text-white/45">O que você salvar aqui aparece na sua página pública de artista e nas buscas.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="an">Nome artístico</label><input id="an" name="name" defaultValue={name} required maxLength={120} className="field" /></div>
          <div><label className="label" htmlFor="ai">Foto</label><input id="ai" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="field" /></div>
        </div>
        <div><label className="label" htmlFor="ab">Biografia</label><textarea id="ab" name="bio" defaultValue={bio} rows={5} maxLength={2000} className="field" /></div>
        <div><label className="label" htmlFor="al">Links oficiais (um por linha: Rótulo|https://…)</label><textarea id="al" name="links" defaultValue={links} rows={3} className="field" /></div>
        <Msg s={s2} />
        <button disabled={p2} className="btn-primary">{p2 ? "Salvando…" : "Salvar perfil"}</button>
      </form>

      {/* ---------- faixa ---------- */}
      <form action={editTrack ? a3 : a1} className="panel space-y-4">
        <h2 className="text-lg font-bold">{editTrack ? "Editar faixa" : "Publicar música"}</h2>
        {editTrack && <input type="hidden" name="id" value={editTrack.id} />}
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="st">Título *</label><input id="st" name="title" required maxLength={150} defaultValue={editTrack?.title} className="field" /></div>
          <div><label className="label" htmlFor="sg">Gênero</label><input id="sg" name="genre" maxLength={40} defaultValue={editTrack?.genre} className="field" /></div>
          <div><label className="label" htmlFor="sf">Participações</label><input id="sf" name="featuring" maxLength={150} defaultValue={editTrack?.featuring} className="field" /></div>
          <div><label className="label" htmlFor="sd">Data de lançamento</label><input id="sd" name="releaseDate" type="date" defaultValue={editTrack?.releaseDate ?? ""} className="field" /></div>
          <div><label className="label" htmlFor="sa">{editTrack ? "Trocar arquivo de áudio" : "Arquivo de áudio (MP3, M4A, OGG, WAV ou FLAC até 40 MB)"}</label><input id="sa" name="audio" type="file" accept="audio/*" className="field" /></div>
          <div><label className="label" htmlFor="su">Link da faixa na fonte original (Spotify, YouTube, site oficial…)</label><input id="su" name="externalUrl" defaultValue={editTrack?.externalUrl ?? ""} placeholder="https://…" className="field" /></div>
          <div><label className="label" htmlFor="sv">Capa</label><input id="sv" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="field" /></div>
          <div><label className="label" htmlFor="sl">Licença / autorização</label><input id="sl" name="licenseNote" defaultValue={editTrack?.licenseNote ?? ""} className="field" /></div>
        </div>
        <div><label className="label" htmlFor="sc">Créditos</label><textarea id="sc" name="credits" rows={3} maxLength={1200} defaultValue={editTrack?.credits} className="field" /></div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="rights" className="mt-1" /> Declaro que sou o titular dos direitos ou tenho autorização para distribuir esta obra nesta plataforma.</label>
        <Msg s={s1} />
        <div className="flex flex-wrap gap-3">
          <button disabled={p1} className="btn-primary">{p1 ? "Enviando…" : editTrack ? "Salvar alterações" : "Enviar para revisão"}</button>
          {editTrack && <Link href="/estudio" className="btn-outline">Cancelar</Link>}
        </div>
        {!editTrack && <p className="text-xs text-white/45">Faixas enviadas entram em <b>revisão</b> e só aparecem para os ouvintes quando aprovadas. Se você enviar apenas o link (sem arquivo), a faixa é publicada direto e abre na fonte original.</p>}
      </form>

      {/* ---------- novidades ---------- */}
      <form action={editPost ? a5 : a4} className="panel space-y-4">
        <h2 className="text-lg font-bold">{editPost ? "Editar publicação" : "Publicar novidade"}</h2>
        {editPost && <input type="hidden" name="id" value={editPost.id} />}
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="pt">Título *</label><input id="pt" name="title" required maxLength={120} defaultValue={editPost?.title} className="field" /></div>
          <div><label className="label" htmlFor="pc">Capa da publicação</label><input id="pc" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="field" /></div>
        </div>
        <div><label className="label" htmlFor="pb">Mensagem para os ouvintes</label><textarea id="pb" name="body" rows={4} maxLength={2000} defaultValue={editPost?.body} className="field" /></div>
        <div><label className="label" htmlFor="ps">Status</label>
          <select id="ps" name="status" defaultValue={editPost?.status ?? "published"} className="field !w-56"><option value="published">Publicada</option><option value="draft">Rascunho (só você vê)</option></select>
        </div>
        <Msg s={s4} />
        {editPost && <Msg s={s5} />}
        <div className="flex flex-wrap gap-3">
          <button disabled={p4 || p5} className="btn-primary">{p4 || p5 ? "Salvando…" : editPost ? "Salvar publicação" : "Publicar"}</button>
          {editPost && <Link href="/estudio" className="btn-outline">Cancelar</Link>}
        </div>
      </form>

    </div>
  );
}
