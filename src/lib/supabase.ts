import { createClient } from '@supabase/supabase-js';

// Klucze czytane ze zmiennych środowiskowych (Vercel → Environment Variables).
// Fallback na dotychczasowe wartości, żeby aplikacja działała nawet bez konfiguracji env.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: get public URL for asset in storage
export function getAssetUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/assets/${path}`;
}

// Helper: upload photo for community drink
export async function uploadDrinkPhoto(file: File, drinkId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `drinks/${drinkId}.${ext}`;
  
  const { error } = await supabase.storage
    .from('assets')
    .upload(filePath, file, { upsert: true });
  
  if (error) {
    console.error('Upload error:', error);
    return null;
  }
  
  return getAssetUrl(filePath);
}

// Helper: get or create session ID (for likes without login)
export function getSessionId(): string {
  try {
    if (typeof localStorage === 'undefined') return 'server';
    let sid = localStorage.getItem('sh-session-id');
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'sid-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem('sh-session-id', sid);
    }
    return sid;
  } catch {
    return 'sid-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

// ─── Community Drinks API ─────────────────────────────────────────────────────

export async function publishDrink(drink: {
  name: string;
  author_name: string;
  author_email?: string;
  ingredients: { id: string; name: string; color: string; ml: number }[];
  total_ml: number;
  strength_label: string;
  strength_value: number;
  color: string;
  photo_url?: string;
  lang?: string; // język autora — do maila Drinka Miesiąca w jego języku
}) {
  const { data, error } = await supabase
    .from('community_drinks')
    .insert({ ...drink, is_published: true })
    .select()
    .single();
  
  if (error) console.error('Publish error:', error);
  return data;
}

export async function getCommunityDrinks(limit = 12, offset = 0) {
  const { data, error } = await supabase
    .from('community_drinks')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) console.error('Fetch drinks error:', error);
  return data || [];
}

/** Statystyki pojedynczego drinka twórcy (po ID z bazy lub po nazwie+autorze). */
export async function getDrinkStats(opts: { id?: string; name?: string; author?: string }) {
  let q = supabase
    .from('community_drinks')
    .select('id,name,author_name,views,likes,comments,claimed_count,created_at,photo_url');
  if (opts.id) {
    q = q.eq('id', opts.id);
  } else if (opts.name) {
    q = q.eq('name', opts.name);
    if (opts.author) q = q.eq('author_name', opts.author);
  } else {
    return null;
  }
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1);
  if (error) { console.error('Stats error:', error); return null; }
  return (data && data[0]) || null;
}

/** Usuń drink twórcy z community (best-effort — RLS może zablokować). */
export async function deleteMyDrink(id: string): Promise<boolean> {
  if (!id) return false;
  const { error } = await supabase.from('community_drinks').delete().eq('id', id);
  if (error) { console.warn('Delete drink (RLS?):', error.message); return false; }
  return true;
}

export async function likeDrink(drinkId: string) {
  const sid = getSessionId();
  const { error } = await supabase
    .from('drink_likes')
    .insert({ drink_id: drinkId, session_id: sid });
  
  if (error && error.code === '23505') return false; // already liked
  if (error) console.error('Like error:', error);
  
  // Increment counter
  await supabase.rpc('increment_likes', { drink_uuid: drinkId });
  return !error;
}

export async function addComment(drinkId: string, author: string, content: string, parentId?: string | null) {
  const payload: Record<string, unknown> = { drink_id: drinkId, author, content };
  if (parentId) payload.parent_id = parentId;
  const { data, error } = await supabase
    .from('drink_comments')
    .insert(payload)
    .select()
    .single();

  if (error) {
    // Fallback: jeśli kolumna parent_id jeszcze nie istnieje w bazie, zapisz bez niej
    if (parentId) {
      const { data: d2 } = await supabase
        .from('drink_comments')
        .insert({ drink_id: drinkId, author, content })
        .select()
        .single();
      if (d2) return d2;
    }
    console.error('Comment error:', error);
  }
  return data;
}

// D3: najnowsze komentarze drinka (styl IG — tylko top-level, najnowsze pod postem)
export async function getComments(drinkId: string, limit = 3) {
  // Top-level = bez parent_id. Gdy kolumna nie istnieje, zapytanie i tak zwróci wszystko.
  let query = supabase
    .from('drink_comments')
    .select('*')
    .eq('drink_id', drinkId)
    .order('created_at', { ascending: false })
    .limit(limit);
  try { query = (query as any).is('parent_id', null); } catch { /* kolumna może nie istnieć */ }
  const { data, error } = await query;
  if (error) {
    // Fallback bez filtra parent_id
    const { data: d2 } = await supabase
      .from('drink_comments').select('*').eq('drink_id', drinkId)
      .order('created_at', { ascending: false }).limit(limit);
    return d2 || [];
  }
  return data || [];
}

// Wszystkie komentarze drinka (top-level + odpowiedzi) — do popoutu IG.
export async function getCommentsFull(drinkId: string): Promise<{ top: any[]; repliesByParent: Record<string, any[]> }> {
  const { data, error } = await supabase
    .from('drink_comments')
    .select('*')
    .eq('drink_id', drinkId)
    .order('created_at', { ascending: true });
  if (error || !data) return { top: [], repliesByParent: {} };
  const top: any[] = [];
  const repliesByParent: Record<string, any[]> = {};
  for (const c of data) {
    if (c.parent_id) {
      (repliesByParent[c.parent_id] ||= []).push(c);
    } else {
      top.push(c);
    }
  }
  // top: najnowsze pierwsze
  top.reverse();
  return { top, repliesByParent };
}

// Polub / cofnij polubienie komentarza (toggle). Zwraca nowy stan: true=polubiony.
export async function toggleCommentLike(commentId: string): Promise<boolean> {
  if (!commentId || commentId.startsWith('tmp-')) return false;
  const sid = getSessionId();
  // Sprawdź, czy już polubione
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('session_id', sid)
    .maybeSingle();
  if (existing) {
    await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('session_id', sid);
    await supabase.rpc('decrement_comment_likes', { cmt_uuid: commentId });
    return false;
  }
  const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, session_id: sid });
  if (error && error.code === '23505') return true; // już polubione (wyścig)
  await supabase.rpc('increment_comment_likes', { cmt_uuid: commentId });
  return true;
}

// Które komentarze polubił bieżący użytkownik (do inicjalizacji serduszek).
export async function getMyCommentLikes(commentIds: string[]): Promise<Set<string>> {
  const ids = commentIds.filter((id) => id && !id.startsWith('tmp-'));
  if (ids.length === 0) return new Set();
  const sid = getSessionId();
  const { data } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('session_id', sid)
    .in('comment_id', ids);
  return new Set((data || []).map((r: any) => r.comment_id));
}

// Statystyka: zwiększ licznik wyświetleń drinka (otwarcie popoutu). Jednorazowo na sesję/drink.
export async function incrementDrinkView(drinkId: string) {
  if (!drinkId || drinkId.startsWith('tmp-')) return;
  try {
    const key = 'sh-viewed-drinks';
    const seen: string[] = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (seen.includes(drinkId)) return;
    seen.push(drinkId);
    sessionStorage.setItem(key, JSON.stringify(seen));
  } catch { /* brak sessionStorage */ }
  try { await supabase.rpc('increment_drink_views', { drink_uuid: drinkId }); } catch { /* RPC może nie istnieć */ }
}

// ─── Orders (QR barman) ───────────────────────────────────────────────────────

export function newOrderId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallback poniżej */ }
  // Fallback UUID v4 (starsze przeglądarki)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function createOrder(drink: {
  id?: string;
  drink_id?: string;
  drink_name: string;
  author_name: string;
  ingredients: any[];
  total_ml: number;
  strength_label: string;
}) {
  // 4-znakowy kod odbioru (ważny 15 min) — alternatywa dla skanu QR
  const code = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const { data, error } = await supabase
    .from('drink_orders')
    .insert({ ...drink, pickup_code: code })
    .select()
    .single();

  if (error) {
    // Baza może nie mieć kolumny pickup_code (migracja setup-community-tables.sql
    // nieuruchomiona) — bez retry KAŻDE zamówienie padało i QR nigdy się nie generował.
    if (error.code === 'PGRST204' || /pickup_code/.test(error.message || '')) {
      const retry = await supabase.from('drink_orders').insert({ ...drink }).select().single();
      if (retry.error) console.error('Order error (retry):', retry.error);
      return retry.data;
    }
    console.error('Order error:', error);
  }
  return data;
}

// ─── Claim (odbiór drinka) ────────────────────────────────────────────────────

export async function claimDrink(drinkId: string, claimerName: string) {
  // Tworzy zamówienie (QR) z powiązaniem do drinka community
  const { data: drink } = await supabase
    .from('community_drinks')
    .select('*')
    .eq('id', drinkId)
    .single();
  
  if (!drink) return null;

  // Utwórz order dla barmana
  const order = await createOrder({
    drink_id: drinkId,
    drink_name: drink.name,
    author_name: claimerName || 'Anonimo',
    ingredients: drink.ingredients || [],
    total_ml: drink.total_ml,
    strength_label: drink.strength_label,
  });

  // Zwiększ licznik claimed
  const { error: rpcErr } = await supabase.rpc('increment_claims', { drink_uuid: drinkId });
  if (rpcErr) {
    // fallback: ręcznie zwiększ (RPC może nie istnieć)
    const { data: cur } = await supabase.from('community_drinks')
      .select('claimed_count')
      .eq('id', drinkId)
      .single();
    if (cur) {
      await supabase.from('community_drinks')
        .update({ claimed_count: (cur.claimed_count || 0) + 1 })
        .eq('id', drinkId);
    }
  }

  return order;
}

export async function getClaimCount(drinkId: string): Promise<number> {
  const { data } = await supabase
    .from('community_drinks')
    .select('claimed_count')
    .eq('id', drinkId)
    .single();
  return data?.claimed_count || 0;
}

export async function getOrder(orderId: string) {
  const { data, error } = await supabase
    .from('drink_orders')
    .select('*')
    .eq('id', orderId)
    .single();
  
  if (error) console.error('Get order error:', error);
  return data;
}

// ─── Menu (admin) ─────────────────────────────────────────────────────────────

export async function getMenuItems() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (error) console.error('Menu error:', error);
  return data || [];
}

// Polub / cofnij polubienie dania (toggle). Zwraca nowy stan: true=polubione, false=cofnięte.
export async function toggleMenuLike(itemId: string): Promise<boolean> {
  if (!itemId) return false;
  try {
    const key = 'sh-menu-liked';
    const liked: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const already = liked.includes(itemId);
    const delta = already ? -1 : 1;
    const { error } = await supabase.rpc('increment_menu_like', { item_id: itemId, delta });
    if (error) {
      // fallback bez nowego RPC (stara sygnatura/brak): pobierz + update
      const { data } = await supabase.from('menu_items').select('likes').eq('id', itemId).single();
      const next = Math.max(0, ((data?.likes as number) || 0) + delta);
      await supabase.from('menu_items').update({ likes: next }).eq('id', itemId);
    }
    if (already) {
      localStorage.setItem(key, JSON.stringify(liked.filter((x) => x !== itemId)));
      return false;
    } else {
      liked.push(itemId);
      localStorage.setItem(key, JSON.stringify(liked));
      return true;
    }
  } catch (e) {
    console.error('toggleMenuLike error:', e);
    return false;
  }
}

// (kompat.) Polub danie — używa toggle, ale tylko dodaje.
export async function likeMenuItem(itemId: string): Promise<boolean> {
  const key = 'sh-menu-liked';
  try {
    const liked: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (liked.includes(itemId)) return false;
  } catch {}
  return toggleMenuLike(itemId);
}

// Mapa polubień menu po nazwie pozycji (front używa statycznego FULL_MENU, łączymy po name).
export async function getMenuLikes(): Promise<Record<string, { id: string; likes: number; name_i18n?: any; desc_i18n?: any }>> {
  const { data } = await supabase.from('menu_items').select('id,name,likes,name_i18n,desc_i18n');
  const map: Record<string, { id: string; likes: number; name_i18n?: any; desc_i18n?: any }> = {};
  (data || []).forEach((r: any) => { if (r.name) map[String(r.name).trim().toLowerCase()] = { id: r.id, likes: r.likes || 0, name_i18n: r.name_i18n, desc_i18n: r.desc_i18n }; });
  return map;
}


// ─── Events (admin) ───────────────────────────────────────────────────────────

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_published', true)
    .order('event_date', { ascending: true });
  
  if (error) console.error('Events error:', error);
  return data || [];
}
