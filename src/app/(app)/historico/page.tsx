import Link from "next/link";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { historyData } from "@/lib/queries";
import { PageHeader } from "@/components/Cards";
import { TrackList } from "@/components/TrackList";
import { ClearHistoryButton } from "@/components/Misc";

export const metadata = { title: "Histórico" };
export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function History({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireUser();
  const user = (await getCurrentUser())!;
  const page = Math.max(1, parseInt((await searchParams).p ?? "1") || 1);
  const rows = await historyData(user.id, PAGE + 1, (page - 1) * PAGE);
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE).map((r) => ({ ...r, liked: false }));
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow="Biblioteca" title="Histórico de reprodução">{list.length > 0 && <ClearHistoryButton />}</PageHeader>
      {!user.recordHistory && <p className="mb-5 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">O registro de histórico está pausado. Reative em <Link href="/configuracoes" className="underline">Configurações</Link>.</p>}
      <p className="mb-5 text-sm text-white/50">Somente reproduções reais (a partir de 10 s ouvidos) aparecem aqui. {user.historyPrivate ? "Seu histórico é privado." : "Seus seguidores só veem a última faixa se a atividade estiver habilitada."}</p>
      <TrackList tracks={list} showDate allowHistoryRemove showIndex={false} emptyText="Seu histórico está vazio." />
      <div className="mt-6 flex justify-between text-sm">
        {page > 1 ? <Link className="btn-outline" href={`/historico?p=${page - 1}`}>Anterior</Link> : <span />}
        {more && <Link className="btn-outline" href={`/historico?p=${page + 1}`}>Próxima</Link>}
      </div>
    </div>
  );
}
