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

type WebhookKey = "contact" | "drink" | "winner" | "event" | "newsletter" | "comment" | "review";

function webhook(key: WebhookKey): string | null {
  const map: Record<string, string | undefined> = {
    contact: process.env.NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK,
    drink: process.env.NEXT_PUBLIC_MAKE_DRINK_WEBHOOK,
    winner: process.env.NEXT_PUBLIC_MAKE_WINNER_WEBHOOK,
    event: process.env.NEXT_PUBLIC_MAKE_EVENT_WEBHOOK,
    newsletter: process.env.NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK,
    comment: process.env.NEXT_PUBLIC_MAKE_COMMENT_WEBHOOK,
    // Recenzje korzystają z webhooka newslettera (ten sam kanał mailowy),
    // chyba że ustawisz dedykowany NEXT_PUBLIC_MAKE_REVIEW_WEBHOOK.
    review: process.env.NEXT_PUBLIC_MAKE_REVIEW_WEBHOOK || process.env.NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK,
  };
  // Fallback: pojedynczy webhook dla wszystkiego (window override do testów)
  const single = (typeof window !== "undefined" && (window as any).__MAKE_WEBHOOK) || process.env.NEXT_PUBLIC_MAKE_WEBHOOK;
  return map[key] || single || null;
}

async function send(key: WebhookKey, payload: Json): Promise<boolean> {
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
  // Przetłumacz wiadomość klienta na włoski (dla właściciela) — auto-detect języka
  let messageIt = data.message || "";
  if (data.message && lang !== "it") {
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=it&dt=t&q=${encodeURIComponent(data.message)}`);
      const j = await r.json();
      messageIt = (j?.[0] || []).map((s: any) => s[0]).join("") || data.message;
    } catch { messageIt = data.message; }
  }
  const vars = {
    firstName: data.firstName || data.name || "",
    lastName: data.lastName || "",
    email: data.email,
    phone: data.phone || "",
    date: data.date || "",
    time: data.time || "",
    people: data.people ?? 2,
    message: data.message || "",
    messageIt,
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
    message_it: messageIt,                   // wiadomość po włosku (dla właściciela)
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
  winner_drink: string; winner_author: string; winner_email?: string; winner_lang?: string;
  recipients: { email: string; name: string; lang: string }[];
  period: "month" | "week";
}): Promise<boolean> {
  const { winnerEmailHTML, winnerOthersEmailHTML } = await import("./email-templates");
  const norm = (l?: string) => (["it","pl","en","de","fr","es"].includes(l || "") ? l : "it") as import("./email-templates").Lang;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.shistoria.it";
  const link = `${origin}/#ready-drinks`;
  // Kod nagrody (darmowy drink) + QR dla zwycięzcy — barman odbiera na /reward/[code]
  const code = "SH-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  const rewardUrl = `${origin}/reward/${code}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(rewardUrl)}`;
  // Zapisz nagrodę w bazie (best-effort, nieblokujące)
  try {
    const { supabase } = await import("./supabase");
    await supabase.from("rewards").insert({ code, winner_name: data.winner_author, winner_email: data.winner_email || null, drink_name: data.winner_drink, period: data.period });
  } catch { /* ignore */ }
  // E-mail zwycięzcy — w JEGO języku, z kodem + QR
  const winLang = norm(data.winner_lang);
  const winnerMail = winnerEmailHTML({ winnerDrink: data.winner_drink, winnerAuthor: data.winner_author, period: data.period, lang: winLang, link, code, qrUrl });
  // E-maile pozostałych — każdy z gotowym HTML w SWOIM języku (make.com tylko iteruje i wysyła)
  const recipients = data.recipients.map((r) => {
    const lang = norm(r.lang);
    const m = winnerOthersEmailHTML({ winnerDrink: data.winner_drink, winnerAuthor: data.winner_author, recipientName: r.name, period: data.period, lang, link });
    return { email: r.email, name: r.name, lang, email_subject: m.subject, email_html: m.html };
  });
  return send("winner", {
    type: "winner_announcement",
    period: data.period,
    winner_drink: data.winner_drink,
    winner_author: data.winner_author,
    winner_email: data.winner_email || "",
    winner_lang: winLang,
    winner_code: code,
    reward_url: rewardUrl,
    // ── GOTOWE treści zwycięzcy (make.com mapuje tylko te pola) ──
    winner_email_subject: winnerMail.subject,
    winner_email_html: winnerMail.html,
    // ── lista pozostałych, każdy z GOTOWYM mailem w swoim języku ──
    recipients, // [{ email, name, lang, email_subject, email_html }]
    link,
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
  image_url?: string; bg?: string; accent?: string; tag?: string;
}): Promise<boolean> {
  const { eventReminderHTML } = await import("./email-templates");
  const lang = (["it","pl","en","de","fr","es"].includes(data.lang) ? data.lang : "it") as import("./email-templates").Lang;
  const link = typeof window !== "undefined" ? `${window.location.origin}/#eventi` : "https://www.shistoria.it/#eventi";
  const vars = { name: data.name, eventTitle: data.event_title, eventDate: data.event_date, eventDescription: data.event_description, imageUrl: data.image_url, bg: data.bg, accent: data.accent, tag: data.tag, lang, link };
  // Pre-renderowane maile w języku odbiorcy — make.com wysyła je w odpowiednim momencie
  const mail3d = eventReminderHTML(vars, "3d");
  const mail5h = eventReminderHTML(vars, "5h");
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
    // ── GOTOWE treści (make.com mapuje tylko te pola w odpowiednim mailu) ──
    email_subject_3d: mail3d.subject,   // 3 dni przed: temat
    email_html_3d: mail3d.html,         // 3 dni przed: pełny HTML
    email_subject_5h: mail5h.subject,   // 5 godzin przed: temat
    email_html_5h: mail5h.html,         // 5 godzin przed: pełny HTML
  });
}


