import type { ReactNode } from "react";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, playlistCollaborators, playlists } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, parseLinks } from "@/lib/settings";
import { PlayerProvider } from "@/components/PlayerProvider";
import { UiProvider } from "@/components/UiProvider";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  let unread = 0;
  let pls: { id: string; name: string; cover: string | null }[] = [];
  if (user) {
    const [[n], rows] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
      db
        .select({ id: playlists.id, name: playlists.name, cover: playlists.coverUrl })
        .from(playlists)
        .where(or(eq(playlists.ownerId, user.id), sql`exists(select 1 from ${playlistCollaborators} pc where pc.playlist_id = ${playlists.id} and pc.user_id = ${user.id})`))
        .orderBy(desc(playlists.updatedAt))
        .limit(25),
    ]);
    unread = n.n;
    pls = rows;
  }
  const appUser = user ? { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role } : null;
  return (
    <PlayerProvider>
      <UiProvider user={appUser}>
        <Shell
          user={appUser}
          siteName={settings.siteName}
          logoUrl={settings.logoUrl}
          links={parseLinks(settings.links)}
          unread={unread}
          social={settings.socialEnabled === "true"}
          announcement={settings.announcement}
          playlists={pls}
        >
          {children}
        </Shell>
      </UiProvider>
    </PlayerProvider>
  );
}
