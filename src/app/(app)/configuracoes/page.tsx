import { getCurrentUser, requireUser } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { PageHeader } from "@/components/Cards";
import { DeleteAccountForm, ExportButton, PasswordForm, PrivacyForm, ProfileForm, VerifyEmailBox } from "@/components/Misc";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  await requireUser();
  const u = (await getCurrentUser())!;
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader eyebrow="Conta" title="Configurações" />
      <div className="space-y-6">
        <section className="panel"><h2 className="mb-4 text-lg font-bold">Perfil</h2><ProfileForm user={{ displayName: u.displayName, username: u.username, bio: u.bio, avatarUrl: u.avatarUrl }} /></section>
        <section className="panel"><h2 className="mb-4 text-lg font-bold">Privacidade</h2><PrivacyForm user={u} /></section>
        <section className="panel">
          <h2 className="mb-1 text-lg font-bold">E-mail</h2>
          <p className="mb-3 text-sm text-white/55">{u.email}</p>
          <VerifyEmailBox verified={!!u.emailVerifiedAt} configured={emailConfigured()} />
        </section>
        <section className="panel"><h2 className="mb-4 text-lg font-bold">Senha</h2><PasswordForm /></section>
        <section className="panel">
          <h2 className="mb-2 text-lg font-bold">Seus dados</h2>
          <p className="mb-4 text-sm text-white/55">Baixe uma cópia do seu perfil, curtidas, playlists e histórico em JSON.</p>
          <ExportButton />
        </section>
        <section className="panel"><h2 className="mb-4 text-lg font-bold">Excluir conta</h2><DeleteAccountForm /></section>
      </div>
    </div>
  );
}
