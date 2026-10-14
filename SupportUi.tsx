"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupportTicket, replySupportTicket, supportConversation, type FormState } from "@/app/actions";
import { fmtDateTime } from "@/lib/format";
import { IconChevronLeft } from "@/components/Icons";

type Ticket = { id: string; subject: string; status: string; updatedAt: string };

/** Central de ajuda: lista de conversas + abertura de nova conversa + troca de mensagens. */
export function SupportCenter({ tickets }: { tickets: Ticket[] }) {
  const [open, setOpen] = useState<Ticket | null>(null);
  return (
    <section>
      {open ? (
        <Conversation ticket={open} onBack={() => setOpen(null)} />
      ) : (
        <>
          <div className="mb-4">
            <h2 className="mb-3 text-lg font-bold">Falar com o suporte</h2>
            <NewTicket />
          </div>
          <h2 className="mb-3 mt-8 text-lg font-bold">Suas conversas</h2>
          {tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-white/50">
              Você ainda não abriu nenhuma conversa. Use “Nova conversa” para falar com a equipe do aplicativo.
            </p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setOpen(t)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 p-4 text-left hover:bg-white/[0.07]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{t.subject}</span>
                      <span className="text-xs text-white/45">Atualizada em {fmtDateTime(t.updatedAt)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${t.status === "closed" ? "border-white/15 text-white/45" : "border-white/40 text-white"}`}>
                      {t.status === "closed" ? "Encerrada" : t.status === "open" ? "Aguardando" : "Respondida"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function NewTicket() {
  const router = useRouter();
  const [s, a, p] = useActionState<FormState, FormData>(async (prev, f) => {
    const r = await createSupportTicket(prev, f);
    if (r?.ok) router.refresh();
    return r;
  }, undefined);
  return (
    <form action={a} className="panel mb-4 space-y-3">
      <p className="text-sm font-bold">Nova conversa</p>
      <div><label className="label" htmlFor="sub">Assunto</label><input id="sub" name="subject" required maxLength={120} className="field" placeholder="Ex.: Não consigo publicar minha música" /></div>
      <div><label className="label" htmlFor="msg">Sua mensagem</label><textarea id="msg" name="body" required rows={4} maxLength={2000} className="field" placeholder="Descreva o que aconteceu. Se for um erro, conte o que você fez antes." /></div>
      {s?.error && <p role="alert" className="text-sm text-white/85">Erro: {s.error}</p>}
      {s?.ok && <p role="status" className="text-sm text-white/70">{s.ok}</p>}
      <button disabled={p} className="btn-primary">{p ? "Enviando…" : "Enviar mensagem"}</button>
    </form>
  );
}

function Conversation({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<{ id: string; body: string; fromSupport: boolean; createdAt: string }[] | null>(null);
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");

  async function load() {
    const c = await supportConversation(ticket.id);
    setMsgs(c?.messages.map((m) => ({ id: m.id, body: m.body, fromSupport: m.fromSupport, createdAt: m.createdAt.toISOString() })) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  return (
    <div className="panel !p-4">
      <div className="mb-3 flex items-center gap-3 border-b border-white/10 pb-3">
        <button onClick={onBack} aria-label="Voltar" className="icon-btn"><IconChevronLeft size={20} /></button>
        <div className="min-w-0"><p className="truncate text-sm font-bold">{ticket.subject}</p><p className="text-xs text-white/45">Suporte do aplicativo · {ticket.status === "closed" ? "encerrada" : "ativa"}</p></div>
      </div>
      <div className="max-h-[46dvh] space-y-3 overflow-y-auto py-1">
        {msgs === null ? (
          <p className="py-6 text-center text-sm text-white/45">Carregando conversa…</p>
        ) : msgs.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/45">Sem mensagens.</p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.fromSupport ? "bg-white text-black" : "ml-auto bg-white/10"}`}>
              {m.fromSupport && <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider opacity-60">Suporte</p>}
              <p className="whitespace-pre-line">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.fromSupport ? "opacity-50" : "text-white/40"}`}>{fmtDateTime(m.createdAt)}</p>
            </div>
          ))
        )}
      </div>
      {ticket.status !== "closed" && (
        <form
          className="mt-3 flex gap-2 border-t border-white/10 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await replySupportTicket(ticket.id, text);
              if (r?.error) setErr(r.error);
              else {
                setErr("");
                setText("");
                router.refresh();
              }
              const c = await (await import("@/app/actions")).supportConversation(ticket.id);
              setMsgs(c?.messages.map((m) => ({ id: m.id, body: m.body, fromSupport: m.fromSupport, createdAt: m.createdAt.toISOString() })) ?? []);
            });
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Escreva sua mensagem" aria-label="Mensagem" className="field" />
          <button disabled={busy || !text.trim()} className="btn-primary shrink-0">{busy ? "…" : "Enviar"}</button>
        </form>
      )}
      {err && <p className="mt-2 text-sm text-white/85">Erro: {err}</p>}
    </div>
  );
}
