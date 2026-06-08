/**
 * Lokalna baza drinków — pobrana RAZ z TheCocktailDB (426 drinków) i zapisana
 * w /public/cocktails-db.json. ZERO zapytań do API → całkowicie darmowe,
 * bez limitów, działa offline. Zdjęcia ładowane z CDN TheCocktailDB (też darmowe).
 *
 * Wyszukiwanie po składnikach: mapujemy nasze ID → angielskie nazwy składników,
 * potem szukamy drinka który zawiera wszystkie (lub najwięcej) wybranych.
 */

export type ApiDrink = {
  id: string;
  name: string;
  thumb: string;          // URL zdjęcia (medium)
  ingredients: { name: string; measure: string }[];
  glass: string;
  instructions: string;
  category: string;
  alcoholic: string;
};

type RawDrink = {
  id: string; name: string; thumb: string; glass: string; cat: string; alc: string;
  ingredients: { n: string; m: string }[];
};

// Mapowanie naszych ID składników → nazwy w bazie (angielskie, lowercase do porównań).
const ING_MAP: Record<string, string[]> = {
  gin: ["gin"], "gin-bombay": ["gin"], "gin-tanqueray": ["gin"], "gin-botanist": ["gin"], "gin-mare": ["gin"], "gin-pink": ["gin"],
  vodka: ["vodka"], "vodka-beluga": ["vodka"], "vodka-citr": ["vodka", "citrus vodka"],
  rum: ["rum"], "rum-bianco": ["light rum", "white rum", "rum"], "rum-don-papa": ["dark rum", "rum"], "rum-kraken": ["spiced rum", "dark rum", "rum"],
  tequila: ["tequila"], "tequila-1800": ["tequila"], "tequila-dobel": ["tequila"],
  whisky: ["whiskey", "whisky", "scotch"], "whisky-high-comm": ["whiskey", "scotch"], "jack-daniels": ["whiskey", "tennessee whiskey"], jameson: ["irish whiskey", "whiskey"], bourbon: ["bourbon"],
  aperol: ["aperol"], campari: ["campari"], cointreau: ["triple sec", "cointreau"], limoncello: ["limoncello"],
  prosecco: ["prosecco", "champagne"], "vermouth-r": ["sweet vermouth", "vermouth"], baileys: ["baileys irish cream", "irish cream"],
  "coca-cola": ["coca-cola", "cola"], "coca-zero": ["coca-cola", "cola"], tonica: ["tonic water"], "tonica-prem": ["tonic water"],
  soda: ["soda water", "club soda"], ginger: ["ginger ale", "ginger beer"], sprite: ["lemonade", "sprite", "7-up"], fanta: ["orange juice"],
  arancia: ["orange juice"], limone: ["lemon juice", "lemon"], lime: ["lime juice", "lime"], pompelmo: ["grapefruit juice"],
  cranberry: ["cranberry juice"], ananas: ["pineapple juice"], menta: ["mint"], granatina: ["grenadine"], sciroppo: ["sugar syrup", "sugar", "simple syrup"],
};

let _db: RawDrink[] | null = null;
let _loading: Promise<RawDrink[]> | null = null;

async function loadDB(): Promise<RawDrink[]> {
  if (_db) return _db;
  if (_loading) return _loading;
  _loading = fetch("/cocktails-db.json")
    .then((r) => r.json())
    .then((data: RawDrink[]) => { _db = data; return data; })
    .catch(() => { _db = []; return []; });
  return _loading;
}

// Preload w tle (gdy moduł się załaduje na kliencie)
if (typeof window !== "undefined") { loadDB(); }

function parseDrink(d: RawDrink): ApiDrink {
  return {
    id: d.id,
    name: d.name,
    thumb: d.thumb ? `${d.thumb}/medium` : "",
    ingredients: d.ingredients.map((i) => ({ name: i.n, measure: i.m })),
    glass: d.glass,
    instructions: "",
    category: d.cat,
    alcoholic: d.alc,
  };
}

/**
 * Znajduje drink pasujący do podanych ID składników (nasze ID).
 * Scoring: dla każdego drinka liczy ile wybranych baz alkoholowych/składników pasuje.
 * Zwraca drink z najlepszym dopasowaniem (min. wszystkie alkohole bazowe muszą pasować).
 */
export async function findCocktailByIngredients(ingredientIds: string[]): Promise<ApiDrink | null> {
  const db = await loadDB();
  if (db.length === 0) return null;

  // Zbierz angielskie nazwy szukanych składników
  const wanted: string[][] = ingredientIds.map((id) => ING_MAP[id]).filter(Boolean) as string[][];
  if (wanted.length === 0) return null;

  let best: RawDrink | null = null;
  let bestScore = 0;

  for (const drink of db) {
    const drinkIngs = drink.ingredients.map((i) => i.n.toLowerCase());
    let matched = 0;
    for (const alternatives of wanted) {
      // składnik pasuje jeśli którakolwiek z alternatyw jest w drinku (substring match)
      const hit = alternatives.some((alt) => drinkIngs.some((di) => di.includes(alt) || alt.includes(di)));
      if (hit) matched++;
    }
    // Score = ile naszych składników znaleziono w drinku.
    // Preferuj drinki gdzie dopasowano WSZYSTKIE wybrane składniki.
    const score = matched;
    // Bonus: drink ma podobną liczbę składników (nie za dużo dodatkowych)
    const extraPenalty = Math.max(0, drink.ingredients.length - wanted.length) * 0.15;
    const finalScore = score - extraPenalty;

    if (matched >= wanted.length && finalScore > bestScore) {
      bestScore = finalScore;
      best = drink;
    }
  }

  // Jeśli nie ma idealnego (wszystkie składniki) — znajdź najlepsze częściowe (min 2 dopasowania)
  if (!best) {
    for (const drink of db) {
      const drinkIngs = drink.ingredients.map((i) => i.n.toLowerCase());
      let matched = 0;
      for (const alternatives of wanted) {
        if (alternatives.some((alt) => drinkIngs.some((di) => di.includes(alt) || alt.includes(di)))) matched++;
      }
      if (matched >= 2 && matched > bestScore) { bestScore = matched; best = drink; }
    }
  }

  return best ? parseDrink(best) : null;
}

/** Wyszukiwanie drinka po nazwie (lokalne). */
export async function searchCocktailByName(name: string): Promise<ApiDrink | null> {
  const db = await loadDB();
  const q = name.toLowerCase();
  const found = db.find((d) => d.name.toLowerCase().includes(q));
  return found ? parseDrink(found) : null;
}
