import "server-only";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

const fromAddress = () => process.env.EMAIL_FROM || "SonarBR <onboarding@resend.dev>";

/** Envia e-mail via API do Resend. Retorna false se não configurado ou se o envio falhar. */
export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), to, subject, text, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.error("Falha ao enviar e-mail:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("Erro ao enviar e-mail:", e);
    return false;
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Envia um código de verificação de 6 dígitos com layout simples. */
export async function sendCodeEmail(to: string, siteName: string, purpose: "verify" | "reset", code: string) {
  const title = purpose === "verify" ? "Confirme seu e-mail" : "Redefinição de senha";
  const intro =
    purpose === "verify"
      ? `Use o código abaixo para confirmar seu e-mail no ${siteName}.`
      : `Use o código abaixo para redefinir sua senha no ${siteName}.`;
  const text = `${intro}\n\nCódigo: ${code}\n\nO código expira em 15 minutos. Se você não fez essa solicitação, ignore este e-mail.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;color:#444">${escapeHtml(intro)}</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f2f2f2;border-radius:8px;padding:16px;text-align:center;margin:0 0 20px">${code}</p>
<p style="margin:0;color:#666;font-size:13px">O código expira em 15 minutos. Se você não fez essa solicitação, ignore este e-mail.</p>
</div>`;
  return sendEmail(to, `${code} é seu código ${siteName}`, text, html);
}

export async function appOrigin() {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return process.env.APP_URL ?? `${proto}://${host}`;
}
