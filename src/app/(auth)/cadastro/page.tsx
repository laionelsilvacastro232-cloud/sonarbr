import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Criar conta" };

export default async function Register({ searchParams }: { searchParams: Promise<{ artista?: string }> }) {
  const logged = await getCurrentUser();
  if (logged) redirect(logged.artistId ? "/estudio" : "/");
  const s = await getSettings();
  const artist = (await searchParams).artista === "1";
  return (
    <>
      <h1 className="mb-2 text-center text-[28px] font-extrabold leading-tight tracking-tight">{artist ? "Conta de artista" : "Criar conta"}</h1>
      <p className="mb-8 text-center text-sm text-white/55">{artist ? "Envie suas faixas após a aprovação do seu perfil pela equipe." : "Salve músicas, monte playlists e siga artistas e amigos."}</p>
      {s.registrationOpen === "true" ? (
        <>
          <RegisterForm artist={artist} />
          {!artist && <p className="mt-4 text-center text-sm"><Link href="/cadastro?artista=1" className="text-white/55 underline hover:text-white">Sou artista</Link></p>}
        </>
      ) : (
        <p className="rounded-xl border border-white/15 bg-white/5 p-4 text-center text-sm text-white/70">Os cadastros estão temporariamente fechados. <Link href="/entrar" className="underline">Entrar</Link></p>
      )}
    </>
  );
}
