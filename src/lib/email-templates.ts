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
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a1822;">
  <div style="max-width:580px;margin:0 auto;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;">
    <!-- Header z logo -->
    <div style="text-align:center;padding:36px 24px 20px;background:linear-gradient(180deg,#0E222F,#0a1822);">
      <img src="${BRAND.site}/logo.png" alt="S'Historia" width="120" style="display:inline-block;max-width:120px;height:auto;filter:brightness(0) invert(1);" />
      <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${BRAND.coral};margin-top:14px;">${BRAND.tagline}</div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,transparent,${BRAND.coral},${BRAND.sky},transparent);"></div>
    <!-- Body -->
    <div style="background:${BRAND.card};padding:34px 30px;">
      ${innerHtml}
    </div>
    <!-- Footer -->
    <div style="text-align:center;padding:24px;background:#0a1822;color:${BRAND.muted};font-size:12px;line-height:1.7;">
      <a href="${BRAND.site}" style="color:${BRAND.sky};text-decoration:none;font-weight:600;">www.shistoria.it</a><br>
      Via Rena Majore · Santa Teresa Gallura, Sardegna<br>
      <span style="opacity:0.6;">info@shistoria.it · +39 0789 000 000</span>
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
  const inner = `
    <h1 style="margin:0 0 14px;font-size:22px;color:${BRAND.cream};font-weight:800;">Nuova prenotazione</h1>
    <table style="width:100%;border-collapse:collapse;">
      ${row("Nome", `${v.firstName} ${v.lastName}`)}
      ${row("Email", v.email)}
      ${row("Telefono", v.phone)}
      ${row("Data", v.date)}
      ${row("Ora", v.time)}
      ${row("Persone", v.people)}
      ${row("Messaggio", v.message)}
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
    v.message ? `💬 ${v.message}` : "",
  ].filter(Boolean).join("\n");
}
