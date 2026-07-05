/**
 * /api/translate — serwerowe tłumaczenie tekstu (bez blokady CORS w przeglądarce).
 *
 * Przeglądarka NIE może wołać `translate.googleapis.com` bezpośrednio (CORS blokuje
 * fetch → tłumaczenie cicho padało i wiadomości zostawały nieprzetłumaczone).
 * Ten endpoint robi to po stronie serwera, więc działa niezawodnie.
 *
 * POST { q: string, target: string, source?: string }  → { text: string }
 *   - source pominięte lub "auto" = automatyczne wykrycie języka źródłowego.
 *
 * Jeśli ustawisz GOOGLE_TRANSLATE_API_KEY (oficjalny klucz) — użyje go.
 * W przeciwnym razie korzysta z darmowego endpointu Google (serwerowo, bez CORS).
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_KEY =
  process.env.GOOGLE_TRANSLATE_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY ||
  "";

async function translateOne(q: string, target: string, source: string): Promise<{ text: string; detected: string }> {
  if (!q || !q.trim()) return { text: "", detected: "" };
  if (target && source && source !== "auto" && target === source) return { text: q, detected: source };

  // 1) Oficjalne API (jeśli jest klucz)
  if (API_KEY) {
    try {
      const body: Record<string, string> = { q, target, format: "text" };
      if (source && source !== "auto") body.source = source;
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const tr = data?.data?.translations?.[0];
        if (tr?.translatedText) {
          return { text: tr.translatedText, detected: tr.detectedSourceLanguage || (source !== "auto" ? source : "") };
        }
      }
    } catch { /* fallback niżej */ }
  }

  // 2) Darmowy endpoint (serwerowo — brak problemu CORS)
  try {
    const sl = source && source !== "auto" ? source : "auto";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const text = data[0].map((seg: any) => seg[0]).join("") || q;
        const detected = (typeof data[2] === "string" && data[2]) || (sl !== "auto" ? sl : "");
        return { text, detected };
      }
    }
  } catch { /* zwróć oryginał */ }

  return { text: q, detected: source !== "auto" ? source : "" };
}

export async function POST(req: NextRequest) {
  try {
    const { q, target, source } = await req.json();
    if (!q || !target) {
      return NextResponse.json({ error: "missing q/target" }, { status: 400 });
    }
    const { text, detected } = await translateOne(String(q), String(target), String(source || "auto"));
    return NextResponse.json({ text, detected });
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
