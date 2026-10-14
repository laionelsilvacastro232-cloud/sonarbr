import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { mySupportTickets } from "@/app/actions";
import { PageHeader } from "@/components/Cards";
import { SupportCenter } from "@/components/SupportUi";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Ajuda e suporte" };
export const dynamic = "force-dynamic";

const FAQ = [
  ["Não consigo criar conta", "Verifique se o nome de usuário já está em uso (o formulário avisa e mantém seus dados preenchidos). Se o e-mail já tiver sido cadastrado, entre por Ele esqueci minha senha."],
  ["Esqueci minha senha", "Em Entrar, clique em “Esqueci minha senha”. Se os e-mails estiverem configurados, você recebe um link válido por 1 hora. Se não, fale aqui pelo suporte que geramos o link para você."],
  ["Como publicar minha música", "Contas de artista precisam ser aprovadas pela equipe. Depois de aprovado, abra Estúdio do artista e envie o arquivo ou o link da faixa. Faixas com arquivo entram em revisão antes de aparecerem para todos."],
  ["Uma faixa não toca", "Algumas faixas são prévias de 30 segundos fornecidas por APIs oficiais, ou abrem na fonte original. Use “Abrir na fonte original” no menu da música."],
  ["Privacidade e histórico", "Em Configurações você pode tornar o histórico privado, pausar o registro, exportar seus dados ou excluir a conta."],
];

export default async function Help() {
  await requireUser();
  const [s, tickets] = await Promise.all([getSettings(), mySupportTickets()]);
  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader eyebrow="Ajuda" title="Ajuda e suporte" />
      <p className="mb-7 text-sm text-white/55">
        Fale com a equipe do <b>{s.siteName}</b>. Respondemos por aqui mesmo, dentro do aplicativo — você recebe uma notificação quando houver resposta.
      </p>

      <section className="mb-9">
        <h2 className="mb-3 text-lg font-bold">Dúvidas frequentes</h2>
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-white/10 p-4">
              <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <SupportCenter
        tickets={tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updatedAt.toISOString() }))}

      />

      <section className="mt-9 rounded-xl border border-white/10 p-5 text-sm text-white/55">
        <p>Políticas e termos: <Link className="underline" href="/privacidade">Privacidade</Link> · <Link className="underline" href="/termos">Termos</Link> · <Link className="underline" href="/sobre-o-aplicativo">Sobre o aplicativo</Link></p>
        <p className="mt-2 text-xs text-white/35">Última atualização das políticas: {fmtDateTime(new Date())}</p>
      </section>
    </div>
  );
}
