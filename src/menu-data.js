// Full menu & cocktail-builder data for S'Historia
// All items from the live menu.

window.FULL_MENU = [
  {
    id: "antipasti", label: "Antipasti", icon: "✦",
    items: [
      { name: "Antipasto del giorno", price: "18,00 €" },
      { name: "Tagliere sardo", price: "15,00 €", allergen: "7" },
      { name: "Tentacolo di polpo", price: "20,00 €" },
    ],
  },
  {
    id: "primi", label: "Primi", icon: "✦",
    items: [
      { name: "Spaghetti alle vongole", price: "20,00 €", allergen: "1·14" },
      { name: "Gnocchetti con pulpeddi", price: "15,00 €", allergen: "1·3" },
      { name: "Spaghetto di mare", price: "20,00 €", allergen: "1·2·4·12·13·14" },
      { name: "Risotto mare", price: "22,00 €", allergen: "2·3·12·13·14" },
      { name: "Culurgiones", price: "18,00 €", allergen: "1·7", featured: true },
    ],
  },
  {
    id: "secondi", label: "Secondi", icon: "✦",
    items: [
      { name: "Costata", price: "6,50 €", note: "all'etto" },
      { name: "Calamaro fritto", price: "20,00 €", allergen: "1·4·5" },
      { name: "Fritto misto di pesce", price: "25,00 €", allergen: "1·4·5" },
      { name: "Pescato del giorno", price: "8,00 €", note: "all'etto" },
      { name: "Costine di maiale", price: "20,00 €", allergen: "1·3" },
      { name: "Entrecôte", price: "20,00 €" },
      { name: "Filetto", price: "28,00 €" },
    ],
  },
  {
    id: "contorni", label: "Contorni", icon: "✦",
    items: [
      { name: "Patate al forno", price: "6,00 €" },
      { name: "Patate fritte", price: "6,00 €", allergen: "1" },
      { name: "Insalata mista", price: "6,00 €" },
    ],
  },
  {
    id: "pizze", label: "Pizze classiche", icon: "✦",
    items: [
      { name: "Margherita", price: "7,50 €", desc: "Pomodoro, mozzarella", allergen: "1·7" },
      { name: "Napoli", price: "8,50 €", desc: "Pomodoro, mozzarella, acciughe, capperi", allergen: "1·4·7" },
      { name: "Cardinale", price: "9,00 €", desc: "Pomodoro, mozzarella, prosciutto cotto", allergen: "1·7" },
      { name: "Boscaiola", price: "10,00 €", desc: "Pomodoro, mozzarella, prosciutto cotto, funghi freschi", allergen: "1·7" },
      { name: "Majore", price: "12,00 €", desc: "Pomodoro, mozzarella, salsiccia secca, peretta, pomodorini", allergen: "1·7" },
      { name: "Capitana", price: "12,00 €", desc: "Pomodoro, mozzarella, tonno, cipolla", allergen: "1·4·7" },
      { name: "Rena Matteu", price: "12,00 €", desc: "Pomodoro, mozzarella, mozzarella di bufala, pomodorini, basilico", allergen: "1·7" },
      { name: "Calzone", price: "11,00 €", desc: "Pomodoro, mozzarella, prosciutto cotto, funghi freschi", allergen: "1·7" },
      { name: "Vegetariana", price: "12,00 €", desc: "Pomodoro, mozzarella, verdure miste", allergen: "1·7" },
    ],
  },
  {
    id: "pizze-speciali", label: "Pizze speciali", icon: "✦",
    items: [
      { name: "Don Alessio", price: "13,00 €", desc: "Mozzarella, salsiccia, melanzane, pecorino", allergen: "1·7" },
      { name: "S'Historia", price: "16,00 €", desc: "Pomodoro, mozzarella, gamberi, funghi freschi, bottarga", allergen: "1·2·4·7", featured: true },
      { name: "Paperino", price: "10,00 €", desc: "Pomodoro, mozzarella, patate fritte, wurstel", allergen: "1·5·7" },
      { name: "4 formaggi", price: "12,00 €", desc: "Mozzarella, formaggi misti", allergen: "1·7" },
      { name: "Gallura", price: "15,00 €", desc: "Pomodoro, mozzarella, peretta, rucola, bottarga", allergen: "1·4·7" },
    ],
  },
];

