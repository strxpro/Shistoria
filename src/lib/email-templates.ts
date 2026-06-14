/**
 * email-templates.ts — gotowe, stylizowane e-maile HTML (S'Historia).
 *
 * Idea (jak w projekcie gioielleria): aplikacja PRE-RENDERUJE cały ładny HTML
 * e-maila i wysyła go w webhooku jako pole `email_html_client` / `email_html_owner`.
 * Dzięki temu w make.com NIE wpisujesz żadnego HTML — mapujesz tylko jedno pole
 * do treści e-maila (Content). Make wysyła to "jak jest".
 *
 * Marka S'Historia: granat (#0E222F / #12303f), coral (#E8927C), kremowy tekst.
 */

export type Lang = "it" | "pl" | "en" | "de" | "fr" | "es";

const BRAND = {
  name: "S'Historia",
  tagline: "Ristorante · Bar · Cocktail",
  deep: "#0E222F",
  card: "#12303f",
  coral: "#E8927C",
  sky: "#5BB8D4",
  cream: "#F5EDE0",
  muted: "#9fb3c2",
  site: "https://www.shistoria.it",
};

export interface ReservationVars {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  date?: string;
  time?: string;
  people?: number;
  message?: string;
  messageIt?: string; // wiadomość przetłumaczona na włoski (dla właściciela)
  lang: Lang;
}

/* ── Teksty klienta (potwierdzenie "skontaktujemy się najszybciej jak potrafimy") ── */
const CLIENT_T: Record<Lang, {
  subject: string; hi: string; thanks: string; soon: string;
  detailsTitle: string; date: string; time: string; people: string; phone: string; msg: string;
  footer: string; cta: string;
}> = {
  it: { subject: "Grazie per la tua richiesta — S'Historia", hi: "Ciao", thanks: "Grazie per averci contattato!", soon: "Ti confermeremo la prenotazione il più presto possibile.", detailsTitle: "La tua richiesta", date: "Data", time: "Ora", people: "Persone", phone: "Telefono", msg: "Messaggio", footer: "A presto, il team di S'Historia", cta: "Visita il sito" },
  pl: { subject: "Dziękujemy za wiadomość — S'Historia", hi: "Cześć", thanks: "Dziękujemy za kontakt!", soon: "Potwierdzimy rezerwację najszybciej jak to możliwe.", detailsTitle: "Twoja prośba", date: "Data", time: "Godzina", people: "Osoby", phone: "Telefon", msg: "Wiadomość", footer: "Do zobaczenia, zespół S'Historia", cta: "Odwiedź stronę" },
  en: { subject: "Thanks for your request — S'Historia", hi: "Hi", thanks: "Thanks for reaching out!", soon: "We'll confirm your booking as soon as possible.", detailsTitle: "Your request", date: "Date", time: "Time", people: "Guests", phone: "Phone", msg: "Message", footer: "See you soon, the S'Historia team", cta: "Visit the website" },
  de: { subject: "Danke für deine Anfrage — S'Historia", hi: "Hallo", thanks: "Danke für deine Nachricht!", soon: "Wir bestätigen deine Reservierung so schnell wie möglich.", detailsTitle: "Deine Anfrage", date: "Datum", time: "Uhrzeit", people: "Personen", phone: "Telefon", msg: "Nachricht", footer: "Bis bald, dein S'Historia Team", cta: "Website besuchen" },
  fr: { subject: "Merci pour votre demande — S'Historia", hi: "Bonjour", thanks: "Merci de nous avoir contactés !", soon: "Nous confirmerons votre réservation au plus vite.", detailsTitle: "Votre demande", date: "Date", time: "Heure", people: "Personnes", phone: "Téléphone", msg: "Message", footer: "À bientôt, l'équipe S'Historia", cta: "Visiter le site" },
  es: { subject: "Gracias por tu solicitud — S'Historia", hi: "Hola", thanks: "¡Gracias por contactarnos!", soon: "Confirmaremos tu reserva lo antes posible.", detailsTitle: "Tu solicitud", date: "Fecha", time: "Hora", people: "Personas", phone: "Teléfono", msg: "Mensaje", footer: "Hasta pronto, el equipo de S'Historia", cta: "Visitar el sitio" },
};

function row(label: string, value?: string | number): string {
  if (value === undefined || value === null || value === "") return "";
  return `<tr>
    <td style="padding:8px 0;color:${BRAND.muted};font-size:13px;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;color:${BRAND.cream};font-size:15px;font-weight:600;">${value}</td>
  </tr>`;
}

