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

// Składniki-dekoracje (garnish) — NIE wymagamy ich nalania, żeby uznać przepis
const GARNISH = new Set([
  "ice", "crushed ice", "salt", "sugar", "brown sugar", "powdered sugar", "sugar cube",
  "lemon", "lime", "orange", "mint", "cherry", "maraschino cherry", "olive",
  "lemon peel", "lime peel", "orange peel", "lemon twist", "orange spiral", "lemon zest",
  "nutmeg", "celery salt", "black pepper", "water", "whipped cream", "cinnamon",
]);

/**
 * G5: ŚCISŁE dopasowanie drinka do nalanych składników.
 * Popout „hai creato un classico" pokazuje się TYLKO gdy:
 *  1) każdy nalany składnik jest mapowalny i występuje w przepisie,
 *  2) każdy ISTOTNY składnik przepisu (poza dekoracjami) został nalany.
 * Czyli: zestaw składników = zestaw przepisu (modulo lód/skórka/sól itp.).
 * Wcześniejszy luźny scoring (min. 2 trafienia) dawał „klasyka" przy KAŻDEJ mieszance.
 */
export async function findCocktailByIngredients(ingredientIds: string[]): Promise<ApiDrink | null> {
  const db = await loadDB();
  if (db.length === 0) return null;

  // Każdy nalany składnik musi być znany (mapowalny) — inaczej nie potwierdzimy przepisu
  const wanted: string[][] = [];
  for (const id of ingredientIds) {
    const m = ING_MAP[id];
    if (!m) return null; // nalano coś spoza bazy (np. piwo, brzoskwinia) → to nie klasyk
    wanted.push(m);
  }
  if (wanted.length < 2) return null;

  const matchesAlt = (alts: string[], di: string) => alts.some((alt) => di.includes(alt) || alt.includes(di));

  let best: RawDrink | null = null;
  let bestCore = -1;
  let bestExtra = Infinity;

  for (const drink of db) {
    const dIngs = drink.ingredients.map((i) => i.n.toLowerCase().trim());
    // 1) wszystkie NASZE składniki są w przepisie
    if (!wanted.every((alts) => dIngs.some((di) => matchesAlt(alts, di)))) continue;
    // 2) wszystkie ISTOTNE składniki przepisu zostały nalane
    const core = dIngs.filter((di) => !GARNISH.has(di));
    if (core.length < 2) continue;
    if (core.some((di) => !wanted.some((alts) => matchesAlt(alts, di)))) continue;
    // preferuj przepis o największej liczbie istotnych składników, potem najmniej dekoracji
    const extra = dIngs.length - core.length;
    if (core.length > bestCore || (core.length === bestCore && extra < bestExtra)) {
      best = drink; bestCore = core.length; bestExtra = extra;
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
