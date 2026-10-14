import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ensureBootstrap } from "@/lib/bootstrap";

export const SETTING_DEFAULTS = {
  siteName: "Sonar",
  tagline: "A música que você ouve, as pessoas que você segue.",
  logoUrl: "",
  faviconUrl: "",
  about: "Plataforma musical com biblioteca pessoal, playlists colaborativas e descoberta social.",
  privacyPolicy:
    "Coletamos apenas os dados necessários para operar sua conta: e-mail, nome de exibição, preferências, biblioteca e histórico de reprodução. Você pode tornar o histórico privado, pausar o registro, exportar e excluir sua conta a qualquer momento em Configurações. Senhas são armazenadas apenas como hash. Não vendemos dados pessoais. Para solicitações relacionadas à privacidade, utilize o contato informado no rodapé.",
  termsOfUse:
    "Ao usar a plataforma você concorda em não enviar conteúdo sem autorização dos detentores de direitos, não abusar do serviço e respeitar outros usuários. Conteúdos podem ser removidos e contas suspensas em caso de violação. O catálogo é composto por obras licenciadas, enviadas por artistas autorizados ou prévias oficiais fornecidas por APIs públicas de terceiros.",
  links: "Contato|mailto:contato@example.com",
  registrationOpen: "true",
  socialEnabled: "true",
  announcement: "",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export const getSettings = cache(async (): Promise<Settings> => {
  // catálogo inicial é carregado em segundo plano para não atrasar a primeira resposta
  void ensureBootstrap();
  const rows = await db.select().from(siteSettings);
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as Settings;
});

export function parseLinks(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [label, ...rest] = l.split("|");
      return { label: label.trim(), url: rest.join("|").trim() };
    })
    .filter((l) => l.label && /^(https?:\/\/|mailto:|\/)/.test(l.url));
}