function shell(innerHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#081019;">
  <div style="background:#081019;padding:30px 14px;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;border-radius:24px;overflow:hidden;background:${BRAND.card};box-shadow:0 28px 70px rgba(0,0,0,0.5);">
    <!-- Header z logo -->
    <div style="text-align:center;padding:50px 28px 32px;background:linear-gradient(180deg,#0E222F,#0c2433);">
      <img src="${BRAND.site}/logo.png" alt="S'Historia" width="132" style="display:inline-block;max-width:132px;height:auto;filter:brightness(0) invert(1);" />
      <div style="font-size:11px;letter-spacing:5px;text-transform:uppercase;color:${BRAND.coral};margin-top:18px;">${BRAND.tagline}</div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,transparent,${BRAND.coral},${BRAND.sky},transparent);"></div>
    <!-- Body -->
    <div style="background:${BRAND.card};padding:46px 42px;">
      ${innerHtml}
    </div>
    <!-- Footer -->
    <div style="text-align:center;padding:32px 28px;background:#0a1822;color:${BRAND.muted};font-size:12px;line-height:2;border-top:1px solid rgba(255,255,255,0.06);">
      <a href="${BRAND.site}" style="color:${BRAND.sky};text-decoration:none;font-weight:600;letter-spacing:1px;">www.shistoria.it</a><br>
      Via Delfino · 07020 Rena Majore (OT), Sardegna<br>
      <span style="opacity:0.6;">info@shistoria.it · +39 0789 000 000</span>
    </div>
  </div>
  </div></body></html>`;
}

/** E-mail do KLIENTA — w jego języku, stylizowany. */
export function clientEmailHTML(v: ReservationVars): { subject: string; html: string } {
  const tr = CLIENT_T[v.lang] ?? CLIENT_T.it;
  const inner = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND.cream};font-weight:800;">${tr.hi} ${v.firstName},</h1>
    <p style="margin:0 0 6px;font-size:16px;color:${BRAND.cream};">${tr.thanks}</p>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.muted};line-height:1.5;">${tr.soon}</p>
    <div style="background:rgba(232,146,124,0.08);border:1px solid rgba(232,146,124,0.25);border-radius:14px;padding:18px 20px;margin:0 0 22px;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.coral};margin-bottom:10px;">${tr.detailsTitle}</div>
      <table style="width:100%;border-collapse:collapse;">
        ${row(tr.date, v.date)}
        ${row(tr.time, v.time)}
        ${row(tr.people, v.people)}
        ${row(tr.phone, v.phone)}
        ${row(tr.msg, v.message)}
      </table>
    </div>
    <a href="${BRAND.site}" style="display:inline-block;background:${BRAND.coral};color:#1a1014;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:999px;">${tr.cta} →</a>
    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.muted};">${tr.footer} 🍸</p>
  `;
  return { subject: tr.subject, html: shell(inner) };
}

/** E-mail do WŁAŚCICIELA — ZAWSZE po włosku. */
export function ownerEmailHTML(v: ReservationVars): { subject: string; html: string } {
  const subject = `🍽️ Nuova prenotazione — ${v.firstName} ${v.lastName} (${v.people ?? "?"} pers.)`;
  // Wiadomość po włosku (jeśli przetłumaczona) + oryginał gdy inny język
  const msgIt = v.messageIt || v.message;
  const msgRow = msgIt
    ? row("Messaggio", v.lang !== "it" && v.message && v.messageIt && v.messageIt !== v.message
        ? `${v.messageIt}<br><span style="color:${BRAND.muted};font-size:12px;font-style:italic;">(originale ${v.lang.toUpperCase()}: ${v.message})</span>`
        : (msgIt || ""))
    : "";
  const inner = `
    <h1 style="margin:0 0 14px;font-size:22px;color:${BRAND.cream};font-weight:800;">Nuova prenotazione</h1>
    <table style="width:100%;border-collapse:collapse;">
      ${row("Nome", `${v.firstName} ${v.lastName}`)}
      ${row("Email", v.email)}
      ${row("Telefono", v.phone)}
      ${row("Data", v.date)}
      ${row("Ora", v.time)}
      ${row("Persone", v.people)}
      ${msgRow}
      ${row("Lingua cliente", v.lang.toUpperCase())}
    </table>
    <p style="margin:18px 0 0;font-size:12px;color:${BRAND.muted};">Rispondi al cliente nella sua lingua (${v.lang.toUpperCase()}).</p>
  `;
  return { subject, html: shell(inner) };
}

/** Tekst WhatsApp do WŁAŚCICIELA — ZAWSZE po włosku (krótki). */
export function ownerWhatsAppText(v: ReservationVars): string {
  return [
    `🍽️ Nuova prenotazione S'Historia`,
    `${v.firstName} ${v.lastName} (${v.lang.toUpperCase()})`,
    `📅 ${v.date || "—"} ${v.time || ""}`,
    `👥 ${v.people ?? "?"} persone`,
    `📞 ${v.phone || "—"}`,
    `✉️ ${v.email}`,
    (v.messageIt || v.message)
      ? (v.lang !== "it" && v.message && v.messageIt && v.messageIt !== v.message
          ? `💬 ${v.messageIt}\n   (${v.lang.toUpperCase()}: ${v.message})`
          : `💬 ${v.messageIt || v.message}`)
      : "",
  ].filter(Boolean).join("\n");
}

/* ════════════════════════════════════════════════════════════════════════
 * DRINK DEL MESE / SETTIMANA — e-maile w języku odbiorcy
 * - winner: gratulacje + darmowy drink
 * - others: ogłoszenie zwycięzcy + zaproszenie żeby sprawdzić
 * ════════════════════════════════════════════════════════════════════════ */
export interface WinnerVars {
  winnerDrink: string;
  winnerAuthor: string;
  recipientName?: string;
  period: "month" | "week";
  lang: Lang;
  link?: string;
  code?: string;      // kod nagrody (darmowy drink) — tylko dla zwycięzcy
  qrUrl?: string;     // URL obrazka QR (do pokazania barmanowi)
}

