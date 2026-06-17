import { NextResponse } from "next/server";

/**
 * /api/instagram — pobiera media z Instagram Graph API (konto Business/Creator).
 *
 * Klucz NIE jest publiczny — trzymamy go po stronie serwera (env):
 *   META_ACCESS_TOKEN  — długoterminowy token (Page token z long-lived user token)
 *   IG_USER_ID         — ID konta Instagram Business
 *
 * Zwraca pełną galerię (nie tylko 6): zdjęcia, wideo, REELS, karuzele.
 * Wynik cache'owany 30 min (limit zapytań do Meta + szybkość strony).
 */

export const revalidate = 1800; // 30 min

type IgItem = {
  id: string;
  type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  isReel: boolean;
  image: string | null;   // miniatura/zdjęcie do pokazania
  video: string | null;   // URL wideo (gdy VIDEO/REELS)
  caption: string;
  permalink: string;
  timestamp: string;
};

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const igId = process.env.IG_USER_ID;

  if (!token || !igId) {
    return NextResponse.json({ configured: false, media: [] as IgItem[] });
  }

  const fields = [
    "id", "caption", "media_type", "media_product_type",
    "media_url", "thumbnail_url", "permalink", "timestamp",
  ].join(",");
  const url = `https://graph.facebook.com/v21.0/${igId}/media?fields=${encodeURIComponent(fields)}&limit=24&access_token=${token}`;

  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    const j = await r.json();
    if (j.error) {
      return NextResponse.json({ configured: true, error: j.error.message || "graph error", media: [] as IgItem[] });
    }
    const media: IgItem[] = (j.data || []).map((m: any) => {
      const isVideo = m.media_type === "VIDEO";
      const isReel = m.media_product_type === "REELS";
      return {
        id: m.id,
        type: m.media_type,
        isReel,
        image: isVideo ? (m.thumbnail_url || m.media_url || null) : (m.media_url || null),
        video: isVideo ? (m.media_url || null) : null,
        caption: m.caption || "",
        permalink: m.permalink || "",
        timestamp: m.timestamp || "",
      };
    });
    return NextResponse.json({ configured: true, media });
  } catch (e) {
    return NextResponse.json({ configured: true, error: String(e), media: [] as IgItem[] });
  }
}
