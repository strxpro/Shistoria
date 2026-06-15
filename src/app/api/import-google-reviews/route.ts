/**
 * /api/import-google-reviews — automatyczny import recenzji z wizytówki Google.
 *
 * Używa OFICJALNEGO Google Places API (Place Details → pole `reviews`).
 * NIE scrapuje (scraping Google/TripAdvisor łamie ich regulamin i jest kruchy).
 *
 * Konfiguracja (env w Vercel):
 *   GOOGLE_PLACES_API_KEY — klucz API (Google Cloud → Places API włączone)
 *   GOOGLE_PLACE_ID       — Place ID lokalu (z https://developers.google.com/maps/documentation/places/web-service/place-id)
 *   ANNOUNCE_SECRET       — (opcjonalnie) sekret do wywołań z crona
 *
 * Wywołanie (np. cron-job.org raz dziennie):
 *   GET /api/import-google-reviews?secret=XXX
 *
 * Dedup: kolumna reviews.ext_id (UNIQUE) = `google:<time>:<autor>`.
 * Nowe recenzje są od razu approvate (is_approved=true) i pojawiają się na stronie.
 *
 * Uwaga: Google Places API zwraca maks. ~5 najnowszych recenzji na lokal
 * (ograniczenie API). Dla pełnej historii potrzebny jest płatny dostęp/ręczny
 * import w panelu admina (Recensioni → „+ Recensione esterna").
 *
 * TripAdvisor: nie ma otwartego API do pobierania recenzji bez akceptacji do
 * ich Content API (wymaga wniosku). Dlatego TripAdvisor dodajesz ręcznie w adminie.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const PLACE_ID = process.env.GOOGLE_PLACE_ID || "";
const SECRET = process.env.ANNOUNCE_SECRET || "shistoria-cron";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Jeśli sekret jest ustawiony w env, wymagaj go (ochrona przed nadużyciem limitu API).
  if (process.env.ANNOUNCE_SECRET && searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!KEY || !PLACE_ID) {
    return NextResponse.json({ error: "missing_google_config", hint: "Ustaw GOOGLE_PLACES_API_KEY i GOOGLE_PLACE_ID w env" }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(PLACE_ID)}&fields=reviews&reviews_sort=newest&language=it&key=${encodeURIComponent(KEY)}`;
  let reviews: any[] = [];
  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j.status && j.status !== "OK") {
      return NextResponse.json({ error: "google_api_error", status: j.status, message: j.error_message || "" }, { status: 502 });
    }
    reviews = j?.result?.reviews || [];
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_failed", message: e?.message || String(e) }, { status: 502 });
  }

  let imported = 0;
  const skipped: string[] = [];
  for (const rv of reviews) {
    const text = (rv.text || "").trim();
    if (!text) { skipped.push("no_text"); continue; }
    const ext_id = `google:${rv.time}:${String(rv.author_name || "").slice(0, 24)}`;
    const exists = await supabase.from("reviews").select("id").eq("ext_id", ext_id).maybeSingle();
    if (exists.data) { skipped.push("dup"); continue; }
    const ins = await supabase.from("reviews").insert({
      name: rv.author_name || "Google",
      content: text,
      stars: Math.max(1, Math.min(5, Math.round(rv.rating || 5))),
      source: "Google",
      language: rv.language || rv.original_language || "it",
      photo_url: rv.profile_photo_url || null,
      ext_id,
      is_approved: true,
    });
    if (!ins.error) imported++;
    else skipped.push(ins.error.message);
  }

  return NextResponse.json({ ok: true, found: reviews.length, imported, skipped });
}