const CODE_T: Record<Lang, { label: string; note: string; free: string }> = {
  it: { label: "Codice premio", note: "Mostra questo codice o QR al barista — valido una sola volta.", free: "1 DRINK GRATUITO A SCELTA" },
  pl: { label: "Kod nagrody", note: "Pokaż ten kod lub QR barmanowi — ważny tylko raz.", free: "1 DARMOWY DRINK DO WYBORU" },
  en: { label: "Reward code", note: "Show this code or QR to the bartender — valid only once.", free: "1 FREE DRINK OF YOUR CHOICE" },
  de: { label: "Prämiencode", note: "Zeig diesen Code oder QR dem Barkeeper — nur einmal gültig.", free: "1 GRATIS-DRINK NACH WAHL" },
  fr: { label: "Code cadeau", note: "Montre ce code ou QR au barman — valable une seule fois.", free: "1 COCKTAIL GRATUIT AU CHOIX" },
  es: { label: "Código premio", note: "Muestra este código o QR al barman — válido una sola vez.", free: "1 TRAGO GRATIS A ELEGIR" },
};

const WINNER_T: Record<Lang, {
  // dla zwycięzcy
  winSubjMonth: string; winSubjWeek: string; winHi: string; winCongrats: (d: string) => string; winGift: string; winCta: string;
  // dla pozostałych
  othSubjMonth: string; othSubjWeek: string; othHi: string; othBody: (d: string, a: string) => string; othCta: string;
  periodMonth: string; periodWeek: string;
}> = {
  it: {
    winSubjMonth: "🏆 Hai vinto il Drink del Mese!", winSubjWeek: "🏆 Hai vinto il Drink della Settimana!",
    winHi: "Complimenti", winCongrats: (d) => `Il tuo drink <strong>${d}</strong> ha vinto! La community lo ha amato.`,
    winGift: "Vieni a trovarci e ritira un <strong>drink GRATUITO</strong> a tua scelta, offerto dalla casa. 🍸",
    winCta: "Vedi il tuo drink",
    othSubjMonth: "🍸 Il Drink del Mese è stato scelto!", othSubjWeek: "🍸 Il Drink della Settimana è stato scelto!",
    othHi: "Ciao", othBody: (d, a) => `Il vincitore è <strong>${d}</strong> di ${a}. Vienilo a provare da S'Historia!`,
    othCta: "Scopri il drink", periodMonth: "del Mese", periodWeek: "della Settimana",
  },
  pl: {
    winSubjMonth: "🏆 Wygrałeś Drink Miesiąca!", winSubjWeek: "🏆 Wygrałeś Drink Tygodnia!",
    winHi: "Gratulacje", winCongrats: (d) => `Twój drink <strong>${d}</strong> wygrał! Społeczność go pokochała.`,
    winGift: "Wpadnij do nas i odbierz <strong>DARMOWY drink</strong> do wyboru, na koszt lokalu. 🍸",
    winCta: "Zobacz swój drink",
    othSubjMonth: "🍸 Wybrano Drink Miesiąca!", othSubjWeek: "🍸 Wybrano Drink Tygodnia!",
    othHi: "Cześć", othBody: (d, a) => `Zwycięzcą jest <strong>${d}</strong> autorstwa ${a}. Przyjdź spróbować w S'Historia!`,
    othCta: "Zobacz drink", periodMonth: "Miesiąca", periodWeek: "Tygodnia",
  },
  en: {
    winSubjMonth: "🏆 You won Drink of the Month!", winSubjWeek: "🏆 You won Drink of the Week!",
    winHi: "Congratulations", winCongrats: (d) => `Your drink <strong>${d}</strong> won! The community loved it.`,
    winGift: "Come visit us and claim a <strong>FREE drink</strong> of your choice, on the house. 🍸",
    winCta: "See your drink",
    othSubjMonth: "🍸 Drink of the Month has been chosen!", othSubjWeek: "🍸 Drink of the Week has been chosen!",
    othHi: "Hi", othBody: (d, a) => `The winner is <strong>${d}</strong> by ${a}. Come try it at S'Historia!`,
    othCta: "Discover the drink", periodMonth: "of the Month", periodWeek: "of the Week",
  },
  de: {
    winSubjMonth: "🏆 Du hast den Drink des Monats gewonnen!", winSubjWeek: "🏆 Du hast den Drink der Woche gewonnen!",
    winHi: "Herzlichen Glückwunsch", winCongrats: (d) => `Dein Drink <strong>${d}</strong> hat gewonnen! Die Community liebt ihn.`,
    winGift: "Besuch uns und hol dir einen <strong>GRATIS-Drink</strong> deiner Wahl, aufs Haus. 🍸",
    winCta: "Deinen Drink ansehen",
    othSubjMonth: "🍸 Der Drink des Monats steht fest!", othSubjWeek: "🍸 Der Drink der Woche steht fest!",
    othHi: "Hallo", othBody: (d, a) => `Der Gewinner ist <strong>${d}</strong> von ${a}. Probier ihn bei S'Historia!`,
    othCta: "Drink entdecken", periodMonth: "des Monats", periodWeek: "der Woche",
  },
  fr: {
    winSubjMonth: "🏆 Tu as gagné le Cocktail du Mois !", winSubjWeek: "🏆 Tu as gagné le Cocktail de la Semaine !",
    winHi: "Félicitations", winCongrats: (d) => `Ton cocktail <strong>${d}</strong> a gagné ! La communauté l'a adoré.`,
    winGift: "Viens nous voir et récupère un <strong>cocktail GRATUIT</strong> de ton choix, offert par la maison. 🍸",
    winCta: "Voir ton cocktail",
    othSubjMonth: "🍸 Le Cocktail du Mois est choisi !", othSubjWeek: "🍸 Le Cocktail de la Semaine est choisi !",
    othHi: "Bonjour", othBody: (d, a) => `Le gagnant est <strong>${d}</strong> de ${a}. Viens le goûter chez S'Historia !`,
    othCta: "Découvrir le cocktail", periodMonth: "du Mois", periodWeek: "de la Semaine",
  },
  es: {
    winSubjMonth: "🏆 ¡Ganaste el Drink del Mes!", winSubjWeek: "🏆 ¡Ganaste el Drink de la Semana!",
    winHi: "Felicidades", winCongrats: (d) => `¡Tu drink <strong>${d}</strong> ganó! A la comunidad le encantó.`,
    winGift: "Ven a vernos y recoge un <strong>drink GRATIS</strong> a tu elección, cortesía de la casa. 🍸",
    winCta: "Ver tu drink",
    othSubjMonth: "🍸 ¡Se eligió el Drink del Mes!", othSubjWeek: "🍸 ¡Se eligió el Drink de la Semana!",
    othHi: "Hola", othBody: (d, a) => `El ganador es <strong>${d}</strong> de ${a}. ¡Ven a probarlo en S'Historia!`,
    othCta: "Descubre el drink", periodMonth: "del Mes", periodWeek: "de la Semana",
  },
};

