"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  changePasswordAction, clearHistory, createPlaylist, deleteAccountAction, exportMyData, markNotificationsRead, resendVerification,
  updatePrivacyAction, updateProfileAction, type FormState,
} from "@/app/actions";
import { useUi } from "@/components/UiProvider";
import { IconPlus } from "@/components/Icons";

export function NewPlaylistButton() {
  const ui = useUi();
  const router = useRouter();
  return (
    <button
      className="btn-primary"
      onClick={async () => {
        if (ui.needLogin()) return;
        const r = await createPlaylist("Nova playlist");
        if (!r.ok) return ui.toast(r.error, "error");
        router.push(`/playlist/${r.id}`);
        router.refresh();
      }}
    >
      <IconPlus size={16} /> Nova playlist
    </button>
  );
}

export function ClearHistoryButton() {
  const ui = useUi();
  const router = useRouter();
  return (
    <button
      className="btn-danger"
      onClick={async () => {
        if (!confirm("Limpar todo o seu histórico de reprodução?")) return;
        const r = await clearHistory();
        if (!r.ok) return ui.toast(r.error, "error");
        ui.toast("Histórico limpo.");
        router.refresh();
      }}
    >
      Limpar histórico
    </button>
  );
}

export function MarkRead({ has }: { has: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (has) markNotificationsRead().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return s.error ? <p role="alert" className="text-sm text-white/85">Erro: {s.error}</p> : s.ok ? <p role="status" className="text-sm text-white/70">{s.ok}</p> : null;
}

export function ProfileForm({ user }: { user: { displayName: string; username: string; bio: string; avatarUrl: string | null } }) {
  const [s, a, p] = useActionState<FormState, FormData>(updateProfileAction, undefined);
  return (
    <form action={a} className="space-y-4">
      <div><label className="label" htmlFor="dn">Nome de exibição</label><input id="dn" name="displayName" defaultValue={user.displayName} maxLength={60} required className="field" /></div>
      <div><label className="label" htmlFor="un">Nome de usuário</label><input id="un" name="username" defaultValue={user.username} maxLength={24} pattern="[a-z0-9_]{3,24}" className="field" /></div>
      <div><label className="label" htmlFor="bio">Biografia</label><textarea id="bio" name="bio" defaultValue={user.bio} maxLength={300} rows={3} className="field" /></div>
      <div><label className="label" htmlFor="av">Foto de perfil (JPG, PNG ou WebP até 4 MB)</label><input id="av" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="field" />
        {user.avatarUrl && <label className="mt-2 flex items-center gap-2 text-sm text-white/70"><input type="checkbox" name="removeAvatar" value="1" /> Remover foto atual</label>}
      </div>
      <Msg s={s} />
      <button disabled={p} className="btn-primary">{p ? "Salvando…" : "Salvar perfil"}</button>
    </form>
  );
}

export function PrivacyForm({ user }: { user: { profilePublic: boolean; historyPrivate: boolean; showActivity: boolean; recordHistory: boolean } }) {
  const [s, a, p] = useActionState<FormState, FormData>(updatePrivacyAction, undefined);
  const Row = ({ name, label, hint, on }: { name: string; label: string; hint: string; on: boolean }) => (
    <label className="flex items-start gap-3"><input type="checkbox" name={name} defaultChecked={on} className="mt-1" /><span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-white/50">{hint}</span></span></label>
  );
  return (
    <form action={a} className="space-y-4">
      <Row name="profilePublic" label="Perfil público" hint="Outras pessoas podem encontrar seu perfil e seguir você." on={user.profilePublic} />
      <Row name="showActivity" label="Mostrar minha atividade aos seguidores" hint="Seus seguidores veem o que você ouviu por último." on={user.showActivity} />
      <Row name="historyPrivate" label="Manter meu histórico privado" hint="Nunca exibe seu histórico no perfil ou na atividade." on={user.historyPrivate} />
      <Row name="recordHistory" label="Registrar histórico de reprodução" hint="Desative para pausar o registro (afeta recomendações)." on={user.recordHistory} />
      <Msg s={s} />
      <button disabled={p} className="btn-primary">{p ? "Salvando…" : "Salvar preferências"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [s, a, p] = useActionState<FormState, FormData>(changePasswordAction, undefined);
  return (
    <form action={a} className="space-y-4">
      <div><label className="label" htmlFor="cur">Senha atual</label><input id="cur" name="current" type="password" autoComplete="current-password" required className="field" /></div>
      <div><label className="label" htmlFor="np">Nova senha</label><input id="np" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" /></div>
      <Msg s={s} />
      <button disabled={p} className="btn-primary">{p ? "Alterando…" : "Alterar senha"}</button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [s, a, p] = useActionState<FormState, FormData>(deleteAccountAction, undefined);
  return (
    <form action={a} onSubmit={(e) => !confirm("Esta ação é permanente. Excluir minha conta e todos os meus dados?") && e.preventDefault()} className="space-y-4">
      <p className="text-sm text-white/60">Remove sua conta, biblioteca, histórico, seguidores e playlists. Não pode ser desfeito.</p>
      <div><label className="label" htmlFor="dpw">Confirme sua senha</label><input id="dpw" name="password" type="password" required className="field" /></div>
      <Msg s={s} />
      <button disabled={p} className="btn-danger">Excluir minha conta</button>
    </form>
  );
}

export function ExportButton() {
  const ui = useUi();
  return (
    <button
      className="btn-outline"
      onClick={async () => {
        try {
          const json = await exportMyData();
          const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "meus-dados.json";
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          ui.toast((e as Error).message, "error");
        }
      }}
    >
      Exportar meus dados
    </button>
  );
}

export function VerifyEmailBox({ verified, configured }: { verified: boolean; configured: boolean }) {
  const ui = useUi();
  const [busy, setBusy] = useState(false);
  if (verified) return <p className="text-sm text-white/70">E-mail verificado.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-white/70">Seu e-mail ainda não foi verificado.</p>
      {configured ? (
        <button disabled={busy} className="btn-outline" onClick={async () => { setBusy(true); const r = await resendVerification(); setBusy(false); r.ok ? ui.toast("E-mail de verificação enviado.") : ui.toast(r.error, "error"); }}>Reenviar e-mail de verificação</button>
      ) : (
        <p className="text-xs text-white/45">O envio de e-mails não está configurado nesta instalação (defina RESEND_API_KEY e EMAIL_FROM).</p>
      )}
    </div>
  );
}
