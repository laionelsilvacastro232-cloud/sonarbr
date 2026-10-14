import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { Empty, PageHeader } from "@/components/Cards";
import { MarkRead } from "@/components/Misc";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

export default async function Notifications() {
  await requireUser();
  const u = (await getCurrentUser())!;
  const rows = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader eyebrow="Conta" title="Notificações" />
      <MarkRead has={rows.some((r) => !r.readAt)} />
      {rows.length === 0 ? (
        <Empty title="Nada novo por aqui" text="Você será avisado quando alguém seguir você, salvar suas playlists ou convidá-lo para colaborar." />
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id}>
              <Link href={n.href ?? "#"} className={`flex items-start justify-between gap-4 rounded-xl border p-4 hover:bg-white/[0.07] ${n.readAt ? "border-white/[0.07]" : "border-white/30 bg-white/[0.05]"}`}>
                <span className="text-sm">{n.message}</span>
                <span className="shrink-0 text-xs text-white/40">{timeAgo(n.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
