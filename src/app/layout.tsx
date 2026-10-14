import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const name = s?.siteName ?? "Sonar";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: s?.about ?? "Plataforma musical",
    applicationName: name,
    manifest: "/manifest.webmanifest",
    icons: { icon: s?.faviconUrl || "/icons/192", apple: "/icons/192" },
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" },
    openGraph: { title: name, description: s?.tagline ?? "", type: "website", siteName: name },
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-black text-white antialiased">{children}</body>
    </html>
  );
}
