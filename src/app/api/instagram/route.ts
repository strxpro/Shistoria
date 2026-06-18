import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * /api/instagram — feed Instagrama dla sekcji "Social".
 *
 * ŹRÓDŁO 1 (zalecane): tabela Supabase `social_posts` napełniana przez make.com
 *   (posty, wideo, Reels oraz aktywne Stories). Bez tokenów w aplikacji.
 * ŹRÓDŁO 2 (fallback): bezpośrednio Graph API, jeśli ustawisz
 *   META_ACCESS_TOKEN + IG_USER_ID (i nie używasz make).
 *
 * Zwraca: { media: [...posty/reels...], stories: [...aktywne stories...] }
 */

export const revalidate = 300; // 5 min

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function fromSupabase() {
  if (!SB_KEY) return null;
  try {
    const sb = createClient(SB_URL, SB_KEY);
    const { data, error } = await sb
      .from("social_posts")
      .select("external_id,kind,media_type,is_reel,image_url,video_url,caption,permalink,posted_at,likes,comments")
      .eq("platform", "instagram")
      .order("posted_at", { ascending: false })
      .limit(60);
    if (error || !data) return null;
    const map = (m: any) => ({
      id: m.external_id,
      type: m.media_type,
      isReel: !!m.is_reel,
      image: m.image_url || null,
      video: m.video_url || null,
      caption: m.caption || "",
      permalink: m.permalink || "",
      timestamp: m.posted_at || "",
      likes: m.likes || 0,
      comments: Array.isArray(m.comments) ? m.comments : [],
    });
    const media = data.filter((d: any) => d.kind === "post").slice(0, 24).map(map);
    const stories = data.filter((d: any) => d.kind === "story").slice(0, 12).map(map);
    if (media.length === 0 && stories.length === 0) return null;
    return { configured: true, source: "supabase", media, stories };
  } catch {
    return null;
  }
}

async function fromGraph() {
  const token = process.env.META_ACCESS_TOKEN;
  const igId = process.env.IG_USER_ID;
  if (!token || !igId) return { configured: false, media: [], stories: [] };
  const fields = ["id", "caption", "media_type", "media_product_type", "media_url", "thumbnail_url", "permalink", "timestamp"].join(",");
  const url = `https://graph.facebook.com/v21.0/${igId}/media?fields=${encodeURIComponent(fields)}&limit=24&access_token=${token}`;
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    const j = await r.json();
    if (j.error) return { configured: true, error: j.error.message, media: [], stories: [] };
    const media = (j.data || []).map((m: any) => {
      const isVideo = m.media_type === "VIDEO";
      return {
        id: m.id,
        type: m.media_type,
        isReel: m.media_product_type === "REELS",
        image: isVideo ? (m.thumbnail_url || m.media_url || null) : (m.media_url || null),
        video: isVideo ? (m.media_url || null) : null,
        caption: m.caption || "",
        permalink: m.permalink || "",
        timestamp: m.timestamp || "",
        likes: m.like_count || 0,
        comments: [],
      };
    });
    return { configured: true, source: "graph", media, stories: [] };
  } catch (e) {
    return { configured: true, error: String(e), media: [], stories: [] };
  }
}

export async function GET() {
  const sb = await fromSupabase();
  if (sb) return NextResponse.json(sb);
  return NextResponse.json(await fromGraph());
}
