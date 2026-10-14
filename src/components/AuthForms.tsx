"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  loginAction, logoutAction, registerAction, requestResetAction, resendVerification, resetPasswordAction, verifyEmailCodeAction,
  type FormState,
} from "@/app/actions";

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return s.error ? (
    <p role="alert" className="rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-sm text-white/90">{s.error}</p>
  ) : s.ok ? (
    <p role="status" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">{s.ok}</p>
  ) : null;
}

export function LoginForm({ next, reset }: { next?: string; reset?: boolean }) {
  const [s, a, p] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={a} className="space-y-4">
      {reset && <p className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm">Senha redefinida. Entre com a nova senha.</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required className="field" /></div>
      <div><label className="label" htmlFor="pw">Senha</label><input id="pw" name="password" type="password" autoComplete="current-password" required className="field" /></div>
      <Msg s={s} />
      <button disabled={p} className="btn-primary w-full">{p ? "Entrando…" : "Entrar"}</button>
      <div className="flex justify-between text-sm text-white/55">
        <Link href="/recuperar" className="underline hover:text-white">Esqueci minha senha</Link>
        <Link href="/cadastro" className="underline hover:text-white">Criar conta</Link>
      </div>
    </form>
  );
}

export function RegisterForm({ artist }: { artist?: boolean }) {
  const [s, a, p] = useActionState<FormState, FormData>(registerAction, undefined);
  // preserva o que a pessoa digitou quando o cadastro retorna erro
  const v = ((s as { values?: Record<string, string> } | undefined)?.values ?? {}) as Record<string, string>;
  return (
    <form action={a} className="space-y-4">
      {artist && <input type="hidden" name="artist" value="1" />}
      <div><label className="label" htmlFor="dn">Nome de exibição</label><input id="dn" name="displayName" maxLength={60} defaultValue={v.displayName} required className="field" /></div>
      <div><label className="label" htmlFor="un">Nome de usuário (precisa ser único)</label><input id="un" name="username" maxLength={30} defaultValue={v.username} required className="field" /><p className="mt-1 text-xs text-white/40">Do seu jeito: letras (com acento), números, espaço, ponto, hífen, _ e apóstrofo. Só não pode ser igual ao de outra pessoa.</p></div>
      <div><label className="label" htmlFor="em">E-mail</label><input id="em" name="email" type="email" autoComplete="email" defaultValue={v.email} required className="field" /></div>
      <div><label className="label" htmlFor="pw2">Senha</label><input id="pw2" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" /><p className="mt-1 text-xs text-white/40">Mínimo de 8 caracteres, com letras e números.</p></div>
      <label className="flex items-start gap-3 text-sm text-white/70"><input type="checkbox" name="terms" className="mt-0.5" required /> <span>Li e aceito os <Link href="/termos" className="underline">Termos de Uso</Link> e a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</span></label>
      <Msg s={s} />
      <button disabled={p} className="btn-primary w-full">{p ? "Criando…" : artist ? "Criar conta de artista" : "Criar conta"}</button>
      <p className="text-center text-sm text-white/55">Já tem conta? <Link href="/entrar" className="underline hover:text-white">Entrar</Link></p>
    </form>
  );
}

function CodeInput({ id }: { id: string }) {
  return (
    <input
      id={id}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      required
      placeholder="000000"
      className="field text-center font-mono text-2xl tracking-[0.5em]"
    />
  );
}

export function RecoverForm() {
  const [s, a, p] = useActionState<FormState, FormData>(requestResetAction, undefined);
  const sentTo = s?.ok ? s.values?.email : undefined;
  if (sentTo) return <ResetCodeForm email={sentTo} notice={s?.ok} />;
  return (
    <form action={a} className="space-y-4">
      <div><label className="label" htmlFor="rem">E-mail da conta</label><input id="rem" name="email" type="email" autoComplete="email" required className="field" /></div>
      <Msg s={s} />
      <button disabled={p} className="btn-primary w-full">{p ? "Enviando…" : "Enviar código"}</button>
      <p className="text-center text-sm"><Link href="/entrar" className="text-white/55 underline hover:text-white">Voltar ao login</Link></p>
    </form>
  );
}

function ResetCodeForm({ email, notice }: { email: string; notice?: string }) {
  const [s, a, p] = useActionState<FormState, FormData>(resetPasswordAction, undefined);
  const [resent, resend, resending] = useActionState<FormState, FormData>(requestResetAction, undefined);
  return (
    <div className="space-y-4">
      <p role="status" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
        {resent?.ok ? "Novo código enviado." : notice} Enviado para <b className="text-white">{email}</b>.
      </p>
      <form action={a} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <div><label className="label" htmlFor="rc">Código de verificação</label><CodeInput id="rc" /></div>
        <div><label className="label" htmlFor="rp">Nova senha</label><input id="rp" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" /><p className="mt-1 text-xs text-white/40">Mínimo de 8 caracteres, com letras e números.</p></div>
        <Msg s={s} />
        <button disabled={p} className="btn-primary w-full">{p ? "Salvando…" : "Redefinir senha"}</button>
      </form>
      <form action={resend} className="text-center">
        <input type="hidden" name="email" value={email} />
        {resent?.error && <Msg s={resent} />}
        <button disabled={resending} className="text-sm text-white/55 underline hover:text-white">{resending ? "Reenviando…" : "Não recebeu? Reenviar código"}</button>
      </form>
      <p className="text-center text-sm"><Link href="/entrar" className="text-white/55 underline hover:text-white">Voltar ao login</Link></p>
    </div>
  );
}

export function VerifyEmailForm({ email, next }: { email: string; next: string }) {
  const [s, a, p] = useActionState<FormState, FormData>(verifyEmailCodeAction, undefined);
  const [resendMsg, setResendMsg] = useState<FormState>(undefined);
  const [resending, startResend] = useTransition();
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-white/60">Enviamos um código de 6 dígitos para <b className="text-white">{email}</b>. Ele vale por 15 minutos. Confira também a caixa de spam.</p>
      <form action={a} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="vc">Código de verificação</label><CodeInput id="vc" /></div>
        <Msg s={s} />
        <button disabled={p} className="btn-primary w-full">{p ? "Verificando…" : "Confirmar e-mail"}</button>
      </form>
      <Msg s={resendMsg} />
      <div className="flex justify-between text-sm text-white/55">
        <button
          type="button"
          disabled={resending}
          className="underline hover:text-white"
          onClick={() => startResend(async () => {
            const r = await resendVerification();
            setResendMsg(r.ok ? { ok: "Novo código enviado." } : { error: r.error });
          })}
        >
          {resending ? "Reenviando…" : "Reenviar código"}
        </button>
        <form action={logoutAction}><button className="underline hover:text-white">Sair</button></form>
      </div>
    </div>
  );
}