function ctaButton(label: string, link: string): string {
  return `<div style="text-align:center;margin:30px 0 8px;">
    <a href="${link}" style="display:inline-block;background:${BRAND.coral};color:#1a1014;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;padding:15px 34px;border-radius:999px;box-shadow:0 8px 24px rgba(232,146,124,0.35);">${label} →</a>
  </div>`;
}

/** E-mail do ZWYCIĘZCY drinka — w jego języku. */
export function winnerEmailHTML(v: WinnerVars): { subject: string; html: string } {
  const tr = WINNER_T[v.lang] ?? WINNER_T.it;
  const ct = CODE_T[v.lang] ?? CODE_T.it;
  const link = v.link || `${BRAND.site}/#ready-drinks`;
  const subject = v.period === "week" ? tr.winSubjWeek : tr.winSubjMonth;
  const codeBlock = v.code ? `
    <div style="margin:26px 0 8px;padding:26px 22px;background:#0a1822;border:1.5px dashed ${BRAND.coral};border-radius:18px;text-align:center;">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.coral};font-weight:700;margin-bottom:6px;">🍸 ${ct.free}</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};margin:14px 0 8px;">${ct.label}</div>
      <div style="font-size:30px;font-weight:800;letter-spacing:7px;color:${BRAND.cream};font-family:'Courier New',monospace;">${v.code}</div>
      ${v.qrUrl ? `<img src="${v.qrUrl}" alt="QR" width="170" style="display:block;margin:18px auto 6px;width:170px;height:170px;border-radius:14px;background:#fff;padding:10px;" />` : ""}
      <div style="font-size:12px;color:${BRAND.muted};margin-top:8px;line-height:1.5;">${ct.note}</div>
    </div>` : "";
  const inner = `
    <div style="text-align:center;font-size:48px;margin-bottom:8px;">👑</div>
    <h1 style="margin:0 0 8px;font-size:25px;color:${BRAND.cream};text-align:center;font-weight:800;">${tr.winHi}${v.recipientName ? `, ${v.recipientName}` : ""}!</h1>
    <p style="margin:16px 0;font-size:16px;color:${BRAND.cream};line-height:1.7;text-align:center;">${tr.winCongrats(v.winnerDrink)}</p>
    <div style="background:rgba(241,196,15,0.12);border:1px solid rgba(241,196,15,0.4);border-radius:16px;padding:20px;margin:20px 0;text-align:center;color:${BRAND.cream};font-size:15px;line-height:1.7;">${tr.winGift}</div>
    ${codeBlock}
    ${ctaButton(tr.winCta, link)}
  `;
  return { subject, html: shell(inner) };
}

/** E-mail do POZOSTAŁYCH twórców — w ich języku (ogłoszenie + zaproszenie). */
export function winnerOthersEmailHTML(v: WinnerVars): { subject: string; html: string } {
  const tr = WINNER_T[v.lang] ?? WINNER_T.it;
  const link = v.link || `${BRAND.site}/#ready-drinks`;
  const subject = v.period === "week" ? tr.othSubjWeek : tr.othSubjMonth;
  const inner = `
    <div style="text-align:center;font-size:40px;margin-bottom:6px;">🍸</div>
    <h1 style="margin:0 0 6px;font-size:22px;color:${BRAND.cream};text-align:center;">${tr.othHi}${v.recipientName ? `, ${v.recipientName}` : ""}!</h1>
    <p style="margin:14px 0;font-size:15px;color:${BRAND.cream};line-height:1.6;text-align:center;">${tr.othBody(v.winnerDrink, v.winnerAuthor)}</p>
    ${ctaButton(tr.othCta, link)}
  `;
  return { subject, html: shell(inner) };
}


/* ──────────────────────────────────────────────────────────────────────────
 * EVENTI — przypomnienia o wydarzeniu (3 dni przed / 5 godzin przed).
 * Pre-renderowane w języku odbiorcy → make.com tylko mapuje gotowe pola.
 * ──────────────────────────────────────────────────────────────────────── */
export interface EventVars {
  name: string;
  eventTitle: string;
  eventDate: string;          // gotowy do wyświetlenia tekst daty/godziny
  eventDescription?: string;
  imageUrl?: string;          // grafika eventu (jak karta na stronie)
  lang: Lang;
  link?: string;
}