window.DRINKS_MENU = {
  filters: [
    { id: "all", label: "Tutti" },
    { id: "bianchi", label: "Vini bianchi" },
    { id: "rossi", label: "Vini rossi" },
    { id: "bollicine", label: "Bollicine" },
    { id: "cocktails", label: "Cocktails" },
    { id: "analcolici", label: "Analcolici" },
    { id: "spina", label: "Birre alla spina" },
    { id: "bottiglia", label: "Birre in bottiglia" },
    { id: "vodka", label: "Vodka" },
    { id: "grappe", label: "Grappe" },
  ],
  items: [
    // Vini bianchi
    { cat: "bianchi", name: "Printzipale", price: "3,00 €", desc: "Vermentino di Gallura · Cantina Perandria", region: "Gallura" },
    { cat: "bianchi", name: "Cala Reale", price: "3,00 €", desc: "Vermentino di Gallura · Sella & Mosca", region: "Gallura" },
    { cat: "bianchi", name: "Akènta Cuvèe 71", price: "3,00 €", desc: "Vermentino di Sardegna · Santa Maria la Palma", region: "Sardegna" },
    { cat: "bianchi", name: "Incontru", price: "4,00 €", desc: "Vermentino di Gallura · Cantina Aini", region: "Gallura" },
    { cat: "bianchi", name: "Spèra", price: "4,00 €", desc: "Vermentino di Gallura · Siddura", region: "Gallura" },
    { cat: "bianchi", name: "Canayli", price: "4,00 €", desc: "Vermentino di Gallura · Cantina Gallura", region: "Gallura" },

    // Vini rossi
    { cat: "rossi", name: "Costera", price: "3,00 €", desc: "Cannonau · Argiolas", region: "Sardegna" },
    { cat: "rossi", name: "Cagnulari Cherchi", price: "4,00 €", desc: "Cagnulari · Cantina Cherchi", region: "Sardegna" },
    { cat: "rossi", name: "Gola", price: "4,00 €", desc: "Cagnulari · Cantina San Michele", region: "Sardegna" },
    { cat: "rossi", name: "Luzzana", price: "5,00 €", desc: "Blend Cannonau e Cagnulari · Cherchi", region: "Sardegna" },

    // Bollicine
    { cat: "bollicine", name: "Akènta", price: "4,00 €", desc: "Vermentino di Sardegna · Santa Maria la Palma" },
    { cat: "bollicine", name: "Torbato Brut", price: "4,00 €", desc: "Uva torbato · Sella & Mosca" },
    { cat: "bollicine", name: "Blanc de Blancs Brut", price: "4,00 €", desc: "Pinot · Chardonnay · Villa Sandi" },
    { cat: "bollicine", name: "Strada di Guia Extra Dry", price: "4,00 €", desc: "100% Glera · Fosse Marai" },

    // Cocktails (signature + classic)
    { cat: "cocktails", name: "Mojito", price: "7,00 €", desc: "Rum bianco, lime, menta, zucchero di canna, soda" },
    { cat: "cocktails", name: "Mojito Passion Fruit", price: "7,00 €", desc: "Rum bianco, lime, menta, zucchero, passion fruit" },
    { cat: "cocktails", name: "Gin Tonic", price: "8,00 €", desc: "Gin, acqua tonica" },
    { cat: "cocktails", name: "Aperol Spritz", price: "6,00 €", desc: "Aperol, prosecco, soda, fetta d'arancia" },
    { cat: "cocktails", name: "Piña Colada", price: "8,00 €", desc: "Rum, ananas fresco, lime, sciroppo di cocco" },
    { cat: "cocktails", name: "Moscow Mule", price: "7,00 €", desc: "Vodka, ginger beer, lime, ginger spirit" },
    { cat: "cocktails", name: "Cuba Libre", price: "6,00 €", desc: "Rum bianco, lime, cola" },
    { cat: "cocktails", name: "Margarita", price: "7,00 €", desc: "Tequila, triple sec, lime, sale" },
    { cat: "cocktails", name: "4 Bianchi", price: "8,00 €", desc: "Tequila, vodka, rum, gin, lime, soda" },
    { cat: "cocktails", name: "Blue Long Island", price: "9,00 €", desc: "Rum, tequila, triple sec, gin, lime, blue curaçao, soda" },
    { cat: "cocktails", name: "Espresso Martini", price: "7,00 €", desc: "Vodka, liquore al caffè, zucchero, espresso" },
    { cat: "cocktails", name: "Daiquiri Frozen", price: "8,00 €", desc: "Rum, lime, zucchero, frutta fresca" },

    // Analcolici
    { cat: "analcolici", name: "Virgin Mojito", price: "6,00 €", desc: "Lime, zucchero di canna, menta, soda" },
    { cat: "analcolici", name: "Virgin Daiquiri", price: "6,00 €", desc: "Lime, zucchero liquido · fragola, ananas, mango" },
    { cat: "analcolici", name: "Virgin Piña Colada", price: "7,00 €", desc: "Ananas, sciroppo di cocco, latte di cocco" },
    { cat: "analcolici", name: "Caipi Lemon", price: "6,00 €", desc: "Lime, zucchero, lemonsoda · varianti frutta" },
    { cat: "analcolici", name: "San Francisco", price: "7,00 €", desc: "Arancia, ananas, limone, pompelmo, granatina, soda" },
    { cat: "analcolici", name: "Tutti i Frutti", price: "8,00 €", desc: "Frutta fresca e succhi frullati" },

    // Spina
    { cat: "spina", name: "Heineken", price: "3,50 €", desc: "0,20 l · 0,40 l · 1 L · 1,5 L" },
    { cat: "spina", name: "Ichnusa non filtrata", price: "4,00 €", desc: "0,20 l · 0,40 l · 1 L · 1,5 L" },

    // Bottiglia
    { cat: "bottiglia", name: "Agliola", price: "6,50 €", region: "Sardegna" },
    { cat: "bottiglia", name: "Marduk IPA", price: "8,00 €", desc: "0,5 l", region: "Sardegna" },
    { cat: "bottiglia", name: "Marduk Altbier", price: "8,00 €", desc: "0,5 l", region: "Sardegna" },
    { cat: "bottiglia", name: "Marduk Sexy Pompia", price: "8,00 €", desc: "0,5 l", region: "Sardegna" },
    { cat: "bottiglia", name: "Big Wave", price: "6,50 €", desc: "Golden Ale · 0,35 l", region: "Hawaii" },
    { cat: "bottiglia", name: "Longboard", price: "6,50 €", desc: "Lager · 0,35 l", region: "Hawaii" },
    { cat: "bottiglia", name: "Dai Dai IPA", price: "7,00 €", desc: "0,33 l", region: "Giappone" },
    { cat: "bottiglia", name: "Schöfferhofer", price: "6,50 €", desc: "0,50 l", region: "Germania" },
    { cat: "bottiglia", name: "Kloster-Gold Hell", price: "6,50 €", desc: "0,50 l", region: "Germania" },
    { cat: "bottiglia", name: "Mongozo", price: "4,00 €", desc: "Gluten free" },

    // Vodka
    { cat: "vodka", name: "Moskovskaya", price: "6,00 €", region: "Lettonia" },
    { cat: "vodka", name: "Grey Goose", price: "10,00 €", region: "Francia" },
    { cat: "vodka", name: "Belvedere", price: "12,00 €", region: "Polonia" },
    { cat: "vodka", name: "Eiko", price: "12,00 €", region: "Giappone" },

    // Grappe
    { cat: "grappe", name: "Grappa Bianca", price: "3,00 €" },
    { cat: "grappe", name: "Grappa Bianca Nonino", price: "4,00 €" },
    { cat: "grappe", name: "Grappa Bianca Alexander", price: "4,00 €" },
    { cat: "grappe", name: "Camilla", price: "5,00 €" },
    { cat: "grappe", name: "Grappa Barricata", price: "4,00 €" },
    { cat: "grappe", name: "Nonino Riserva", price: "6,00 €", desc: "Barricata" },
    { cat: "grappe", name: "Nonino Riserva 5", price: "8,00 €", desc: "Barricata" },
    { cat: "grappe", name: "Nonino Gran Riserva", price: "12,00 €", desc: "Barricata" },
    { cat: "grappe", name: "Exquisite Premium", price: "10,00 €", desc: "Barricata" },
    { cat: "grappe", name: "Diciotto Lune", price: "10,00 €", desc: "Botte Porto · Rum · Whisky" },
  ],
};

