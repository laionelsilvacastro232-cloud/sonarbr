import { notFound } from "next/navigation";
import { getSettings, parseLinks } from "@/lib/settings";

export const dynamic = "force-dynamic";

const DOCS: Record<string, { title: string; key: "termsOfUse" | "privacyPolicy" | "about" }> = {
  termos: { title: "Termos de Uso", key: "termsOfUse" },
  privacidade: { title: "Política de Privacidade", key: "privacyPolicy" },
  sobre: { title: "Sobre", key: "about" },
};

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc];
  return { title: d?.title ?? "Página" };
}

export default async function Doc({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc];
  if (!d) notFound();
  const s = await getSettings();
  const links = parseLinks(s.links);
  return (
    <article className="mx-auto max-w-[760px] py-6">
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight">{d.title}</h1>
      <div className="whitespace-pre-line text-[15px] leading-relaxed text-white/75">{s[d.key]}</div>
      {links.length > 0 && (
        <ul className="mt-8 space-y-2 border-t border-white/10 pt-6 text-sm">
          {links.map((l) => <li key={l.url}><a className="underline" href={l.url}>{l.label}</a></li>)}
        </ul>
      )}
    </article>
  );
}
