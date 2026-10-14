import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { VerifyEmailForm } from "@/components/AuthForms";

export const metadata = { title: "Verificar e-mail" };

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await getCurrentUser();
  const { next } = await searchParams;
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!u) redirect("/entrar");
  if (u.emailVerifiedAt) redirect(dest);
  return (
    <>
      <h1 className="mb-2 text-center text-[28px] font-extrabold tracking-tight">Confirme seu e-mail</h1>
      <VerifyEmailForm email={u.email} next={dest} />
    </>
  );
}
