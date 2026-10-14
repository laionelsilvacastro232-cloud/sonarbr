/* Capa: usa a imagem autorizada quando existe; caso contrário gera uma capa tipográfica monocromática determinística. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function Cover({
  src,
  seed,
  title,
  className = "",
  round = false,
}: {
  src?: string | null;
  seed: string;
  title?: string;
  className?: string;
  round?: boolean;
}) {
  const radius = round ? "rounded-full" : "rounded-md";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" draggable={false} className={`aspect-square w-full object-cover bg-[#1a1a1a] ${radius} ${className}`} />;
  }
  const h = hash(seed);
  const variant = h % 4;
  const shade = 14 + (h % 18);
  const initial = (title ?? "").trim().charAt(0).toUpperCase();
  return (
    <div className={`relative aspect-square w-full overflow-hidden ${radius} ${className}`} style={{ background: `hsl(0 0% ${shade}%)` }} aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        {variant === 0 &&
          [14, 26, 38, 50, 62].map((r, i) => <circle key={r} cx={20 + (h % 40)} cy={80 - (h % 30)} r={r} fill="none" stroke="#fff" strokeOpacity={0.1 + i * 0.03} strokeWidth="0.8" />)}
        {variant === 1 &&
          Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 8.5 + 2} y={100 - ((h >> i) % 60) - 18} width="5" height="100" fill="#fff" fillOpacity={0.06 + (i % 4) * 0.03} />)}
        {variant === 2 &&
          Array.from({ length: 9 }, (_, i) => <line key={i} x1="0" y1={i * 13} x2="100" y2={i * 13 - 40 + (h % 30)} stroke="#fff" strokeOpacity={0.14} strokeWidth="0.8" />)}
        {variant === 3 && (
          <>
            <circle cx="50" cy="50" r="38" fill="#fff" fillOpacity="0.07" />
            <circle cx="50" cy="50" r="22" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="3" fill="#fff" fillOpacity="0.6" />
          </>
        )}
      </svg>
      {initial && <span className="absolute bottom-[8%] left-[9%] text-[min(2.6rem,18cqw)] font-bold leading-none text-white/80" style={{ fontSize: "clamp(1rem,22%,2.6rem)" }}>{initial}</span>}
    </div>
  );
}

export function PlaylistMosaic({ covers, seed, name, className = "" }: { covers: string[]; seed: string; name?: string; className?: string }) {
  if (covers.length >= 4) {
    return (
      <div className={`grid aspect-square w-full grid-cols-2 overflow-hidden rounded-md ${className}`}>
        {covers.slice(0, 4).map((c, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={c} alt="" loading="lazy" className="aspect-square h-full w-full object-cover" />
        ))}
      </div>
    );
  }
  return <Cover src={covers[0]} seed={seed} title={name} className={className} />;
}