/* ── 5. Newsletter — nowy zapis (footer) ───────────────────────────────────
 * → make.com dodaje do listy mailingowej / Data Store; mail powitalny w języku.
 */
export async function subscribeNewsletter(data: {
  email: string; name?: string; lang: string;
}): Promise<boolean> {
  const { newsletterWelcomeHTML } = await import("./email-templates");
  const lang = (["it","pl","en","de","fr","es"].includes(data.lang) ? data.lang : "it") as import("./email-templates").Lang;
  const mail = newsletterWelcomeHTML({ name: data.name, lang });
  return send("newsletter", {
    type: "newsletter_signup",
    email: data.email,
    name: data.name || "",
    lang: data.lang,
    // GOTOWY, markowy mail powitalny (make mapuje tylko te pola)
    email_subject: mail.subject,
    email_html: mail.html,
  });
}


/* ── 6. Komentarz do drinka (community) ────────────────────────────────────
 * → make.com: powiadomienie (np. e-mail/WhatsApp do właściciela o nowym
 *   komentarzu) lub moderacja. Nieblokujące — best effort.
 */
export async function notifyComment(data: {
  drink_id: string; drink_name?: string; author: string; content: string; lang?: string;
}): Promise<boolean> {
  return send("comment", {
    type: "new_comment",
    drink_id: data.drink_id,
    drink_name: data.drink_name || "",
    author: data.author,
    content: data.content,
    lang: data.lang || "it",
  });
}

/* ── 7. Recenzja / opinia (community) ──────────────────────────────────────
 * Klient zostawia opinię (imię + email + treść + gwiazdki).
 * → mail "dziękujemy za opinię" w języku klienta (jeśli podał email).
 * Pre-renderowany HTML → make.com mapuje tylko email_subject + email_html.
 */
export async function notifyReview(data: {
  name: string; email?: string; content: string; stars: number; lang: string;
}): Promise<boolean> {
  if (!data.email) return false; // bez maila nie ma do kogo wysłać podziękowania
  const { reviewThankYouHTML } = await import("./email-templates");
  const lang = (["it","pl","en","de","fr","es"].includes(data.lang) ? data.lang : "it") as import("./email-templates").Lang;
  const mail = reviewThankYouHTML({ name: data.name, stars: data.stars, lang });
  return send("review", {
    type: "review_thankyou",
    name: data.name,
    email: data.email,
    content: data.content,
    stars: data.stars,
    lang: data.lang,
    // GOTOWY, markowy mail z podziękowaniem (make mapuje tylko te pola)
    email_subject: mail.subject,
    email_html: mail.html,
  });
}