const EVENT_T: Record<Lang, {
  subj3d: (t: string) => string; subj5h: (t: string) => string;
  hi: string;
  lead3d: (t: string) => string; lead5h: (t: string) => string;
  whenLabel: string; descLabel: string; cta: string; footer: string;
}> = {
  it: {
    subj3d: (t) => `📅 Tra 3 giorni: ${t} — S'Historia`,
    subj5h: (t) => `⏳ Tra poche ore: ${t}! — S'Historia`,
    hi: "Ciao",
    lead3d: (t) => `Manca poco! Tra 3 giorni ti aspettiamo per <strong>${t}</strong> da S'Historia.`,
    lead5h: (t) => `Ci siamo quasi! <strong>${t}</strong> inizia tra poche ore. Ti aspettiamo!`,
    whenLabel: "Quando", descLabel: "Dettagli", cta: "Vedi l'evento", footer: "A presto, il team di S'Historia",
  },
  pl: {
    subj3d: (t) => `📅 Za 3 dni: ${t} — S'Historia`,
    subj5h: (t) => `⏳ Już za kilka godzin: ${t}! — S'Historia`,
    hi: "Cześć",
    lead3d: (t) => `Już niedługo! Za 3 dni zapraszamy na <strong>${t}</strong> w S'Historia.`,
    lead5h: (t) => `Prawie czas! <strong>${t}</strong> zaczyna się za kilka godzin. Czekamy na Ciebie!`,
    whenLabel: "Kiedy", descLabel: "Szczegóły", cta: "Zobacz wydarzenie", footer: "Do zobaczenia, zespół S'Historia",
  },
  en: {
    subj3d: (t) => `📅 In 3 days: ${t} — S'Historia`,
    subj5h: (t) => `⏳ In a few hours: ${t}! — S'Historia`,
    hi: "Hi",
    lead3d: (t) => `Almost there! In 3 days we're waiting for you at <strong>${t}</strong> at S'Historia.`,
    lead5h: (t) => `Almost time! <strong>${t}</strong> starts in a few hours. See you there!`,
    whenLabel: "When", descLabel: "Details", cta: "View the event", footer: "See you soon, the S'Historia team",
  },
  de: {
    subj3d: (t) => `📅 In 3 Tagen: ${t} — S'Historia`,
    subj5h: (t) => `⏳ In wenigen Stunden: ${t}! — S'Historia`,
    hi: "Hallo",
    lead3d: (t) => `Bald ist es soweit! In 3 Tagen erwarten wir dich bei <strong>${t}</strong> im S'Historia.`,
    lead5h: (t) => `Fast geschafft! <strong>${t}</strong> beginnt in wenigen Stunden. Wir freuen uns auf dich!`,
    whenLabel: "Wann", descLabel: "Details", cta: "Event ansehen", footer: "Bis bald, dein S'Historia Team",
  },
  fr: {
    subj3d: (t) => `📅 Dans 3 jours : ${t} — S'Historia`,
    subj5h: (t) => `⏳ Dans quelques heures : ${t} ! — S'Historia`,
    hi: "Bonjour",
    lead3d: (t) => `C'est bientôt ! Dans 3 jours nous t'attendons pour <strong>${t}</strong> chez S'Historia.`,
    lead5h: (t) => `Ça approche ! <strong>${t}</strong> commence dans quelques heures. À très vite !`,
    whenLabel: "Quand", descLabel: "Détails", cta: "Voir l'événement", footer: "À bientôt, l'équipe S'Historia",
  },
  es: {
    subj3d: (t) => `📅 En 3 días: ${t} — S'Historia`,
    subj5h: (t) => `⏳ En pocas horas: ${t}! — S'Historia`,
    hi: "Hola",
    lead3d: (t) => `¡Ya casi! En 3 días te esperamos para <strong>${t}</strong> en S'Historia.`,
    lead5h: (t) => `¡Casi es la hora! <strong>${t}</strong> empieza en pocas horas. ¡Te esperamos!`,
    whenLabel: "Cuándo", descLabel: "Detalles", cta: "Ver el evento", footer: "Hasta pronto, el equipo de S'Historia",
  },
};

