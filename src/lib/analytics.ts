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
// Aktywny czas (pauzuje gdy karta w tle) + heartbeat zapisujący czas na bieżąco
let _activeMs = 0;
let _lastTick = 0;
let _heartbeat: ReturnType<typeof setInterval> | null = null;

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

function detectDevice(): { device: string; os: string } {
  if (typeof navigator === "undefined") return { device: "desktop", os: "Desktop" };
  const ua = navigator.userAgent || "";
  const isTablet = /iPad|Tablet/i.test(ua) || (/Macintosh/i.test(ua) && (navigator as any).maxTouchPoints > 1);
  const isMobile = /Mobi|Android|iPhone|iPod/i.test(ua) && !isTablet;
  let os = "Desktop";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator as any).maxTouchPoints > 1)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  const device = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  return { device, os };
}

function storedIdentity(): { email: string; name: string } | null {
  try { const raw = localStorage.getItem("sh-identity"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/** Zapisz tożsamość (email) — wywoływane gdy gość poda email (newsletter, drink, event, recenzja).
 * Przeglądarka pamięta to i podpina analitykę tej sesji (i kolejnych) do emaila. */
export async function setIdentity(email?: string, name?: string) {
  if (typeof window === "undefined" || !email || !email.includes("@")) return;
  const e = email.trim().toLowerCase();
  try { localStorage.setItem("sh-identity", JSON.stringify({ email: e, name: name || storedIdentity()?.name || "" })); } catch { /* ignore */ }
  if (_visitId) {
    try { await supabase.from("analytics_visits").update({ email: e, visitor_name: name || null }).eq("id", _visitId); } catch { /* kolumny mogą nie istnieć */ }
  }
}

/** Start śledzenia wizyty — wywołaj raz przy starcie aplikacji. */
export async function startTracking() {
  if (typeof window === "undefined" || _visitId) return;
  _started = Date.now();
  _lastTick = Date.now();
  _activeMs = 0;
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
    const { device, os } = detectDevice();
    const ident = storedIdentity();
    const base: Record<string, any> = { session_id: sid, country, country_name, city, referrer, utm_source: utm, language: lang };
    const full = { ...base, device, os, email: ident?.email || null, visitor_name: ident?.name || null };
    let res = await supabase.from("analytics_visits").insert(full).select().single();
    if (res.error) {
      // Kolumny device/os/email mogą nie istnieć w bazie — wstaw bez nich (analityka nadal działa)
      res = await supabase.from("analytics_visits").insert(base).select().single();
    }
    _visitId = res.data?.id || null;
  } catch { /* ignore */ }

  // Akumuluj aktywny czas (pomija czas gdy karta jest w tle)
  const accumulate = () => {
    const now = Date.now();
    if (!document.hidden) _activeMs += now - _lastTick;
    _lastTick = now;
  };
  const currentDuration = () => {
    accumulate();
    return Math.max(0, Math.round(_activeMs / 1000));
  };

  // Zapis czasu trwania + sekcji. Heartbeat zapisuje na bieżąco (nie tylko przy wyjściu),
  // dzięki czemu czas NIE jest już 0 nawet gdy beforeunload/pagehide nie zadziała (np. iOS Safari).
  const persist = () => {
    if (!_visitId) return;
    if (_currentSection) { _sectionTime[_currentSection] = (_sectionTime[_currentSection] || 0) + (Date.now() - _sectionEnter) / 1000; _sectionEnter = Date.now(); }
    const duration = currentDuration();
    const top = Object.entries(_sectionTime).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co"}/rest/v1/analytics_visits?id=eq.${_visitId}`;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    try {
      fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
        body: JSON.stringify({ duration_seconds: duration, top_section: top }), keepalive: true });
    } catch { /* ignore */ }
  };

  const flush = () => persist();
  // Heartbeat co 15 s — czas zapisuje się również podczas trwania wizyty (nie tylko przy zamknięciu)
  _heartbeat = setInterval(() => { accumulate(); persist(); }, 15000);
  // visibilitychange (hidden) jest dużo pewniejszy niż beforeunload na telefonach
  document.addEventListener("visibilitychange", () => { accumulate(); if (document.hidden) persist(); });
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);

  // Presence — „ile osób jest teraz online" (Supabase Realtime, darmowe, bez kosztów)
  try {
    const pch = supabase.channel("online-visitors", { config: { presence: { key: sid } } });
    pch.subscribe((status) => {
      if (status === "SUBSCRIBED") pch.track({ online_at: new Date().toISOString(), country, country_name, lang });
    });
    (window as any).__shPresence = pch; // trzymamy referencję, by kanał żył póki karta otwarta
  } catch { /* realtime opcjonalny */ }
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