// Cocktail builder ingredients
// side: "right" = distillati (alcohols), "left" = riempitivi (mixers/juices/aromas)
// volume = default mL per pour, isAlcohol = counts toward strength
window.COCKTAIL_INGREDIENTS = [
  // RIGHT — DISTILLATI (alcohol)
  { id: "rum-bianco", label: "Rum bianco", group: "Distillati", side: "right", color: "#F2EAD8", volume: 25, isAlcohol: true },
  { id: "rum-coc", label: "Rum cocco", group: "Distillati", side: "right", color: "#E8DDC2", volume: 25, isAlcohol: true },
  { id: "vodka", label: "Vodka", group: "Distillati", side: "right", color: "#F8F4EC", volume: 25, isAlcohol: true },
  { id: "gin", label: "Gin", group: "Distillati", side: "right", color: "#E5EEEA", volume: 25, isAlcohol: true },
  { id: "tequila", label: "Tequila", group: "Distillati", side: "right", color: "#E8DDA0", volume: 25, isAlcohol: true },
  { id: "triple-sec", label: "Triple Sec", group: "Distillati", side: "right", color: "#F0E5C0", volume: 15, isAlcohol: true },
  { id: "whisky", label: "Whisky (Bourbon)", group: "Distillati", side: "right", color: "#C67123", volume: 25, isAlcohol: true },
  { id: "whisky-scotch", label: "Whisky (Scotch)", group: "Distillati", side: "right", color: "#B85D19", volume: 25, isAlcohol: true },
  { id: "caffe-liq", label: "Liquore caffè", group: "Distillati", side: "right", color: "#3A2418", volume: 20, isAlcohol: true },
  { id: "espresso", label: "Espresso", group: "Distillati", side: "right", color: "#2A1810", volume: 30, isAlcohol: false },
  // RIGHT — AMARI E LIQUORI
  { id: "aperol", label: "Aperol", group: "Amari e liquori", side: "right", color: "#F08540", volume: 30, isAlcohol: true },
  { id: "campari", label: "Campari", group: "Amari e liquori", side: "right", color: "#C84A2A", volume: 25, isAlcohol: true },
  { id: "mirto", label: "Mirto", group: "Amari e liquori", side: "right", color: "#5B2A4E", volume: 25, isAlcohol: true },
  { id: "blue-curacao", label: "Blue Curaçao", group: "Amari e liquori", side: "right", color: "#3DB6E0", volume: 20, isAlcohol: true },
  { id: "baileys", label: "Crema Whisky", group: "Amari e liquori", side: "right", color: "#E1D2B8", volume: 20, isAlcohol: true },
  // RIGHT — VINI
  { id: "prosecco", label: "Prosecco", group: "Vini", side: "right", color: "#F2EBC8", volume: 60, isAlcohol: true },
  { id: "vino-bianco", label: "Vino Bianco", group: "Vini", side: "right", color: "#EAE1B0", volume: 60, isAlcohol: true },
  { id: "vino-rosso", label: "Vino Rosso", group: "Vini", side: "right", color: "#4A0E1A", volume: 60, isAlcohol: true },

  // LEFT — BOLLICINE
  { id: "tonica", label: "Acqua tonica", group: "Bollicine", side: "left", color: "#E0EDF0", volume: 80, isAlcohol: false },
  { id: "soda", label: "Soda", group: "Bollicine", side: "left", color: "#E8F0F2", volume: 60, isAlcohol: false },
  { id: "cola", label: "Cola", group: "Bollicine", side: "left", color: "#1D0F08", volume: 80, isAlcohol: false },
  { id: "ginger", label: "Ginger beer", group: "Bollicine", side: "left", color: "#D8B860", volume: 80, isAlcohol: false },
  { id: "lemonsoda", label: "Lemonsoda", group: "Bollicine", side: "left", color: "#F2E060", volume: 60, isAlcohol: false },
  // LEFT — SUCCHI
  { id: "lime", label: "Lime", group: "Succhi", side: "left", color: "#9DC85A", volume: 20, isAlcohol: false },
  { id: "limone", label: "Limone", group: "Succhi", side: "left", color: "#F2DC4A", volume: 20, isAlcohol: false },
  { id: "arancia", label: "Arancia", group: "Succhi", side: "left", color: "#F0962D", volume: 30, isAlcohol: false },
  { id: "ananas", label: "Ananas", group: "Succhi", side: "left", color: "#F2D346", volume: 40, isAlcohol: false },
  { id: "pompelmo", label: "Pompelmo", group: "Succhi", side: "left", color: "#E8845A", volume: 30, isAlcohol: false },
  { id: "passion", label: "Passion fruit", group: "Succhi", side: "left", color: "#E8A030", volume: 20, isAlcohol: false },
  { id: "fragola", label: "Fragola", group: "Succhi", side: "left", color: "#D9405A", volume: 25, isAlcohol: false },
  // LEFT — DOLCE
  { id: "zucchero", label: "Zucchero di canna", group: "Dolce", side: "left", color: "#C9A87D", volume: 10, isAlcohol: false },
  { id: "sciroppo-cocco", label: "Sciroppo cocco", group: "Dolce", side: "left", color: "#F4ECDA", volume: 15, isAlcohol: false },
  { id: "granatina", label: "Granatina", group: "Dolce", side: "left", color: "#B81E3E", volume: 10, isAlcohol: false },
  { id: "miele", label: "Miele", group: "Dolce", side: "left", color: "#D9A030", volume: 10, isAlcohol: false },
  // LEFT — AROMI
  { id: "menta", label: "Menta", group: "Aromi", side: "left", color: "#5B9C68", volume: 5, isAlcohol: false },
  { id: "basilico", label: "Basilico", group: "Aromi", side: "left", color: "#4A7C53", volume: 5, isAlcohol: false },
  { id: "rosmarino", label: "Rosmarino", group: "Aromi", side: "left", color: "#3D6B4A", volume: 5, isAlcohol: false },
  { id: "sale", label: "Sale", group: "Aromi", side: "left", color: "#F0F0F0", volume: 2, isAlcohol: false },
];

