/**
 * Auto-tłumaczenie tekstu (prosty helper).
 * W produkcji podłączyć pod Google Translate API lub DeepL.
 * Na razie: cache z prostymi tłumaczeniami + fallback do oryginału.
 */

const CACHE_KEY = "sh-translations";

type LangCode = "it" | "pl" | "en" | "de" | "fr" | "es";

// Proste tłumaczenia (placeholder — w produkcji API)
const SIMPLE_DICT: Record<string, Record<LangCode, string>> = {
  "Live Music": { it: "Musica dal vivo", pl: "Muzyka na żywo", en: "Live Music", de: "Live-Musik", fr: "Musique live", es: "Música en vivo" },
  "Degustazione": { it: "Degustazione", pl: "Degustacja", en: "Tasting", de: "Verkostung", fr: "Dégustation", es: "Degustación" },
  "Special Dinner": { it: "Cena speciale", pl: "Kolacja specjalna", en: "Special Dinner", de: "Spezielles Dinner", fr: "Dîner spécial", es: "Cena especial" },
  "Aperitivo": { it: "Aperitivo", pl: "Aperitivo", en: "Aperitivo", de: "Aperitivo", fr: "Apéritif", es: "Aperitivo" },
};

// Pobierz tłumaczenie z cache
function getFromCache(text: string, lang: LangCode): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return cache[`${lang}:${text}`] || null;
  } catch { return null; }
}

// Zapisz tłumaczenie do cache
function saveToCache(text: string, lang: LangCode, translation: string) {
  if (typeof localStorage === "undefined") return;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    cache[`${lang}:${text}`] = translation;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

/**
 * Przetłumacz tekst na dany język.
 * Używa prostego słownika + cache. W przyszłości: API call.
 */
export async function translateText(text: string, targetLang: LangCode): Promise<string> {
  if (targetLang === "it") return text; // Oryginał to włoski

  // Sprawdź prosty słownik
  if (SIMPLE_DICT[text]?.[targetLang]) return SIMPLE_DICT[text][targetLang];

  // Sprawdź cache
  const cached = getFromCache(text, targetLang);
  if (cached) return cached;

  // TODO: W produkcji — call do Google Translate API:
  // const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=YOUR_KEY`, {
  //   method: 'POST',
  //   body: JSON.stringify({ q: text, source: 'it', target: targetLang, format: 'text' })
  // });
  // const data = await response.json();
  // const translation = data.data.translations[0].translatedText;
  // saveToCache(text, targetLang, translation);
  // return translation;

  // Fallback: zwróć oryginał z prefiksem języka (do debugowania)
  return text;
}

/**
 * Przetłumacz obiekt z eventami na wszystkie języki.
 * Zwraca obiekt { pl: "...", en: "...", de: "...", fr: "...", es: "..." }
 */
export async function translateEventDescription(
  italianText: string
): Promise<Record<LangCode, string>> {
  const langs: LangCode[] = ["it", "pl", "en", "de", "fr", "es"];
  const result: Record<string, string> = {};

  for (const lang of langs) {
    result[lang] = await translateText(italianText, lang);
  }

  return result as Record<LangCode, string>;
}
