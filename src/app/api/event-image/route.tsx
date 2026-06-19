import { ImageResponse } from "next/og";

// Generuje gotowy obraz szablonu eventu (do publikacji na IG/FB/Story) — styl plakatu IG.
//   /api/event-image?id=<eventId>&format=post   → 1080×1080 (post IG/FB)
//   /api/event-image?id=<eventId>&format=story  → 1080×1920 (Story IG)
// Zdjęcie na cały kadr + gradient + logo na górze + data/tytuł na dole. Czcionka Syne.

export const runtime = "edge";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

  const titleSize = format === "story" ? 100 : 84;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          position: "relative",
          backgroundImage: img ? "none" : bg,
          backgroundColor: "#15082e",
          fontFamily: ff,
          color: "#ffffff",
        }}
      >
        {/* Zdjęcie na cały kadr */}
        {img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={img} width={W} height={H} style={{ position: "absolute", inset: 0, width: W, height: H, objectFit: "cover" }} alt="" />
        ) : null}

        {/* Gradient dla czytelności (góra lekko, dół mocno) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.05) 26%, rgba(0,0,0,0.1) 52%, rgba(0,0,0,0.88) 100%)",
          }}
        />

        {/* Warstwa treści */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: W,
            height: H,
            padding: format === "story" ? "80px 70px 96px" : "64px 64px 72px",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Góra: logo + lokalizacja */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 124,
                height: 124,
                borderRadius: 62,
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} width={92} height={92} style={{ width: 92, height: 92, objectFit: "contain" }} alt="" />
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 24, fontWeight: 600, letterSpacing: 5, color: "rgba(255,255,255,0.9)" }}>
              RENA MAJORE · SARDEGNA
            </div>
          </div>

          {/* Dół: data + tytuł + adres */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {tag ? (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 4, color: accent, marginBottom: 14, textTransform: "uppercase" }}>
                {tag}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                maxWidth: W - 120,
                textAlign: "center",
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.02,
              }}
            >
              {title}
            </div>
            {date ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 26,
                  backgroundColor: accent,
                  color: "#0b0b0b",
                  fontSize: 32,
                  fontWeight: 800,
                  padding: "12px 34px",
                  borderRadius: 999,
                  letterSpacing: 2,
                }}
              >
                {String(date).toUpperCase()}
              </div>
            ) : null}
            <div style={{ display: "flex", marginTop: 30, fontSize: 30, fontWeight: 600, letterSpacing: 1, color: "rgba(255,255,255,0.92)" }}>
              www.shistoria.it
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined }
  );
}
