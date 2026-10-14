"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { studioDeletePost, studioDeleteTrack, studioSetPostStatus, studioSetTrackStatus } from "@/app/actions";
import { useUi } from "@/components/UiProvider";

export function StudioRowActions({ kind, id, status }: { kind: "track" | "post"; id: string; status: string }) {
  const ui = useUi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(fn: Promise<{ ok: boolean; error?: string }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    const r = await fn;
    setBusy(false);
    if (!r.ok) ui.toast(r.error ?? "Erro", "error");
    else {
      ui.toast("Feito.");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={kind === "track" ? `/estudio?faixa=${id}` : `/estudio?post=${id}`} className="btn-outline !h-8 !px-3 !text-xs">Editar</Link>
      <button
        disabled={busy}
        className="btn-outline !h-8 !px-3 !text-xs"
        onClick={() => run(kind === "track" ? studioSetTrackStatus(id, status === "published" ? "draft" : "published") : studioSetPostStatus(id, status === "published" ? "draft" : "published"))}
      >
        {status === "published" ? "Ocultar" : "Publicar"}
      </button>
      <button
        disabled={busy}
        className="btn-danger !h-8 !px-3 !text-xs"
        onClick={() =>
          run(
            kind === "track" ? studioDeleteTrack(id) : studioDeletePost(id),
            kind === "track" ? "Excluir esta faixa do catálogo? Essa ação não pode ser desfeita." : "Excluir esta publicação?",
          )
        }
      >
        Excluir
      </button>
    </div>
  );
}
