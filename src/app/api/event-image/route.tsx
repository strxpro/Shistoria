import { ImageResponse } from "next/og";

// Generuje gotowy obraz szablonu eventu (do publikacji na IG/FB/Story).
//   /api/event-image?id=<eventId>&format=post   → 1080×1080 (post IG/FB)
//   /api/event-image?id=<eventId>&format=story  → 1080×1920 (Story IG)
// Zwraca PNG. make w scenariuszu publikacji używa tego URL jako Image URL.

export const runtime = "edge";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const id = searchParams.get("id") || "";
  const format = searchParams.get("format") === "story" ? "story" : "post";
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;

  // Pobierz event z Supabase
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

  const bg = ev?.custom_colors?.bg || "linear-gradient(135deg,#15082e,#7b1fa2)";
  const accent = ev?.custom_colors?.accent || "#E8927C";
  const title = ev?.title || "Evento";
  const date = ev?.event_date || "";
  const tag = ev?.tag || "";
  const desc = ev?.description || "";
  const img = ev?.image_url || "";
  const logo = `${origin}/logo.png`;

  const imgH = format === "story" ? 1080 : 600;
  const titleSize = format === "story" ? 92 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          backgroundImage: bg,
          backgroundColor: "#15082e",
          color: "#ffffff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Zdjęcie wydarzenia */}
        {img ? (
          <div style={{ display: "flex", width: W, height: imgH, position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} width={W} height={imgH} style={{ width: W, height: imgH, objectFit: "cover" }} alt="" />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 200,
                display: "flex",
                backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55))",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", width: W, height: imgH }} />
        )}

        {/* Treść */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            padding: "64px 72px",
            justifyContent: format === "story" ? "flex-start" : "center",
          }}
        >
          {(tag || date) && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
              {tag ? (
                <div
                  style={{
                    display: "flex",
                    backgroundColor: accent,
                    color: "#0b0b0b",
                    fontSize: 30,
                    fontWeight: 700,
                    padding: "8px 22px",
                    borderRadius: 999,
                    marginRight: 18,
                  }}
                >
                  {tag}
                </div>
              ) : null}
              {date ? (
                <div style={{ display: "flex", color: accent, fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
                  {String(date).toUpperCase()}
                </div>
              ) : null}
            </div>
          )}

          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>
            {title}
          </div>

          {desc ? (
            <div style={{ display: "flex", fontSize: 36, color: "rgba(255,255,255,0.85)", marginTop: 24, lineHeight: 1.35 }}>
              {desc.length > 160 ? desc.slice(0, 160) + "…" : desc}
            </div>
          ) : null}
        </div>

        {/* Stopka: logo + adres */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 72px 56px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={72} height={72} style={{ width: 72, height: 72, objectFit: "contain" }} alt="" />
            <div style={{ display: "flex", fontSize: 38, fontWeight: 800, marginLeft: 18 }}>S&apos;Historia</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
            www.shistoria.it
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
