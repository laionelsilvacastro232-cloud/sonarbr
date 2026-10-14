"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AdminResult } from "@/app/admin/actions";
import { suspendUser } from "@/app/admin/actions";


export function AForm({
  action,
  children,
  submit = "Salvar",
  className = "space-y-4",
  resetOnOk = false,
}: {
  action: (s: AdminResult, f: FormData) => Promise<AdminResult>;
  children: ReactNode;
  submit?: string;
  className?: string;
  resetOnOk?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [s, a, p] = useActionState<AdminResult, FormData>(async (prev, f) => {
    const r = await action(prev, f);
    if (r?.ok) {
      if (resetOnOk) ref.current?.reset();
      router.refresh();
    }
    return r;
  }, undefined);
  return (
    <form ref={ref} action={a} className={className}>
      {children}
      {s?.error && <p role="alert" className="rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-sm">Erro: {s.error}</p>}
      {s?.ok && <p role="status" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">{s.ok}</p>}
      <button disabled={p} className="btn-primary">{p ? "Salvando…" : submit}</button>
    </form>
  );
}

export function ABtn({
  run,
  label,
  confirmText,
  danger = false,
  small = true,
}: {
  run: () => Promise<AdminResult>;
  label: string;
  confirmText?: string;
  danger?: boolean;
  small?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<AdminResult>();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        disabled={busy}
        className={`${danger ? "btn-danger" : "btn-outline"} ${small ? "!h-8 !px-3 !text-xs" : ""}`}
        onClick={async () => {
          if (confirmText && !confirm(confirmText)) return;
          setBusy(true);
          const r = await run();
          setBusy(false);
          setMsg(r);
          if (r?.ok) router.refresh();
        }}
      >
        {busy ? "…" : label}
      </button>
      {msg?.error && <span className="max-w-[260px] text-[11px] text-white/80">{msg.error}</span>}
      {msg?.ok && !msg.link && <span className="max-w-[260px] text-[11px] text-white/55">{msg.ok}</span>}
      {msg?.link && (
        <span className="block max-w-[320px] break-all rounded border border-white/20 bg-black p-2 text-[11px]">
          {msg.ok}
          <br />
          <input readOnly value={msg.link} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full bg-transparent text-white outline-none" />
        </span>
      )}
    </span>
  );
}

export function Reason({ userId, label }: { userId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<AdminResult>();
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="btn-danger !h-8 !px-3 !text-xs" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <span className="inline-flex flex-col gap-1">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" className="field !py-1 !text-xs" />
      <span className="flex gap-1">
        <button
          disabled={busy}
          className="btn-danger !h-7 !px-3 !text-xs"
          onClick={async () => {
            setBusy(true);
            const r = await suspendUser(userId, reason);
            setBusy(false);
            setMsg(r);
            if (r?.ok) { setOpen(false); router.refresh(); }
          }}
        >
          Confirmar
        </button>
        <button className="btn-outline !h-7 !px-3 !text-xs" onClick={() => setOpen(false)}>Cancelar</button>
      </span>
      {msg?.error && <span className="text-[11px]">{msg.error}</span>}
    </span>
  );
}
