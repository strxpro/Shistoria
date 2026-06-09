/**
 * analytics.ts — lekkie śledzenie odwiedzin (kraj, źródło, czas, sekcje).
 * Zapisuje do Supabase `analytics_visits` + `analytics_sections`.
 * Zero zewnętrznych trackerów — własne, prywatne (RODO-friendly, bez cookies).
 */
import { supabase, getSessionId } from "./supabase";

let _started = 0;
let _visitId: string | null = null;
const _sectionTime: Record<string, number> = {};
let _currentSection: string | null = null;
let _sectionEnter = 0;

function detectReferrer(): { referrer: string; utm: string } {
  if (typeof window === "undefined") return { referrer: "direct", utm: "" };
  const params = new URLSearchParams(window.location.search);
  const utm = params.get("utm_source") || "";
  const ref = document.referrer || "";
  let source = "direct";
  if (utm) source = utm;
  else if (ref.includes("instagram")) source = "instagram";
  else if (ref.includes("facebook")) source = "facebook";
  else if (ref.includes("google")) source = "google";
  else if (ref.includes("mail") || utm === "email") source = "email";
  else if (ref) { try { source = new URL(ref).hostname; } catch { source = "other"; } }
  return { referrer: source, utm };
}

/** Start śledzenia wizyty — wywołaj raz przy starcie aplikacji. */
export async function startTracking() {
  if (typeof window === "undefined" || _visitId) return;
  _started = Date.now();
  const sid = getSessionId();
  const { referrer, utm } = detectReferrer();
  const lang = (window as any).currentLanguage || (navigator.language || "it").split("-")[0];

  // Kraj z ipapi (darmowe) — bez blokowania renderu
  let country = "", country_name = "", city = "";
  try {
    const r = await fetch("https://ipapi.co/json/");
    const j = await r.json();
    country = j.country_code || ""; country_name = j.country_name || ""; city = j.city || "";
  } catch { /* ignore */ }

  try {
    const { data } = await supabase.from("analytics_visits").insert({
      session_id: sid, country, country_name, city, referrer, utm_source: utm, language: lang,
    }).select().single();
    _visitId = data?.id || null;
  } catch { /* ignore */ }

  // Zapisz czas trwania + sekcje przy wyjściu
  const flush = () => {
    if (_currentSection) { _sectionTime[_currentSection] = (_sectionTime[_currentSection] || 0) + (Date.now() - _sectionEnter) / 1000; }
    const duration = Math.round((Date.now() - _started) / 1000);
    const top = Object.entries(_sectionTime).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    if (_visitId) {
      // sendBeacon — działa nawet przy zamykaniu karty
      try {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co"}/rest/v1/analytics_visits?id=eq.${_visitId}`;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
          body: JSON.stringify({ duration_seconds: duration, top_section: top }), keepalive: true });
      } catch { /* ignore */ }
    }
  };
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
}

/** Oznacz wejście w sekcję (z IntersectionObserver w app). */
export function trackSection(section: string) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (_currentSection && _currentSection !== section) {
    _sectionTime[_currentSection] = (_sectionTime[_currentSection] || 0) + (now - _sectionEnter) / 1000;
  }
  if (_currentSection !== section) { _currentSection = section; _sectionEnter = now; }
}

/** Oznacz konwersję (wysłany formularz / zamówienie). */
export async function trackConversion() {
  if (!_visitId) return;
  try { await supabase.from("analytics_visits").update({ is_conversion: true }).eq("id", _visitId); } catch { /* ignore */ }
}
