/**
 * /api/import-google-reviews — automatyczny, DARMOWY import recenzji z Google do bazy.
 *
 * NIE scrapuje (scraping Google łamie regulamin, jest kruchy i blokowany).
 * Używa OFICJALNYCH, darmowych API Google. Dwa tryby (wykrywane z env):
 *
 * ── TRYB A: Google Business Profile API (ZALECANY) — WSZYSTKIE recenzje ──────
 *   Darmowe dla właściciela wizytówki. Zwraca KOMPLET recenzji (z paginacją),
 *   z imieniem, oceną, treścią i zdjęciem profilowym autora.
 *   Wymaga (jednorazowo) OAuth refresh token konta, które ZARZĄDZA wizytówką:
 *     GOOGLE_OAUTH_CLIENT_ID
 *     GOOGLE_OAUTH_CLIENT_SECRET
 *     GOOGLE_OAUTH_REFRESH_TOKEN     (scope: https://www.googleapis.com/auth/business.manage)
 *     GOOGLE_BUSINESS_ACCOUNT_ID     (np. 123456789  — z mybusinessaccountmanagement accounts.list)
 *     GOOGLE_BUSINESS_LOCATION_ID    (np. 987654321  — z business.information locations.list)
 *   Refresh token najłatwiej wygenerować przez OAuth Playground (instrukcja w
 *   GOOGLE_REVIEWS_IMPORT.md). Wszystko za darmo.
 *
 * ── TRYB B: Places API (fallback) — maks. 5 najnowszych ──────────────────────
 *     GOOGLE_PLACES_API_KEY
 *     GOOGLE_PLACE_ID
 *   Prostszy, ale Google zwraca tylko ~5 recenzji na lokal (limit API).
 *
 * Wywołanie (cron-job.org raz dziennie — nowe recenzje dochodzą same):
 *   GET /api/import-google-reviews?secret=ANNOUNCE_SECRET
 *
 * Dedup: kolumna reviews.ext_id (UNIQUE). Nowe są od razu approvate.
 * TripAdvisor nie ma darmowego API do pobierania — dodajesz ręcznie w adminie.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET = process.env.ANNOUNCE_SECRET || "shistoria-cron";

// ── env ──
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "";
const GBP_ACCOUNT = process.env.GOOGLE_BUSINESS_ACCOUNT_ID || "";
const GBP_LOCATION = process.env.GOOGLE_BUSINESS_LOCATION_ID || "";
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const PLACE_ID = process.env.GOOGLE_PLACE_ID || "";

const STAR_ENUM: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Zapis pojedynczej recenzji (dedup po ext_id). Zwraca true gdy dodano. */
async function upsertReview(r: {
  name: string; content: string; stars: number; language?: string; photo_url?: string | null; ext_id: string;
}): Promise<boolean> {
  if (!r.content.trim()) return false;
  const exists = await supabase.from("reviews").select("id").eq("ext_id", r.ext_id).maybeSingle();
  if (exists.data) return false;
  const ins = await supabase.from("reviews").insert({
    name: r.name || "Google",
    content: r.content.trim(),
    stars: Math.max(1, Math.min(5, r.stars || 5)),
    source: "Google",
    language: r.language || "it",
    photo_url: r.photo_url || null,
    ext_id: r.ext_id,
    is_approved: true,
  });
  return !ins.error;
}

/** Świeży access token z refresh tokena. */
async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        refresh_token: OAUTH_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const j = await res.json();
    return j.access_token || null;
  } catch { return null; }
}

/** TRYB A — Business Profile API: pobierz WSZYSTKIE recenzje (paginacja). */
async function importBusinessProfile() {
  const token = await getAccessToken();
  if (!token) return { mode: "business_profile", error: "oauth_token_failed" };
  const base = `https://mybusiness.googleapis.com/v4/accounts/${GBP_ACCOUNT}/locations/${GBP_LOCATION}/reviews`;
  let pageToken: string | undefined;
  let found = 0, imported = 0, pages = 0;
  do {
    const url = `${base}?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const txt = await res.text();
      return { mode: "business_profile", error: "api_error", status: res.status, detail: txt.slice(0, 300), imported };
    }
    const j = await res.json();
    const reviews: any[] = j.reviews || [];
    found += reviews.length;
    for (const rv of reviews) {
      const ok = await upsertReview({
        name: rv.reviewer?.displayName || "Google",
        content: rv.comment || "",
        stars: STAR_ENUM[rv.starRating] || 5,
        photo_url: rv.reviewer?.profilePhotoUrl || null,
        ext_id: `gbp:${rv.reviewId || rv.name || rv.createTime}`,
      });
      if (ok) imported++;
    }
    pageToken = j.nextPageToken;
    pages++;
    if (pages > 40) break; // bezpiecznik (2000 recenzji)
  } while (pageToken);
  return { mode: "business_profile", found, imported, pages };
}

/** TRYB B — Places API: ~5 najnowszych. */
async function importPlaces() {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(PLACE_ID)}&fields=reviews&reviews_sort=newest&language=it&key=${encodeURIComponent(PLACES_KEY)}`;
  const res = await fetch(url);
  const j = await res.json();
  if (j.status && j.status !== "OK") return { mode: "places", error: "api_error", status: j.status, message: j.error_message || "" };
  const reviews: any[] = j?.result?.reviews || [];
  let imported = 0;
  for (const rv of reviews) {
    const ok = await upsertReview({
      name: rv.author_name || "Google",
      content: rv.text || "",
      stars: Math.round(rv.rating || 5),
      language: rv.language || "it",
      photo_url: rv.profile_photo_url || null,
      ext_id: `google:${rv.time}:${String(rv.author_name || "").slice(0, 24)}`,
    });
    if (ok) imported++;
  }
  return { mode: "places", found: reviews.length, imported };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Autoryzacja: sekret crona LUB PIN admina (przycisk „Importa da Google" w panelu).
  const pinOk = searchParams.get("pin") === (process.env.ADMIN_PIN || "shistoria2026");
  if (process.env.ANNOUNCE_SECRET && searchParams.get("secret") !== SECRET && !pinOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Preferuj Business Profile (wszystkie recenzje), inaczej Places (5).
  if (OAUTH_REFRESH_TOKEN && OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && GBP_ACCOUNT && GBP_LOCATION) {
    const r = await importBusinessProfile();
    return NextResponse.json({ ok: !r.error, ...r });
  }
  if (PLACES_KEY && PLACE_ID) {
    const r = await importPlaces();
    return NextResponse.json({ ok: !r.error, ...r });
  }
  return NextResponse.json({
    error: "missing_config",
    hint: "Ustaw GOOGLE_OAUTH_* + GOOGLE_BUSINESS_* (wszystkie recenzje) albo GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID (5 recenzji). Szczególy: GOOGLE_REVIEWS_IMPORT.md",
  }, { status: 500 });
}
