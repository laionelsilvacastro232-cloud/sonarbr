import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BrandMark } from "@/components/Brand";
import { IconExternal, IconLibrary, IconMic, IconMusic, IconPlay, IconSearch, IconUsers } from "@/components/Icons";

export const metadata = { title: "Sobre o aplicativo" };
export const dynamic = "force-dynamic";

export default async function AboutApp() {
  const [user, s] = await Promise.all([getCurrentUser(), getSettings()]);
  const artistTools = !!user && (user.role === "artist" || user.role === "admin");
  const community = s.socialEnabled === "true";

  const features = [
    { icon: IconPlay, title: "Descoberta musical", text: "Página inicial com recomendações, lançamentos, destaques editoriais e gêneros." },
    { icon: IconSearch, title: "Pesquisa de músicas e artistas", text: "Busca global com sugestões durante a digitação, histórico e filtros por tipo de conteúdo." },
    { icon: IconMusic, title: "Playlists", text: "Crie, edite, reordene, duplique e compartilhe playlists — inclusive colaborativas com amigos." },
    { icon: IconLibrary, title: "Biblioteca musical", text: "Playlists salvas, álbuns salvos, artistas seguidos e conteúdos recentes em um só lugar." },
    { icon: IconPlay, title: "Músicas favoritas", text: "Seu conjunto de músicas curtidas, disponível em qualquer dispositivo em que você entrar na conta." },
    ...(user ? [{ icon: IconUsers, title: "Perfis de usuários", text: "Perfil público com biografia, seguidores, atividade recente e preferências de privacidade." }] : []),
    ...(community ? [{ icon: IconUsers, title: "Recursos comunitários", text: "Seguir outras pessoas, ver o que estão ouvindo e receber notificações da comunidade." }] : []),
    ...(artistTools ? [{ icon: IconMic, title: "Ferramentas para artistas", text: "Estúdio do artista para enviar faixas autorizadas, editar biografia e acompanhar o catálogo publicado." }] : []),
  ];

  return (
    <div className="mx-auto max-w-[860px] py-4">
      <div className="mb-9 flex items-center gap-3">
        <BrandMark logoUrl={s.logoUrl} size={40} />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Sobre o aplicativo</h1>
          <p className="text-sm text-white/45">{s.siteName} — projeto independente da comunidade</p>
        </div>
      </div>

      <section className="mb-9">
        <h2 className="mb-3 text-xl font-bold">Sobre o projeto</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-white/75">
          <p>Este aplicativo é um projeto independente, criado por membros da comunidade de Avakin Life para reunir pessoas que compartilham o interesse por música, artistas e experiências musicais.</p>
          <p>Nosso objetivo é oferecer um espaço musical desenvolvido especialmente para a comunidade, permitindo que os usuários descubram músicas, organizem suas playlists e compartilhem seu interesse pela música.</p>
          <p>Acreditamos que a música aproxima pessoas e que a comunidade de Avakin Life também pode ter seu próprio espaço para essa paixão.</p>
        </div>
      </section>

      <section className="mb-9 rounded-2xl border border-white/25 bg-white/[0.05] p-6 md:p-8">
        <h2 className="mb-4 text-xl font-bold">Somos independentes</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-white/75">
          <p>Este aplicativo é um projeto independente, desenvolvido por membros da comunidade de Avakin Life.</p>
          <p>Não somos um aplicativo oficial do Avakin Life e não fazemos parte da equipe responsável pelo desenvolvimento do jogo.</p>
          <p>O Avakin Life é desenvolvido e publicado pela Lockwood Publishing. Não somos representantes da Lockwood Publishing, não temos vínculo oficial com a empresa e não afirmamos possuir seu apoio, autorização ou patrocínio.</p>
          <p>Avakin Life e Lockwood Publishing são nomes pertencentes aos seus respectivos titulares.</p>
          <p>Este projeto é uma iniciativa comunitária e independente, criada para pessoas que compartilham interesses em comum.</p>
        </div>
      </section>

      <section className="mb-9">
        <h2 className="mb-4 text-xl font-bold">O que você encontra aqui</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f.title} className="flex gap-3 rounded-xl border border-white/10 bg-[#141414] p-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-white"><f.icon size={18} /></span>
              <span>
                <span className="block text-sm font-bold">{f.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-white/55">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
        {!user && (
          <p className="mt-4 text-sm text-white/50">
            <Link href="/cadastro" className="font-semibold text-white underline">Crie uma conta</Link> para liberar perfil, biblioteca, playlists e recursos comunitários.
          </p>
        )}
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link href="/termos" className="rounded-xl border border-white/10 p-4 text-sm font-semibold hover:bg-white/[0.06]">Termos de uso</Link>
        <Link href="/privacidade" className="rounded-xl border border-white/10 p-4 text-sm font-semibold hover:bg-white/[0.06]">Política de privacidade</Link>
        <a href="https://www.avakin.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 p-4 text-sm font-semibold hover:bg-white/[0.06]">Site oficial do Avakin Life <IconExternal size={16} /></a>
      </section>

      <p className="text-xs leading-relaxed text-white/40">
        Última atualização desta página: {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.
      </p>
    </div>
  );
}
