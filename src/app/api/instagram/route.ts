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

// Normalizuje pole `children` (karuzela) do tablicy { image, video, type }.
function normChildren(raw: any): any[] {
  let arr = raw;
  if (typeof arr === "string") {
    try { arr = JSON.parse(arr); } catch { arr = null; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((c: any) => {
      const isVideo = c.media_type === "VIDEO" || !!c.video_url || !!c.video;
      return {
        type: c.media_type || (isVideo ? "VIDEO" : "IMAGE"),
        image: c.image_url || c.thumbnail_url || c.media_url || c.image || (isVideo ? null : c.url) || null,
        video: isVideo ? (c.video_url || c.media_url || c.video || null) : null,
      };
    })
    .filter((c: any) => c.image || c.video);
}

async function fromSupabase() {
  if (!SB_KEY) return null;
  try {
    const sb = createClient(SB_URL, SB_KEY);
    const { data, error } = await sb
      .from("social_posts")
      .select("external_id,kind,media_type,is_reel,image_url,video_url,caption,permalink,posted_at,likes,comments,children,username")
      .eq("platform", "instagram")
      .order("posted_at", { ascending: false })
      .limit(80);
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
      children: normChildren(m.children),
      username: m.username || "",
    });
    const byDate = (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    const media = data.filter((d: any) => d.kind === "post").map(map).sort(byDate).slice(0, 30);
    const stories = data.filter((d: any) => d.kind === "story").map(map).sort(byDate).slice(0, 12);
    const mentions = data.filter((d: any) => d.kind === "mention").map(map).sort(byDate).slice(0, 12);
    if (media.length === 0 && stories.length === 0 && mentions.length === 0) return null;
    return { configured: true, source: "supabase", media, stories, mentions };
  } catch {
    return null;
  }
}

async function fromGraph() {
  const token = process.env.META_ACCESS_TOKEN;
  const igId = process.env.IG_USER_ID;
  if (!token || !igId) return { configured: false, media: [], stories: [], mentions: [] };
  const childFields = "children{media_type,media_url,thumbnail_url}";
  const fields = ["id", "caption", "media_type", "media_product_type", "media_url", "thumbnail_url", "permalink", "timestamp", "like_count", "comments_count", childFields].join(",");
  const url = `https://graph.facebook.com/v21.0/${igId}/media?fields=${encodeURIComponent(fields)}&limit=30&access_token=${token}`;
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    const j = await r.json();
    if (j.error) return { configured: true, error: j.error.message, media: [], stories: [], mentions: [] };
    const media = (j.data || []).map((m: any) => {
      const isVideo = m.media_type === "VIDEO";
      const children = (m.children?.data || []).map((c: any) => {
        const cv = c.media_type === "VIDEO";
        return { type: c.media_type, image: cv ? (c.thumbnail_url || c.media_url || null) : (c.media_url || null), video: cv ? (c.media_url || null) : null };
      }).filter((c: any) => c.image || c.video);
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
        children,
        username: "",
      };
    });
    media.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { configured: true, source: "graph", media, stories: [], mentions: [] };
  } catch (e) {
    return { configured: true, error: String(e), media: [], stories: [], mentions: [] };
  }
}

export async function GET() {
  const sb = await fromSupabase();
  if (sb) return NextResponse.json(sb);
  return NextResponse.json(await fromGraph());
}
