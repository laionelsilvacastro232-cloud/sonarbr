"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { addCollaborator, deletePlaylist, removeCollaborator, updatePlaylistAction, type FormState } from "@/app/actions";
import { Modal, useUi } from "@/components/UiProvider";
import { IconEdit } from "@/components/Icons";

export function PlaylistSettings({
  playlist,
  collaborators,
}: {
  playlist: { id: string; name: string; description: string; coverUrl: string | null; isPublic: boolean; collaborative: boolean };
  collaborators: { id: string; username: string; displayName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ui = useUi();
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(async (s, f) => {
    const r = await updatePlaylistAction(s, f);
    if (r?.ok) router.refresh();
    return r;
  }, undefined);
  const [collab, setCollab] = useState("");

  return (
    <>
      <button className="icon-btn" aria-label="Editar playlist" title="Editar detalhes" onClick={() => setOpen(true)}>
        <IconEdit size={20} />
      </button>
      {open && (
        <Modal title="Editar playlist" onClose={() => setOpen(false)}>
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={playlist.id} />
            <div>
              <label className="label" htmlFor="pl-name">Nome</label>
              <input id="pl-name" name="name" defaultValue={playlist.name} maxLength={100} required className="field" />
            </div>
            <div>
              <label className="label" htmlFor="pl-desc">Descrição</label>
              <textarea id="pl-desc" name="description" defaultValue={playlist.description} maxLength={300} rows={3} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="pl-cover">Capa (JPG, PNG ou WebP até 4 MB)</label>
              <input id="pl-cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="field" />
              <input name="coverUrl" placeholder="ou URL de uma imagem que você tem direito de usar" defaultValue="" className="field mt-2" />
              {playlist.coverUrl && (
                <label className="mt-2 flex items-center gap-2 text-sm text-white/70"><input type="checkbox" name="removeCover" value="1" /> Remover capa atual (usar mosaico)</label>
              )}
            </div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="isPublic" defaultChecked={playlist.isPublic} /> Playlist pública (visível para qualquer pessoa com o link e no seu perfil)</label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="collaborative" defaultChecked={playlist.collaborative} /> Playlist colaborativa (convidados podem adicionar e remover faixas)</label>
            {state?.error && <p role="alert" className="text-sm text-white/80">⚠ {state.error}</p>}
            {state?.ok && <p className="text-sm text-white/70">{state.ok}</p>}
            <button disabled={pending} className="btn-primary w-full">{pending ? "Salvando…" : "Salvar"}</button>
          </form>

          {playlist.collaborative && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="mb-3 text-sm font-bold">Colaboradores</h3>
              <div className="mb-3 flex gap-2">
                <input value={collab} onChange={(e) => setCollab(e.target.value)} placeholder="nome de usuário" className="field" />
                <button
                  className="btn-outline shrink-0"
                  onClick={async () => {
                    const r = await addCollaborator(playlist.id, collab);
                    if (!r.ok) return ui.toast(r.error, "error");
                    ui.toast("Convite enviado.");
                    setCollab("");
                    router.refresh();
                  }}
                >
                  Convidar
                </button>
              </div>
              <ul className="space-y-1 text-sm">
                {collaborators.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                    <span>{c.displayName} <span className="text-white/40">@{c.username}</span></span>
                    <button className="text-xs font-semibold text-white/60 hover:text-white" onClick={async () => { await removeCollaborator(playlist.id, c.id); router.refresh(); }}>Remover</button>
                  </li>
                ))}
                {collaborators.length === 0 && <li className="text-white/45">Nenhum colaborador ainda.</li>}
              </ul>
            </div>
          )}

          <div className="mt-6 border-t border-white/10 pt-5">
            <button
              className="btn-danger w-full"
              onClick={async () => {
                if (!confirm("Excluir esta playlist definitivamente?")) return;
                const r = await deletePlaylist(playlist.id);
                if (!r.ok) return ui.toast(r.error, "error");
                ui.toast("Playlist excluída.");
                router.push("/biblioteca");
                router.refresh();
              }}
            >
              Excluir playlist
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