/** E-mail przypomnienia o evencie — w języku odbiorcy. kind: "3d" | "5h". */
export function eventReminderHTML(v: EventVars, kind: "3d" | "5h"): { subject: string; html: string } {
  const tr = EVENT_T[v.lang] ?? EVENT_T.it;
  const link = v.link || `${BRAND.site}/#eventi`;
  const subject = kind === "3d" ? tr.subj3d(v.eventTitle) : tr.subj5h(v.eventTitle);
  const lead = kind === "3d" ? tr.lead3d(v.eventTitle) : tr.lead5h(v.eventTitle);
  // Karta eventu wyśrodkowana — jak na stronie (grafika + tytuł + data + opis)
  const card = `
    <div style="border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);margin:22px 0 6px;box-shadow:0 16px 44px rgba(0,0,0,0.4);">
      ${v.imageUrl
        ? `<img src="${v.imageUrl}" alt="${v.eventTitle}" width="100%" style="display:block;width:100%;height:auto;" />`
        : `<div style="height:150px;background:linear-gradient(135deg,#1a1040,#9b59b6 60%,#E8927C);"></div>`}
      <div style="padding:24px 24px 26px;background:#0a1822;text-align:center;">
        <h2 style="margin:0 0 14px;font-size:22px;color:${BRAND.cream};font-weight:800;letter-spacing:-0.01em;">${v.eventTitle}</h2>
        <div style="display:inline-block;padding:8px 18px;border-radius:999px;background:rgba(232,146,124,0.15);border:1px solid rgba(232,146,124,0.4);color:${BRAND.coral};font-size:13px;font-weight:700;">📅 ${v.eventDate}</div>
        ${v.eventDescription ? `<p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted};line-height:1.7;">${v.eventDescription}</p>` : ""}
      </div>
    </div>`;
  const inner = `
    <h1 style="margin:0 0 14px;font-size:24px;color:${BRAND.cream};font-weight:800;">${tr.hi} ${v.name || ""},</h1>
    <p style="margin:0 0 8px;font-size:16px;line-height:1.7;color:${BRAND.cream};">${lead}</p>
    ${card}
    ${ctaButton(tr.cta, link)}
    <p style="margin:26px 0 0;font-size:14px;color:${BRAND.muted};text-align:center;">${tr.footer} 🍸</p>
  `;
  return { subject, html: shell(inner) };
}


/* ──────────────────────────────────────────────────────────────────────────
 * ODPOWIEDŹ Z ADMINA (czat) — markowy e-mail w języku klienta.
 * ──────────────────────────────────────────────────────────────────────── */
const REPLY_T: Record<Lang, { subject: string; hi: string; note: string }> = {
  it: { subject: "Risposta da S'Historia", hi: "Ciao", note: "Puoi rispondere direttamente a questa email — ti risponderemo qui." },
  pl: { subject: "Odpowiedź od S'Historia", hi: "Cześć", note: "Możesz odpowiedzieć bezpośrednio na tego maila — odpiszemy tutaj." },
  en: { subject: "Reply from S'Historia", hi: "Hi", note: "You can reply directly to this email — we'll answer you here." },
  de: { subject: "Antwort von S'Historia", hi: "Hallo", note: "Du kannst direkt auf diese E-Mail antworten — wir antworten dir hier." },
  fr: { subject: "Réponse de S'Historia", hi: "Bonjour", note: "Tu peux répondre directement à cet e-mail — nous te répondrons ici." },
  es: { subject: "Respuesta de S'Historia", hi: "Hola", note: "Puedes responder directamente a este correo — te contestaremos aquí." },
};
export function adminReplyHTML(v: { name?: string; replyText: string; lang: Lang }): { subject: string; html: string } {
  const tr = REPLY_T[v.lang] ?? REPLY_T.it;
  const inner = `
    <h1 style="margin:0 0 14px;font-size:22px;color:${BRAND.cream};font-weight:800;">${tr.hi}${v.name ? ` ${v.name}` : ""},</h1>
    <div style="font-size:16px;line-height:1.65;color:${BRAND.cream};white-space:pre-wrap;">${v.replyText.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>
    <div style="margin:22px 0 0;padding:14px 16px;background:rgba(232,146,124,0.1);border:1px solid rgba(232,146,124,0.3);border-radius:12px;font-size:13px;color:${BRAND.coral};">↩︎ ${tr.note}</div>
  `;
  return { subject: tr.subject, html: shell(inner) };
}

/* ──────────────────────────────────────────────────────────────────────────
 * NEWSLETTER — markowy mail powitalny w języku subskrybenta.
 * ──────────────────────────────────────────────────────────────────────── */
const NEWS_T: Record<Lang, { subject: string; hi: string; body: string; cta: string }> = {
  it: { subject: "Benvenuto nella newsletter S'Historia 🍸", hi: "Ciao", body: "Grazie per esserti iscritto! Riceverai novità su menu, eventi e i cocktail della community — una bella mail, non spam.", cta: "Visita il sito" },
  pl: { subject: "Witaj w newsletterze S'Historia 🍸", hi: "Cześć", body: "Dziękujemy za zapis! Będziesz dostawać nowości o menu, wydarzeniach i drinkach społeczności — ładny mail, nie spam.", cta: "Odwiedź stronę" },
  en: { subject: "Welcome to the S'Historia newsletter 🍸", hi: "Hi", body: "Thanks for subscribing! You'll get news about our menu, events and community cocktails — a nice email, not spam.", cta: "Visit the website" },
  de: { subject: "Willkommen beim S'Historia Newsletter 🍸", hi: "Hallo", body: "Danke für deine Anmeldung! Du bekommst News zu Menü, Events und Community-Cocktails — eine schöne Mail, kein Spam.", cta: "Website besuchen" },
  fr: { subject: "Bienvenue dans la newsletter S'Historia 🍸", hi: "Bonjour", body: "Merci de t'être inscrit ! Tu recevras des nouvelles sur le menu, les événements et les cocktails de la communauté — un bel e-mail, pas du spam.", cta: "Visiter le site" },
  es: { subject: "Bienvenido a la newsletter de S'Historia 🍸", hi: "Hola", body: "¡Gracias por suscribirte! Recibirás novedades sobre el menú, eventos y cócteles de la comunidad — un correo bonito, no spam.", cta: "Visitar el sitio" },
};
export function newsletterWelcomeHTML(v: { name?: string; lang: Lang }): { subject: string; html: string } {
  const tr = NEWS_T[v.lang] ?? NEWS_T.it;
  const inner = `
    <div style="text-align:center;font-size:42px;margin-bottom:6px;">📧</div>
    <h1 style="margin:0 0 10px;font-size:24px;color:${BRAND.cream};text-align:center;font-weight:800;">${tr.hi}${v.name ? ` ${v.name}` : ""}!</h1>
    <p style="margin:0 0 6px;font-size:16px;line-height:1.6;color:${BRAND.cream};text-align:center;">${tr.body}</p>
    ${ctaButton(tr.cta, BRAND.site)}
  `;
  return { subject: tr.subject, html: shell(inner) };
}

/* ──────────────────────────────────────────────────────────────────────────
 * RECENSIONE — podziękowanie za opinię, w języku klienta.
 * Wywoływane po dodaniu recenzji (jeśli klient podał email).
 * ──────────────────────────────────────────────────────────────────────── */
const REVIEW_T: Record<Lang, {
  subject: string; hi: string; thanks: string; body: string; pending: string; cta: string;
}> = {
  it: {
    subject: "Grazie per la tua recensione 🌟 — S'Historia",
    hi: "Ciao", thanks: "Grazie di cuore per la tua recensione!",
    body: "Le tue parole ci aiutano a crescere e a migliorare ogni giorno. Significa molto per tutto il team.",
    pending: "La tua recensione sarà visibile sul sito dopo una rapida approvazione.",
    cta: "Visita il sito",
  },
  pl: {
    subject: "Dziękujemy za opinię 🌟 — S'Historia",
    hi: "Cześć", thanks: "Z całego serca dziękujemy za Twoją opinię!",
    body: "Twoje słowa pomagają nam się rozwijać i być coraz lepszymi każdego dnia. To wiele znaczy dla całego zespołu.",
    pending: "Twoja opinia pojawi się na stronie po krótkiej akceptacji.",
    cta: "Odwiedź stronę",
  },
  en: {
    subject: "Thank you for your review 🌟 — S'Historia",
    hi: "Hi", thanks: "Thank you so much for your review!",
    body: "Your words help us grow and get better every day. It means a lot to the whole team.",
    pending: "Your review will appear on the site after a quick approval.",
    cta: "Visit the website",
  },
  de: {
    subject: "Danke für deine Bewertung 🌟 — S'Historia",
    hi: "Hallo", thanks: "Vielen Dank für deine Bewertung!",
    body: "Deine Worte helfen uns, jeden Tag besser zu werden. Das bedeutet dem ganzen Team viel.",
    pending: "Deine Bewertung erscheint nach einer kurzen Freigabe auf der Website.",
    cta: "Website besuchen",
  },
  fr: {
    subject: "Merci pour ton avis 🌟 — S'Historia",
    hi: "Bonjour", thanks: "Merci beaucoup pour ton avis !",
    body: "Tes mots nous aident à grandir et à nous améliorer chaque jour. Cela compte beaucoup pour toute l'équipe.",
    pending: "Ton avis sera visible sur le site après une rapide validation.",
    cta: "Visiter le site",
  },
  es: {
    subject: "Gracias por tu reseña 🌟 — S'Historia",
    hi: "Hola", thanks: "¡Muchas gracias por tu reseña!",
    body: "Tus palabras nos ayudan a crecer y a mejorar cada día. Significa mucho para todo el equipo.",
    pending: "Tu reseña aparecerá en el sitio tras una rápida aprobación.",
    cta: "Visitar el sitio",
  },
};

export function reviewThankYouHTML(v: { name?: string; stars?: number; lang: Lang }): { subject: string; html: string } {
  const tr = REVIEW_T[v.lang] ?? REVIEW_T.it;
  const stars = Math.max(1, Math.min(5, v.stars || 5));
  const starsHtml = `<div style="text-align:center;font-size:30px;letter-spacing:6px;color:#F1C40F;margin:6px 0 16px;">${"★".repeat(stars)}<span style="color:rgba(255,255,255,0.18);">${"★".repeat(5 - stars)}</span></div>`;
  const inner = `
    <div style="text-align:center;font-size:42px;margin-bottom:4px;">🌟</div>
    <h1 style="margin:0 0 6px;font-size:24px;color:${BRAND.cream};text-align:center;font-weight:800;">${tr.hi}${v.name ? ` ${v.name}` : ""}!</h1>
    ${starsHtml}
    <p style="margin:0 0 6px;font-size:16px;line-height:1.6;color:${BRAND.cream};text-align:center;">${tr.thanks}</p>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${BRAND.muted};text-align:center;">${tr.body}</p>
    <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${BRAND.muted};text-align:center;font-style:italic;">${tr.pending}</p>
    ${ctaButton(tr.cta, BRAND.site)}
  `;
  return { subject: tr.subject, html: shell(inner) };
}

/* ──────────────────────────────────────────────────────────────────────────
 * NEWSLETTER BROADCAST — powiadomienia do subskrybentów o nowym drinku/evencie.
 * Pre-renderowane w języku odbiorcy → make.com iteruje listę i wysyła.
 * ──────────────────────────────────────────────────────────────────────── */
export interface BroadcastVars {
  name?: string;
  kind: "drink" | "event";
  title: string;
  description?: string;
  imageUrl?: string;
  whenText?: string;   // tylko event: data/godzina
  lang: Lang;
  link?: string;
}

const BROADCAST_T: Record<Lang, {
  drinkSubj: (t: string) => string; eventSubj: (t: string) => string;
  hi: string;
  drinkLead: string; eventLead: string;
  whenLabel: string; drinkCta: string; eventCta: string; footer: string; unsub: string;
}> = {
  it: {
    drinkSubj: (t) => `🍸 Nuovo cocktail da provare: ${t}`,
    eventSubj: (t) => `🎉 Nuovo evento da S'Historia: ${t}`,
    hi: "Ciao",
    drinkLead: "C'è una novità che dovresti assolutamente assaggiare da S'Historia:",
    eventLead: "Abbiamo un nuovo evento in arrivo — non perdertelo:",
    whenLabel: "Quando", drinkCta: "Scopri il drink", eventCta: "Vedi l'evento",
    footer: "A presto, il team di S'Historia",
    unsub: "Ricevi questa email perché sei iscritto alla newsletter S'Historia.",
  },
  pl: {
    drinkSubj: (t) => `🍸 Nowy drink do spróbowania: ${t}`,
    eventSubj: (t) => `🎉 Nowe wydarzenie w S'Historia: ${t}`,
    hi: "Cześć",
    drinkLead: "Mamy nowość, której koniecznie musisz spróbować w S'Historia:",
    eventLead: "Szykuje się nowe wydarzenie — nie przegap go:",
    whenLabel: "Kiedy", drinkCta: "Zobacz drink", eventCta: "Zobacz wydarzenie",
    footer: "Do zobaczenia, zespół S'Historia",
    unsub: "Otrzymujesz tę wiadomość, bo zapisałeś się do newslettera S'Historia.",
  },
  en: {
    drinkSubj: (t) => `🍸 A new cocktail to try: ${t}`,
    eventSubj: (t) => `🎉 A new event at S'Historia: ${t}`,
    hi: "Hi",
    drinkLead: "There's something new you absolutely have to taste at S'Historia:",
    eventLead: "We have a new event coming up — don't miss it:",
    whenLabel: "When", drinkCta: "Discover the drink", eventCta: "View the event",
    footer: "See you soon, the S'Historia team",
    unsub: "You're receiving this because you subscribed to the S'Historia newsletter.",
  },
  de: {
    drinkSubj: (t) => `🍸 Ein neuer Cocktail zum Probieren: ${t}`,
    eventSubj: (t) => `🎉 Ein neues Event im S'Historia: ${t}`,
    hi: "Hallo",
    drinkLead: "Es gibt etwas Neues, das du unbedingt im S'Historia probieren musst:",
    eventLead: "Wir haben ein neues Event — verpass es nicht:",
    whenLabel: "Wann", drinkCta: "Drink entdecken", eventCta: "Event ansehen",
    footer: "Bis bald, dein S'Historia Team",
    unsub: "Du erhältst diese E-Mail, weil du den S'Historia Newsletter abonniert hast.",
  },
  fr: {
    drinkSubj: (t) => `🍸 Un nouveau cocktail à goûter : ${t}`,
    eventSubj: (t) => `🎉 Un nouvel événement chez S'Historia : ${t}`,
    hi: "Bonjour",
    drinkLead: "Il y a une nouveauté que tu dois absolument goûter chez S'Historia :",
    eventLead: "Un nouvel événement arrive — ne le manque pas :",
    whenLabel: "Quand", drinkCta: "Découvrir le cocktail", eventCta: "Voir l'événement",
    footer: "À bientôt, l'équipe S'Historia",
    unsub: "Tu reçois cet e-mail car tu es inscrit à la newsletter S'Historia.",
  },
  es: {
    drinkSubj: (t) => `🍸 Un nuevo cóctel para probar: ${t}`,
    eventSubj: (t) => `🎉 Un nuevo evento en S'Historia: ${t}`,
    hi: "Hola",
    drinkLead: "Hay una novedad que tienes que probar sí o sí en S'Historia:",
    eventLead: "Tenemos un nuevo evento — no te lo pierdas:",
    whenLabel: "Cuándo", drinkCta: "Descubre el drink", eventCta: "Ver el evento",
    footer: "Hasta pronto, el equipo de S'Historia",
    unsub: "Recibes este correo porque te suscribiste a la newsletter de S'Historia.",
  },
};

