import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Entrar" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const logged = await getCurrentUser();
  if (logged) redirect(logged.role === "user" && !logged.artistId ? "/" : logged.artistId ? "/estudio" : "/");
  const { next, reset } = await searchParams;
  const s = await getSettings();
  return (
    <>
      <h1 className="mb-8 text-center text-[28px] font-extrabold leading-tight tracking-tight">{s.tagline}</h1>
      <LoginForm next={next} reset={reset === "1"} />
    </>
  );
}
