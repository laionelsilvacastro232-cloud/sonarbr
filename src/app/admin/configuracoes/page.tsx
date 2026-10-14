import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/app/admin/actions";
import { AForm } from "@/components/AdminUi";
import { BrandMark } from "@/components/Brand";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function SettingsAdmin() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-[860px]">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Configurações e identidade visual</h1>
      <AForm action={saveSettings} submit="Salvar configurações" className="space-y-6">
        <section className="panel space-y-4">
          <h2 className="font-bold">Marca</h2>
          <div><label className="label">Nome da plataforma</label><input name="siteName" defaultValue={s.siteName} required maxLength={40} className="field" /></div>
          <div><label className="label">Slogan</label><input name="tagline" defaultValue={s.tagline} maxLength={160} className="field" /></div>
          <div className="flex items-center gap-4"><div className="grid h-16 w-24 place-items-center rounded-lg border border-white/15 bg-black"><BrandMark logoUrl={s.logoUrl} size={36} /></div>
            <div className="flex-1"><label className="label">Logotipo (PNG, JPG ou WebP; fundo transparente recomendado)</label><input name="logo" type="file" accept="image/*" className="field" />
              <input name="logoUrlText" placeholder="ou URL do logotipo" className="field mt-2" />
              {s.logoUrl && <label className="mt-2 flex items-center gap-2 text-sm text-white/70"><input type="checkbox" name="removeLogo" value="1" /> Remover logotipo (voltar ao padrão)</label>}</div></div>
          <div><label className="label">Favicon (PNG quadrado)</label><input name="favicon" type="file" accept="image/*" className="field" />
            {s.faviconUrl && <label className="mt-2 flex items-center gap-2 text-sm text-white/70"><input type="checkbox" name="removeFavicon" value="1" /> Remover favicon personalizado</label>}</div>
        </section>
        <section className="panel space-y-4">
          <h2 className="font-bold">Recursos</h2>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="registrationOpen" defaultChecked={s.registrationOpen === "true"} /> Permitir novos cadastros</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="socialEnabled" defaultChecked={s.socialEnabled === "true"} /> Recursos sociais (perfis públicos, atividade e descoberta de pessoas)</label>
          <div><label className="label">Aviso global (exibido no topo; deixe vazio para ocultar)</label><input name="announcement" defaultValue={s.announcement} maxLength={200} className="field" /></div>
        </section>
        <section className="panel space-y-4">
          <h2 className="font-bold">Textos institucionais e links</h2>
          <div><label className="label">Sobre</label><textarea name="about" rows={3} defaultValue={s.about} className="field" /></div>
          <div><label className="label">Termos de Uso</label><textarea name="termsOfUse" rows={6} defaultValue={s.termsOfUse} className="field" /></div>
          <div><label className="label">Política de Privacidade</label><textarea name="privacyPolicy" rows={6} defaultValue={s.privacyPolicy} className="field" /></div>
          <div><label className="label">Links do rodapé (um por linha: Rótulo|https://… ou mailto:)</label><textarea name="links" rows={3} defaultValue={s.links} className="field" /></div>
        </section>
        <p className="text-xs text-white/45">Idioma: a interface está disponível apenas em português do Brasil nesta versão; não há seletor de idioma porque não há traduções implementadas.</p>
      </AForm>
    </div>
  );
}
