import { NextResponse } from "next/server";

/**
 * /api/facebook — pobiera posty Strony FB przez Graph API (bez iframe,
 * więc adblock/anty-tracker tego NIE zablokuje — w przeciwieństwie do Page Plugin).
 *
 * Env (po stronie serwera):
 *   META_ACCESS_TOKEN — ten sam Page token co dla Instagrama
 *   FB_PAGE_ID        — ID Strony (z me/accounts; patrz INSTAGRAM_API_SETUP.md krok 4)
 *
 * Cache 30 min.
 */

export const revalidate = 1800;

type FbPost = {
  id: string;
  message: string;
  image: string | null;
  permalink: string;
  created: string;
};

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;

  if (!token || !pageId) {
    return NextResponse.json({ configured: false, posts: [] as FbPost[] });
  }

  const fields = "message,story,full_picture,permalink_url,created_time";
  const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=8&access_token=${token}`;

  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    const j = await r.json();
    if (j.error) {
      return NextResponse.json({ configured: true, error: j.error.message || "graph error", posts: [] as FbPost[] });
    }
    const posts: FbPost[] = (j.data || [])
      .map((p: any) => ({
        id: p.id,
        message: p.message || p.story || "",
        image: p.full_picture || null,
        permalink: p.permalink_url || `https://www.facebook.com/${pageId}`,
        created: p.created_time || "",
      }))
      .filter((p: FbPost) => p.message || p.image);
    return NextResponse.json({ configured: true, posts });
  } catch (e) {
    return NextResponse.json({ configured: true, error: String(e), posts: [] as FbPost[] });
  }
}
