import { ImageResponse } from "next/og";

// Generuje gotowy obraz szablonu eventu (do publikacji na IG/FB/Story).
//   /api/event-image?id=<eventId>&format=post   → 1080×1080 (post IG/FB)
//   /api/event-image?id=<eventId>&format=story  → 1080×1920 (Story IG)
// Czcionka: Syne (jak na stronie). Logo S'Historia w białym kółku na górze.

export const runtime = "edge";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Pobiera plik TTF czcionki z Google Fonts (stary User-Agent → Google zwraca TTF, który Satori obsługuje).
async function gFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64)" },
      })
    ).text();
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const id = searchParams.get("id") || "";
  const format = searchParams.get("format") === "story" ? "story" : "post";
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;

  let ev: any = {};
  try {
    const r = await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}&select=*`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const j = await r.json();
    ev = (Array.isArray(j) && j[0]) || {};
  } catch {
    ev = {};
  }

  const bg = ev?.custom_colors?.bg || "linear-gradient(140deg,#15082e,#7b1fa2)";
  const accent = ev?.custom_colors?.accent || "#E8927C";
  const title = ev?.title || "Evento";
  const date = ev?.event_date || "";
  const tag = (ev?.tag || "").split("·")[0].trim();
  const img = ev?.image_url || "";
  const logo = `${origin}/logo.png`;

  const [syne800, syne600] = await Promise.all([gFont("Syne", 800), gFont("Syne", 600)]);
  const fonts: any[] = [];
  if (syne800) fonts.push({ name: "Syne", data: syne800, weight: 800, style: "normal" });
  if (syne600) fonts.push({ name: "Syne", data: syne600, weight: 600, style: "normal" });
  const ff = fonts.length ? "Syne" : "sans-serif";

  const cardW = W - 200;
  const imgH = format === "story" ? 980 : 540;
  const titleSize = format === "story" ? 94 : 78;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundImage: bg,
          backgroundColor: "#15082e",
          color: "#ffffff",
          fontFamily: ff,
          padding: "70px 60px 64px",
        }}
      >
        {/* Logo na górze, na środku */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 44 }}>
          <div
            style={{
              display: "flex",
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={96} height={96} style={{ width: 96, height: 96, objectFit: "contain" }} alt="" />
          </div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 26, fontWeight: 600, letterSpacing: 5, color: "rgba(255,255,255,0.82)" }}>
            RENA MAJORE · SARDEGNA
          </div>
        </div>

        {/* Zdjęcie w karcie */}
        {img ? (
          <div
            style={{
              display: "flex",
              width: cardW,
              height: imgH,
              borderRadius: 30,
              overflow: "hidden",
              boxShadow: "0 28px 60px rgba(0,0,0,0.45)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} width={cardW} height={imgH} style={{ width: cardW, height: imgH, objectFit: "cover" }} alt="" />
          </div>
        ) : null}

        {/* Tekst */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flexGrow: 1,
            justifyContent: img ? "flex-start" : "center",
            marginTop: img ? 46 : 0,
          }}
        >
          {date ? (
            <div
              style={{
                display: "flex",
                backgroundColor: accent,
                color: "#0b0b0b",
                fontSize: 30,
                fontWeight: 800,
                padding: "10px 30px",
                borderRadius: 999,
                letterSpacing: 2,
              }}
            >
              {String(date).toUpperCase()}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              maxWidth: W - 140,
              textAlign: "center",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.04,
              marginTop: 26,
            }}
          >
            {title}
          </div>
          {tag ? (
            <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.82)", marginTop: 18 }}>{tag}</div>
          ) : null}
        </div>

        {/* Stopka */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 30 }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600, letterSpacing: 1, color: "rgba(255,255,255,0.92)" }}>
            www.shistoria.it
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined }
  );
}
