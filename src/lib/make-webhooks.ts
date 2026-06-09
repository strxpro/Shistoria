/**
 * make.com — integracje webhook (e-maile + WhatsApp).
 *
 * BEZPIECZEŃSTWO: URL webhooka NIE jest w kodzie (poufny). Konfiguracja przez env:
 *   NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK   — formularz rezerwacji (J2)
 *   NEXT_PUBLIC_MAKE_DRINK_WEBHOOK     — share drinka / e-mail przy drinku
 *   NEXT_PUBLIC_MAKE_WINNER_WEBHOOK    — drink miesiąca → email do wszystkich
 *
 * make.com Scenario odbiera JSON i: tłumaczy treść, wysyła e-mail (właściciel po IT,
 * klient w jego języku), opcjonalnie WhatsApp (callmebot/Twilio moduł w make).
 *
 * Każdy payload zawiera `lang` (język klienta) — make.com używa go do personalizacji.
 */

type Json = Record<string, unknown>;

function webhook(key: "contact" | "drink" | "winner" | "event"): string | null {
  const map: Record<string, string | undefined> = {
    contact: process.env.NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK,
    drink: process.env.NEXT_PUBLIC_MAKE_DRINK_WEBHOOK,
    winner: process.env.NEXT_PUBLIC_MAKE_WINNER_WEBHOOK,
    event: process.env.NEXT_PUBLIC_MAKE_EVENT_WEBHOOK,
  };
  // Fallback: pojedynczy webhook dla wszystkiego (window override do testów)
  const single = (typeof window !== "undefined" && (window as any).__MAKE_WEBHOOK) || process.env.NEXT_PUBLIC_MAKE_WEBHOOK;
  return map[key] || single || null;
}

async function send(key: "contact" | "drink" | "winner" | "event", payload: Json): Promise<boolean> {
  const url = webhook(key);
  if (!url) { console.info(`[make] webhook '${key}' nieskonfigurowany — pomijam`); return false; }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, source: "shistoria.it", ts: new Date().toISOString() }),
    });
    return true;
  } catch (e) {
    console.error(`[make] webhook '${key}' błąd:`, e);
    return false;
  }
}

/* ── 1. Formularz rezerwacji (J2) ──────────────────────────────────────────
 * → e-mail do właściciela (po włosku, z językiem źródłowym klienta)
 * → e-mail do klienta (w jego języku, z linkiem telefonicznym do rezerwacji)
 * → WhatsApp do właściciela (przez moduł callmebot/Twilio w make.com)
 */
export async function sendReservation(data: {
  name: string; firstName?: string; lastName?: string; email: string; phone?: string; date?: string; time?: string; people?: number; message?: string; lang: string;
}): Promise<boolean> {
  const { clientEmailHTML, ownerEmailHTML, ownerWhatsAppText } = await import("./email-templates");
  const lang = (["it","pl","en","de","fr","es"].includes(data.lang) ? data.lang : "it") as import("./email-templates").Lang;
  const vars = {
    firstName: data.firstName || data.name || "",
    lastName: data.lastName || "",
    email: data.email,
    phone: data.phone || "",
    date: data.date || "",
    time: data.time || "",
    people: data.people ?? 2,
    message: data.message || "",
    lang,
  };
  const client = clientEmailHTML(vars);
  const owner = ownerEmailHTML(vars);
  return send("contact", {
    type: "reservation",
    name: data.name,
    first_name: data.firstName || "",
    last_name: data.lastName || "",
    email: data.email,
    phone: data.phone || "",
    date: data.date || "",
    time: data.time || "",
    people: data.people ?? 2,
    message: data.message || "",
    lang: data.lang,
    owner_lang: "it",
    notify_whatsapp: true,                   // WhatsApp do właściciela ZAWSZE
    // ── GOTOWE treści (pre-renderowane) — w make.com mapujesz tylko te pola ──
    email_subject_client: client.subject,    // temat maila do klienta (w jego języku)
    email_html_client: client.html,          // pełny HTML maila do klienta
    email_subject_owner: owner.subject,       // temat maila do właściciela (IT)
    email_html_owner: owner.html,            // pełny HTML maila do właściciela (IT)
    whatsapp_text_owner: ownerWhatsAppText(vars), // treść WhatsApp (IT)
  });
}

/* ── 2. Share drinka — e-mail do klienta (jeśli podał email przy drinku) ───
 * → podziękowanie + zaproszenie do udostępnienia
 */
export async function sendDrinkShared(data: {
  drink_name: string; author_name: string; author_email?: string;
  ingredients: { name: string }[]; lang: string; photo_url?: string;
}): Promise<boolean> {
  if (!data.author_email) return false;
  return send("drink", {
    type: "drink_shared",
    drink_name: data.drink_name,
    author_name: data.author_name,
    email: data.author_email,
    ingredients: data.ingredients.map((i) => i.name).join(", "),
    photo_url: data.photo_url || "",
    lang: data.lang,
  });
}

/* ── 3. Drink miesiąca/tygodnia — e-mail do WSZYSTKICH twórców ──────────────
 * Wywoływane przez admina (przycisk "Ogłoś Drink del Mese") albo automat.
 * make.com: pętla po liście emaili, każdy email w języku odbiorcy.
 */
export async function announceWinner(data: {
  winner_drink: string; winner_author: string; winner_email?: string;
  recipients: { email: string; name: string; lang: string }[];
  period: "month" | "week";
}): Promise<boolean> {
  return send("winner", {
    type: "winner_announcement",
    period: data.period,
    winner_drink: data.winner_drink,
    winner_author: data.winner_author,
    winner_email: data.winner_email || "",
    recipients: data.recipients, // make.com iteruje, każdy w swoim języku
    link: typeof window !== "undefined" ? `${window.location.origin}/#ready-drinks` : "https://www.shistoria.it/#ready-drinks",
  });
}

/* ── 4. Przypomnienie o wydarzeniu (H) ─────────────────────────────────────
 * Klient zapisuje się na event (imię + email). make.com planuje 2 maile:
 *   • 3 dni przed wydarzeniem — zapowiedź zbliżającego się eventu
 *   • 5 godzin przed (w dniu eventu) — przypomnienie tego samego dnia
 * Oba w języku klienta (`lang`). make.com używa `event_date` do zaplanowania
 * wysyłki (moduł Sleep/Scheduler albo Data Store + scenariusz cykliczny).
 */
export async function subscribeEventReminder(data: {
  name: string; email: string; lang: string;
  event_title: string; event_date: string; event_description?: string;
}): Promise<boolean> {
  return send("event", {
    type: "event_reminder",
    name: data.name,
    email: data.email,
    lang: data.lang,
    event_title: data.event_title,
    event_date: data.event_date,        // make.com planuje: -3 dni i -5 godzin
    event_description: data.event_description || "",
    remind_days_before: 3,
    remind_hours_before: 5,
  });
}
