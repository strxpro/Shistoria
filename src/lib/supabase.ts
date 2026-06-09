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

export async function addComment(drinkId: string, author: string, content: string) {
  const { data, error } = await supabase
    .from('drink_comments')
    .insert({ drink_id: drinkId, author, content })
    .select()
    .single();
  
  if (error) console.error('Comment error:', error);
  return data;
}

// ─── Orders (QR barman) ───────────────────────────────────────────────────────

export async function createOrder(drink: {
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
  
  if (error) console.error('Order error:', error);
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
