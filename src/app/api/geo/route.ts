/**
 * /api/geo — kraj użytkownika po stronie serwera (niezawodne wykrycie języka).
 *
 * Najpewniejsze źródło: nagłówki geolokalizacji dokładane przez Vercel / Cloudflare
 * (x-vercel-ip-country / cf-ipcountry) — natychmiast, bez zewnętrznego API i bez CORS.
 * Fallback: serwerowe zapytanie do ipwho.is po IP klienta (gdy brak nagłówków).
 *
 * GET → { country: "IT" | "PL" | ... | "" }
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const h = req.headers;
  let country =
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("x-country-code") ||
    "";

  if (!country) {
    // Fallback: użyj IP klienta (nie serwera!) do zapytania geo
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim();
    try {
      const res = await fetch(`https://ipwho.is/${ip || ""}`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        country = (d?.country_code || "").toString();
      }
    } catch { /* zwróć puste — front ma dalsze fallbacki */ }
  }

  return NextResponse.json({ country: (country || "").toUpperCase().slice(0, 2) });
}
