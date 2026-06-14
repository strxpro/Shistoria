"use client";

import { useMemo, useState } from "react";
import {
  type Lang,
  clientEmailHTML,
  ownerEmailHTML,
  winnerEmailHTML,
  winnerOthersEmailHTML,
  eventReminderHTML,
  adminReplyHTML,
  newsletterWelcomeHTML,
  reviewThankYouHTML,
  newsletterBroadcastHTML,
} from "@/lib/email-templates";

/**
 * /email-preview — prywatna podstrona testowa: podgląd WSZYSTKICH e-maili
 * z przełącznikiem języka. Klikasz szablon → widzisz dokładnie jak wygląda.
 * Renderuje prawdziwy HTML w iframe (tak jak w skrzynce).
 */

const LANGS: Lang[] = ["it", "pl", "en", "de", "fr", "es"];
const LANG_LABEL: Record<Lang, string> = {
  it: "🇮🇹 IT", pl: "🇵🇱 PL", en: "🇬🇧 EN", de: "🇩🇪 DE", fr: "🇫🇷 FR", es: "🇪🇸 ES",
};

type TplFn = (lang: Lang) => { subject: string; html: string };

const TEMPLATES: { id: string; label: string; build: TplFn }[] = [
  {
    id: "newsletter", label: "📧 Newsletter — benvenuto",
    build: (lang) => newsletterWelcomeHTML({ name: "Claudio", lang }),
  },
  {
    id: "broadcast-drink", label: "📣 Broadcast — nuovo drink",
    build: (lang) => newsletterBroadcastHTML({ name: "Claudio", kind: "drink", title: "Negroni d'Autunno", description: "Gin, vermouth rosso, bitter d'arancia — la nostra novità della settimana.", lang }),
  },
  {
    id: "broadcast-event", label: "📣 Broadcast — nuovo evento",
    build: (lang) => newsletterBroadcastHTML({ name: "Claudio", kind: "event", title: "Serata Jazz & Cocktail", whenText: "Venerdì 20 giugno, ore 21:00", description: "Live jazz e drink d'autore sotto le stelle.", lang }),
  },
  {
    id: "reply", label: "💬 Risposta admin (chat)",
    build: (lang) => adminReplyHTML({ name: "Claudio", replyText: "Grazie per il tuo messaggio! Confermiamo la prenotazione per sabato alle 20:30. A presto!", lang }),
  },
  {
    id: "review", label: "🌟 Grazie per recensione",
    build: (lang) => reviewThankYouHTML({ name: "Claudio", stars: 5, lang }),
  },
  {
    id: "winner", label: "🏆 Winner — vincitore (mese)",
    build: (lang) => winnerEmailHTML({ winnerDrink: "Tramonto Sardo", winnerAuthor: "Claudio", recipientName: "Claudio", period: "month", lang, code: "SH-A7K2Q", qrUrl: "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=https://www.shistoria.it/reward/SH-A7K2Q" }),
  },
  {
    id: "winner-others", label: "🍸 Winner — agli altri",
    build: (lang) => winnerOthersEmailHTML({ winnerDrink: "Tramonto Sardo", winnerAuthor: "Marco", recipientName: "Claudio", period: "month", lang }),
  },
  {
    id: "event-3d", label: "📅 Evento — 3 giorni prima",
    build: (lang) => eventReminderHTML({ name: "Claudio", eventTitle: "Serata Jazz & Cocktail", eventDate: "Venerdì 20 giugno, ore 21:00", eventDescription: "Live jazz e drink d'autore.", lang }, "3d"),
  },
  {
    id: "event-5h", label: "⏳ Evento — 5 ore prima",
    build: (lang) => eventReminderHTML({ name: "Claudio", eventTitle: "Serata Jazz & Cocktail", eventDate: "Oggi, ore 21:00", eventDescription: "Live jazz e drink d'autore.", lang }, "5h"),
  },
  {
    id: "reservation-client", label: "🍽️ Prenotazione — al cliente",
    build: (lang) => clientEmailHTML({ firstName: "Claudio", lastName: "Taras", email: "claudio@example.com", phone: "+39 333 1234567", date: "2026-06-25", time: "20:30", people: 4, message: "Tavolo vicino alla finestra", lang }),
  },
  {
    id: "reservation-owner", label: "🍽️ Prenotazione — al locale (IT)",
    build: (lang) => ownerEmailHTML({ firstName: "Claudio", lastName: "Taras", email: "claudio@example.com", phone: "+39 333 1234567", date: "2026-06-25", time: "20:30", people: 4, message: "Tavolo vicino alla finestra", lang }),
  },
];

export default function EmailPreviewPage() {
  const [lang, setLang] = useState<Lang>("it");
  const [tplId, setTplId] = useState(TEMPLATES[0].id);

  const tpl = TEMPLATES.find((t) => t.id === tplId) || TEMPLATES[0];
  const { subject, html } = useMemo(() => {
    try { return tpl.build(lang); } catch (e) { return { subject: "Errore", html: `<pre>${String(e)}</pre>` }; }
  }, [tpl, lang]);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div>
          <h1 style={S.h1}>📬 Anteprima Email — S'Historia</h1>
          <p style={S.sub}>Pagina di test privata. Scegli un template e una lingua per vedere come arriva l'email.</p>
        </div>
        <div style={S.langs}>
          {LANGS.map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{ ...S.langBtn, ...(l === lang ? S.langOn : {}) }}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </header>

      <div style={S.body}>
        <aside style={S.list}>
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setTplId(t.id)} style={{ ...S.item, ...(t.id === tplId ? S.itemOn : {}) }}>
              {t.label}
            </button>
          ))}
        </aside>

        <main style={S.main}>
          <div style={S.subjectBar}>
            <span style={S.subjectLabel}>Oggetto:</span>
            <strong style={S.subjectTxt}>{subject}</strong>
          </div>
          <iframe title="email" srcDoc={html} style={S.iframe} />
        </main>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a1822", color: "#eaf2f7", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  sub: { margin: "4px 0 0", fontSize: 13, opacity: 0.6 },
  langs: { display: "flex", gap: 6, flexWrap: "wrap" },
  langBtn: { padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#eaf2f7", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  langOn: { background: "#E8927C", color: "#1a1014", borderColor: "#E8927C" },
  body: { display: "flex", gap: 0, alignItems: "stretch", minHeight: "calc(100vh - 86px)" },
  list: { width: 280, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.1)", padding: 12, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" },
  item: { textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid transparent", background: "rgba(255,255,255,0.04)", color: "#eaf2f7", fontSize: 14, cursor: "pointer" },
  itemOn: { background: "rgba(232,146,124,0.18)", borderColor: "rgba(232,146,124,0.5)", fontWeight: 700 },
  main: { flex: 1, display: "flex", flexDirection: "column", padding: 16, gap: 12 },
  subjectBar: { display: "flex", gap: 10, alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.05)", borderRadius: 12 },
  subjectLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.5 },
  subjectTxt: { fontSize: 15 },
  iframe: { flex: 1, width: "100%", minHeight: 600, border: "none", borderRadius: 12, background: "#fff" },
};
