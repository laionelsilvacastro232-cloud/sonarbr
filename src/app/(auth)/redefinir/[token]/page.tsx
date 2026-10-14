import { ResetForm } from "@/components/AuthForms";

export const metadata = { title: "Redefinir senha" };

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  return (
    <>
      <h1 className="mb-8 text-center text-[28px] font-extrabold tracking-tight">Nova senha</h1>
      <ResetForm token={(await params).token} />
    </>
  );
}