export function newsletterBroadcastHTML(v: BroadcastVars): { subject: string; html: string } {
  const tr = BROADCAST_T[v.lang] ?? BROADCAST_T.it;
  const isDrink = v.kind === "drink";
  const link = v.link || `${BRAND.site}/${isDrink ? "#ready-drinks" : "#eventi"}`;
  const subject = isDrink ? tr.drinkSubj(v.title) : tr.eventSubj(v.title);
  const lead = isDrink ? tr.drinkLead : tr.eventLead;
  const cta = isDrink ? tr.drinkCta : tr.eventCta;
  const img = v.imageUrl
    ? `<img src="${v.imageUrl}" alt="${v.title}" width="100%" style="display:block;width:100%;max-width:520px;height:auto;border-radius:14px;margin:0 0 18px;" />`
    : `<div style="text-align:center;font-size:54px;margin:6px 0 14px;">${isDrink ? "🍸" : "🎉"}</div>`;
  const inner = `
    <h1 style="margin:0 0 12px;font-size:23px;color:${BRAND.cream};font-weight:800;">${tr.hi}${v.name ? ` ${v.name}` : ""},</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.cream};">${lead}</p>
    ${img}
    <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND.coral};font-weight:800;">${v.title}</h2>
    ${v.whenText ? `<table style="width:100%;border-collapse:collapse;margin:0 0 6px;">${row(tr.whenLabel, v.whenText)}</table>` : ""}
    ${v.description ? `<p style="margin:6px 0 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">${v.description}</p>` : ""}
    ${ctaButton(cta, link)}
    <p style="margin:22px 0 0;font-size:14px;color:${BRAND.muted};">${tr.footer} 🍸</p>
    <p style="margin:14px 0 0;font-size:11px;color:${BRAND.muted};opacity:0.7;">${tr.unsub}</p>
  `;
  return { subject, html: shell(inner) };
}
