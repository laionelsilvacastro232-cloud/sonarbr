import { RecoverForm } from "@/components/AuthForms";

export const metadata = { title: "Recuperar senha" };

export default function Recover() {
  return (
    <>
      <h1 className="mb-2 text-center text-[28px] font-extrabold tracking-tight">Recuperar senha</h1>
      <p className="mb-8 text-center text-sm text-white/55">Informe o e-mail da conta para receber um link de redefinição válido por 1 hora.</p>
      <RecoverForm />
    </>
  );
}
