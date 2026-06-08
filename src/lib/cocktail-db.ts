/**
 * TheCocktailDB — darmowe API drinków (klucz testowy "1").
 * Multi-ingredient filter jest Premium, więc robimy obejście:
 * pobieramy listy per składnik (filter.php?i=X) i przecinamy je po stronie klienta.
 *
 * Konfiguracja: window.__COCKTAILDB_KEY = "1" (domyślnie) lub klucz premium.
 */

const BASE = "https://www.thecocktaildb.com/api/json/v1";
const getKey = () => (typeof window !== "undefined" && (window as any).__COCKTAILDB_KEY) || "1";

// Mapowanie naszych ID składników → nazwy składników w TheCocktailDB (angielskie).
// Tylko najważniejsze bazy alkoholowe + popularne mixery (te które API rozpoznaje).
const ING_MAP: Record<string, string> = {
  // Alkohole bazowe
  gin: "Gin", "gin-bombay": "Gin", "gin-tanqueray": "Gin", "gin-botanist": "Gin", "gin-mare": "Gin", "gin-pink": "Gin",
  vodka: "Vodka", "vodka-beluga": "Vodka", "vodka-citr": "Vodka",
  rum: "Rum", "rum-bianco": "Light rum", "rum-don-papa": "Dark rum", "rum-kraken": "Spiced rum",
  tequila: "Tequila", "tequila-1800": "Tequila", "tequila-dobel": "Tequila",
  whisky: "Whiskey", "whisky-high-comm": "Whiskey", "jack-daniels": "Whiskey", jameson: "Irish whiskey", bourbon: "Bourbon",
  // Likiery
  aperol: "Aperol", campari: "Campari", cointreau: "Triple sec", limoncello: "Limoncello",
  prosecco: "Prosecco", "vermouth-r": "Sweet Vermouth", baileys: "Baileys irish cream",
  // Mixery / soki
  "coca-cola": "Coca-Cola", "coca-zero": "Coca-Cola", tonica: "Tonic water", "tonica-prem": "Tonic water",
  soda: "Soda Water", ginger: "Ginger ale", sprite: "Lemonade", fanta: "Orange juice",
  arancia: "Orange juice", limone: "Lemon juice", lime: "Lime juice", pompelmo: "Grapefruit juice",
  cranberry: "Cranberry juice", ananas: "Pineapple juice", menta: "Mint", granatina: "Grenadine",
  sciroppo: "Sugar syrup",
};

export type ApiDrink = {
  id: string;
  name: string;
  thumb: string;          // URL zdjęcia (medium)
  ingredients: { name: string; measure: string }[];
  glass: string;
  instructions: string;   // po angielsku
  category: string;
  alcoholic: string;
};

const _cache = new Map<string, any>();
async function jget(url: string): Promise<any> {
  if (_cache.has(url)) return _cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  _cache.set(url, json);
  return json;
}

/** Parsuje pełny obiekt drinka z API na nasz format. */
function parseDrink(d: any): ApiDrink {
  const ingredients: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = d[`strIngredient${i}`];
    const measure = d[`strMeasure${i}`];
    if (name && name.trim()) ingredients.push({ name: name.trim(), measure: (measure || "").trim() });
  }
  return {
    id: d.idDrink,
    name: d.strDrink,
    thumb: d.strDrinkThumb ? `${d.strDrinkThumb}/medium` : "",
    ingredients,
    glass: d.strGlass || "",
    instructions: d.strInstructions || "",
    category: d.strCategory || "",
    alcoholic: d.strAlcoholic || "",
  };
}

/**
 * Znajduje drink pasujący do podanych ID składników (nasze ID).
 * Strategia (darmowa, bez premium multi-filter):
 *  1. Mapuj nasze ID → nazwy API.
 *  2. Dla każdego mapowanego składnika pobierz filter.php?i=X (lista drinków).
 *  3. Przetnij listy → drinki które mają WSZYSTKIE wybrane składniki.
 *  4. Weź pierwszy wspólny → lookup pełnych szczegółów (+ zdjęcie).
 * Zwraca null jeśli nic nie pasuje albo API niedostępne.
 */
export async function findCocktailByIngredients(ingredientIds: string[]): Promise<ApiDrink | null> {
  try {
    const key = getKey();
    // Mapuj na nazwy API (tylko rozpoznane składniki)
    const apiNames = Array.from(new Set(
      ingredientIds.map((id) => ING_MAP[id]).filter(Boolean)
    ));
    if (apiNames.length === 0) return null;

    // Pobierz listy drinków per składnik
    const lists = await Promise.all(
      apiNames.map(async (name) => {
        try {
          const json = await jget(`${BASE}/${key}/filter.php?i=${encodeURIComponent(name)}`);
          return (json.drinks || []).map((d: any) => d.idDrink);
        } catch { return []; }
      })
    );

    // Przecięcie — drinki obecne we WSZYSTKICH listach
    let common: string[] = lists[0] || [];
    for (let i = 1; i < lists.length; i++) {
      const set = new Set(lists[i]);
      common = common.filter((id) => set.has(id));
    }
    if (common.length === 0) {
      // Brak idealnego dopasowania — spróbuj z samą bazą alkoholową (pierwszy alkohol)
      if (lists[0] && lists[0].length > 0) common = [lists[0][0]];
      else return null;
    }

    // Lookup szczegółów pierwszego wspólnego drinka
    const detail = await jget(`${BASE}/${key}/lookup.php?i=${common[0]}`);
    if (detail.drinks && detail.drinks[0]) return parseDrink(detail.drinks[0]);
    return null;
  } catch (e) {
    console.warn("CocktailDB lookup failed:", e);
    return null;
  }
}

/** Wyszukiwanie drinka po nazwie (np. do podglądu). */
export async function searchCocktailByName(name: string): Promise<ApiDrink | null> {
  try {
    const json = await jget(`${BASE}/${getKey()}/search.php?s=${encodeURIComponent(name)}`);
    if (json.drinks && json.drinks[0]) return parseDrink(json.drinks[0]);
    return null;
  } catch { return null; }
}
