import Link from "next/link";

/* Área de identidade visual: troque nome, logotipo e favicon em Admin → Configurações. */
export function BrandMark({ logoUrl, size = 28 }: { logoUrl?: string; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" width={size} height={size} style={{ height: size, width: "auto", maxWidth: size * 3 }} className="object-contain" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="#fff" strokeWidth="1.6" />
      <path d="M8 19c3 0 3-6 6-6s3 8 6 8 3-10 6-10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ name, logoUrl, size = 28, href = "/" }: { name: string; logoUrl?: string; size?: number; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`${name} — início`}>
      <BrandMark logoUrl={logoUrl} size={size} />
      {!logoUrl && <span className="text-[19px] font-extrabold tracking-tight">{name}</span>}
    </Link>
  );
}
