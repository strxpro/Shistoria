/**
 * Auto-translate text using Google Translate API (free tier via googleapis fetch).
 * Falls back to original text if translation fails.
 */

const GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

// Klucz API Google Translate — ustaw w .env.local jako GOOGLE_TRANSLATE_API_KEY
// Albo użyj darmowego endpointu (ograniczone zapytania)
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY || process.env.GOOGLE_TRANSLATE_API_KEY || "";

export type Lang = "it" | "pl" | "en" | "de" | "fr" | "es";
export const ALL_LANGS: Lang[] = ["it", "pl", "en", "de", "fr", "es"];
export const TRANSLATE_TARGETS: Lang[] = ["pl", "en", "de", "fr", "es"]; // wszystkie oprócz IT (oryginał)

/**
 * Tłumaczy tekst z włoskiego na dany język.
 * Zwraca przetłumaczony tekst lub oryginał przy błędzie.
 */
export async function translateText(text: string, targetLang: Lang): Promise<string> {
  if (!text || !text.trim()) return "";
  if (targetLang === "it") return text; // oryginał

  // W przeglądarce: serwerowy endpoint /api/translate (darmowy endpoint Google jest
  // blokowany przez CORS, więc bezpośredni fetch z frontu cicho padał).
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: targetLang, source: "it" }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.text) return d.text;
      }
    } catch { /* fallback niżej */ }
    return text;
  }

  // Serwer: Próba z Google Translate API (wymaga klucza)
  if (API_KEY) {
    try {
      const res = await fetch(`${GOOGLE_TRANSLATE_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: "it", target: targetLang, format: "text" }),
      });
      if (res.ok) {
        const data = await res.json();
        return data?.data?.translations?.[0]?.translatedText || text;
      }
    } catch { /* fallback */ }
  }

  // Fallback: darmowy endpoint Google Translate (nieoficjalny, ograniczony)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=it&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      // Format: [[["translated text","original text",...],...]]
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((seg: any) => seg[0]).join("");
      }
    }
  } catch { /* ignore */ }

  return text; // ostatni fallback — oryginał
}

/**
 * Tłumaczy tekst na WSZYSTKIE języki docelowe.
 * Zwraca obiekt { pl: "...", en: "...", de: "...", fr: "...", es: "..." }
 */
export async function translateToAll(textIt: string): Promise<Record<Lang, string>> {
  const result: Record<string, string> = { it: textIt };
  
  // Równoległe tłumaczenie na wszystkie języki
  const translations = await Promise.allSettled(
    TRANSLATE_TARGETS.map(async (lang) => ({
      lang,
      text: await translateText(textIt, lang),
    }))
  );

  for (const t of translations) {
    if (t.status === "fulfilled") {
      result[t.value.lang] = t.value.text;
    }
  }

  return result as Record<Lang, string>;
}

/**
 * Tłumaczy nazwę kategorii na wszystkie języki.
 */
export async function translateCategoryName(nameIt: string): Promise<Record<Lang, string>> {
  return translateToAll(nameIt);
}
