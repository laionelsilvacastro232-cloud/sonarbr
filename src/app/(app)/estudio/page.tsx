import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { artistPosts, artists, tracks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { PageHeader } from "@/components/Cards";
import { StudioForms } from "@/components/StudioForms";
import { StudioRowActions } from "@/components/StudioActions";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Estúdio do artista" };
export const dynamic = "force-dynamic";

export default async function Studio({ searchParams }: { searchParams: Promise<{ faixa?: string; post?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;

  /* -------- status da conta -------- */
  const approved = (u.role === "artist" || u.role === "admin") && !!u.artistId;
  const status = (
    <section className="panel mb-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-white/45">Status da conta</h2>
      <ul className="grid gap-3 text-sm sm:grid-cols-3">
        <li className="rounded-lg border border-white/10 p-3">
          <span className="block text-xs text-white/40">Conta</span>
          <span className="font-semibold">{u.role === "admin" ? "Administradora" : approved ? "Artista aprovado" : u.artistRequest ? "Artista · pedido em análise" : "Conta comum"}</span>
        </li>
        <li className="rounded-lg border border-white/10 p-3">
          <span className="block text-xs text-white/40">E-mail</span>
          <span className="font-semibold">{u.emailVerifiedAt ? "Verificado" : emailConfigured() ? "Não verificado" : "Verificação indisponível (e-mail não configurado)"}</span>
        </li>
        <li className="rounded-lg border border-white/10 p-3">
          <span className="block text-xs text-white/40">Publicações</span>
          <span className="font-semibold">{approved ? "Envio e publicação liberados" : "Aguardando aprovação artística"}</span>
        </li>
      </ul>
      {!approved && (
        <p className="mt-4 rounded-lg border border-white/15 bg-white/[0.05] p-4 text-sm text-white/70">
          Seu perfil artístico ainda não foi aprovado pela equipe. Enquanto isso você pode completar seu cadastro e enviar suas faixas para análise: elas só serão publicadas após a aprovação. A aprovação é feita em <b>Admin → Usuários</b> e é independente da verificação do e-mail.
        </p>
      )}
    </section>
  );

  /* -------- área restrita -------- */
  if (u.role === "user") {
    return (
      <div className="mx-auto max-w-[760px]">
        <PageHeader eyebrow="Artistas" title="Estúdio do artista" />
        {status}
        <div className="panel">
          <p className="text-sm text-white/70">
            {u.artistRequest
              ? "Seu pedido de conta de artista está em análise pela equipe. Avisaremos por notificação quando ele for aprovado."
              : "Esta área é exclusiva para contas de artista aprovadas. Se você é artista, crie a conta marcando “Sou artista” na tela de cadastro ou peça à administração para habilitar seu perfil."}
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/" className="btn-outline">Voltar ao início</Link>
            <Link href="/configuracoes" className="btn-outline">Minha conta</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!u.artistId) {
    return (
      <div className="mx-auto max-w-[760px]">
        <PageHeader eyebrow="Artistas" title="Estúdio do artista" />
        {status}
        <div className="panel text-sm text-white/70">Sua conta ainda não está vinculada a um perfil de artista. A administração fará o vínculo em Admin → Usuários → Aprovar artista.</div>
      </div>
    );
  }

  const [artist, mine, posts] = await Promise.all([
    db.select().from(artists).where(eq(artists.id, u.artistId)).limit(1),
    db.select().from(tracks).where(eq(tracks.artistId, u.artistId)).orderBy(desc(tracks.createdAt)).limit(100),
    db.select().from(artistPosts).where(eq(artistPosts.artistId, u.artistId)).orderBy(desc(artistPosts.createdAt)).limit(100),
  ]);
  const a = artist[0];
  // edição: só carrega itens que pertencem ao artista autenticado
  const editTrack = sp.faixa ? mine.find((t) => t.id === sp.faixa) : undefined;
  const editPost = sp.post ? posts.find((p) => p.id === sp.post) : undefined;

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader eyebrow="Artistas" title={`Estúdio · ${a?.name ?? ""}`}>
        {a && <Link href={`/artista/${a.id}`} className="btn-outline">Ver meu perfil público</Link>}
      </PageHeader>
      {status}
      <StudioForms
        bio={a?.bio ?? ""}
        name={a?.name ?? ""}
        links={(a?.links ?? []).map((l) => `${l.label}|${l.url}`).join("\n")}
        editTrack={editTrack}
        editPost={editPost}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Suas faixas</h2>
        <div className="panel overflow-x-auto !p-0">
          <table className="tbl">
            <thead><tr><th>Título</th><th>Status</th><th>Fonte</th><th>Enviada</th><th /></tr></thead>
            <tbody>
              {mine.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}{t.featuring ? ` (feat. ${t.featuring})` : ""}</td>
                  <td>{t.status === "published" ? "Publicada" : t.status === "pending" ? "Em revisão" : "Rascunho"}</td>
                  <td className="text-white/55">{t.sourceType === "upload" ? "Arquivo enviado" : t.sourceType === "external" ? "Link externo" : t.audioUrl ? "URL licenciada" : "sem áudio"}</td>
                  <td>{fmtDate(t.createdAt)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      {t.status === "published" && <Link className="underline" href={`/musica/${t.id}`}>Abrir</Link>}
                      <StudioRowActions kind="track" id={t.id} status={t.status} />
                    </div>
                  </td>
                </tr>
              ))}
              {mine.length === 0 && <tr><td colSpan={5} className="text-white/45">Nenhuma faixa enviada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Novidades publicadas</h2>
        {posts.length === 0 && <p className="text-sm text-white/45">Você ainda não publicou novidades para seus ouvintes.</p>}
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id} className="panel !p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.title} <span className="ml-2 text-xs font-normal text-white/40">{p.status === "published" ? "Publicada" : "Rascunho"} · {fmtDate(p.createdAt)}</span></p>
                  {p.body && <p className="mt-1 whitespace-pre-line text-sm text-white/60">{p.body}</p>}
                </div>
                <StudioRowActions kind="post" id={p.id} status={p.status} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