// Pre-existing drinks (for "esiste già!" detection)
// Sorted ingredient ids for matching
window.KNOWN_COCKTAILS = [
  { name: "Mojito", ingr: ["rum-bianco","lime","menta","zucchero","soda"], price: "7,00 €", origin: "Cuba" },
  { name: "Mojito Passion", ingr: ["rum-bianco","lime","menta","zucchero","passion"], price: "7,00 €", origin: "remix S'Historia" },
  { name: "Cuba Libre", ingr: ["rum-bianco","lime","cola"], price: "6,00 €", origin: "Cuba" },
  { name: "Piña Colada", ingr: ["rum-bianco","rum-coc","ananas","lime","sciroppo-cocco"], price: "8,00 €", origin: "Puerto Rico" },
  { name: "Gin Tonic", ingr: ["gin","tonica"], price: "8,00 €", origin: "classico" },
  { name: "Vodka Tonic", ingr: ["vodka","tonica"], price: "8,00 €", origin: "classico" },
  { name: "Moscow Mule", ingr: ["vodka","ginger","lime"], price: "7,00 €", origin: "USA" },
  { name: "Aperol Spritz", ingr: ["aperol","prosecco","soda","arancia"], price: "6,00 €", origin: "Veneto" },
  { name: "Margarita", ingr: ["tequila","triple-sec","lime","sale","zucchero"], price: "7,00 €", origin: "Messico" },
  { name: "4 Bianchi", ingr: ["tequila","vodka","rum-bianco","gin","lime","soda","zucchero"], price: "8,00 €", origin: "S'Historia" },
  { name: "Blue Long Island", ingr: ["rum-bianco","tequila","triple-sec","gin","limone","blue-curacao","soda","zucchero"], price: "9,00 €", origin: "USA" },
  { name: "Espresso Martini", ingr: ["vodka","caffe-liq","espresso","zucchero"], price: "7,00 €", origin: "London 1983" },
  { name: "Virgin Mojito", ingr: ["lime","menta","zucchero","soda"], price: "6,00 €", origin: "analcolico" },
  { name: "San Francisco", ingr: ["arancia","ananas","limone","pompelmo","granatina","soda"], price: "7,00 €", origin: "analcolico" },
  { name: "Tramonto Gallura", ingr: ["mirto","prosecco","arancia"], price: "9,00 €", origin: "firma S'Historia" },
  { name: "Cannonau Negroni", ingr: ["gin","campari","mirto"], price: "9,00 €", origin: "firma S'Historia" },
];

