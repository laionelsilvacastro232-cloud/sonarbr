import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const s = size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 32 32" fill="none">
          <rect x="1" y="1" width="30" height="30" rx="9" stroke="#fff" strokeWidth="1.6" />
          <path d="M8 19c3 0 3-6 6-6s3 8 6 8 3-10 6-10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: s, height: s },
  );
}
