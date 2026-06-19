import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * /api/facebook — posty Strony FB dla sekcji "Social".
 *
 * ŹRÓDŁO 1 (zalecane): tabela Supabase `social_posts` (platform='facebook'),
 *   napełniana przez make.com. Bez iframe → adblock nie blokuje.
 * ŹRÓDŁO 2 (fallback): Graph API, jeśli ustawisz META_ACCESS_TOKEN + FB_PAGE_ID.
 */

export const revalidate = 300;

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function fromSupabase() {
  if (!SB_KEY) return null;
  try {
    const sb = createClient(SB_URL, SB_KEY);
    const { data, error } = await sb
      .from("social_posts")
      .select("external_id,image_url,caption,permalink,posted_at,likes,comments")
      .eq("platform", "facebook")
      .eq("kind", "post")
      .order("posted_at", { ascending: false })
      .limit(8);
    if (error || !data || data.length === 0) return null;
    const posts = data.map((p: any) => ({
      id: p.external_id,
      message: p.caption || "",
      image: p.image_url || null,
      permalink: p.permalink || "",
      created: p.posted_at || "",
      likes: p.likes || 0,
      comments: Array.isArray(p.comments) ? p.comments : [],
    }));
    return { configured: true, source: "supabase", posts };
  } catch {
    return null;
  }
}

async function fromGraph() {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) return { configured: false, posts: [] };
  const fields = "message,story,full_picture,permalink_url,created_time";
  const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=8&access_token=${token}`;
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    const j = await r.json();
    if (j.error) return { configured: true, error: j.error.message, posts: [] };
    const posts = (j.data || [])
      .map((p: any) => ({
        id: p.id,
        message: p.message || p.story || "",
        image: p.full_picture || null,
        permalink: p.permalink_url || `https://www.facebook.com/${pageId}`,
        created: p.created_time || "",
      }))
      .filter((p: any) => p.message || p.image);
    return { configured: true, source: "graph", posts };
  } catch (e) {
    return { configured: true, error: String(e), posts: [] };
  }
}

export async function GET() {
  const sb = await fromSupabase();
  if (sb) return NextResponse.json(sb);
  return NextResponse.json(await fromGraph());
}