// Community cocktails (mock)
window.COMMUNITY_COCKTAILS = [
  { name: "Cuzzo Tropicale", by: "Marco", ingr: ["rum-bianco","ananas","passion","menta","lime"], likes: 24, comments: 8, comment: "Provato a luglio, da bere al tramonto. 10/10." },
  { name: "Nonna Drink", by: "Sara", ingr: ["mirto","limone","zucchero","menta"], likes: 18, comments: 5, comment: "Mia nonna avrebbe approvato. Mirto perfetto." },
  { name: "Sole di Rena", by: "Luca", ingr: ["gin","arancia","rosmarino","tonica"], likes: 31, comments: 12, comment: "Erbe di Gallura nel bicchiere." },
  { name: "Adriatico Blu", by: "Hannah", ingr: ["vodka","blue-curacao","limone","soda"], likes: 14, comments: 3, comment: "Sembra il mare in piscina." },
  { name: "Filu Verde", by: "Antonio", ingr: ["gin","menta","basilico","limone","zucchero"], likes: 27, comments: 9, comment: "Erbe + gin = magia." },
  { name: "Pompia Spritz", by: "Carlos", ingr: ["aperol","prosecco","pompelmo","soda"], likes: 9, comments: 2, comment: "Variante con pompelmo della casa." },
];
