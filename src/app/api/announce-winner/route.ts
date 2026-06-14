/**
 * /api/announce-winner — automatyczne ogłaszanie Drinka Tygodnia / Miesiąca.
 *
 * Odpalane przez cron (np. cron-job.org) RAZ DZIENNIE z sekretem:
 *   GET /api/announce-winner?secret=XXX
 * Logika sama decyduje, co dziś ogłosić:
 *   • dzień 8/15/22/29 → Drink Tygodnia za właśnie zakończony tydzień
 *   • dzień 1          → Drink Miesiąca za poprzedni miesiąc
 * Tydzień liczony OD 1. DNIA MIESIĄCA (1–7, 8–14, 15–21, 22–28).
 * Wynik drinka = polubienia + zamówienia×2 (w oknie czasu). Bez wykluczania —
 * jeśli ten sam drink się utrzymuje, wygrywa dalej.
 *
 * Testowo (pomija bramkę „już ogłoszone"):
 *   GET /api/announce-winner?secret=XXX&force=week   (tydzień do teraz)
 *   GET /api/announce-winner?secret=XXX&force=month  (miesiąc do teraz)
 *
 * Odbiorcy maila „ogłoszenie": WSZYSCY autorzy drinków community (z e-mailem)
 * + WSZYSCY subskrybenci newslettera — każdy w swoim języku. Zwycięzca dostaje
 * osobny mail gratulacyjny. Treść pre-renderowana tu (email-templates), Make
 * tylko wysyła gotowe pola (istniejący scenariusz „shistoria-winner").
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { winnerEmailHTML, winnerOthersEmailHTML, type Lang } from "../../../lib/email-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://www.shistoria.it";
const WINNER_WEBHOOK = process.env.NEXT_PUBLIC_MAKE_WINNER_WEBHOOK || process.env.MAKE_WINNER_WEBHOOK || "";
const SECRET = process.env.ANNOUNCE_SECRET || "shistoria-cron";

const normLang = (l?: string | null): Lang => (["it", "pl", "en", "de", "fr", "es"].includes(l || "") ? (l as Lang) : "it");
const pad2 = (n: number) => String(n).padStart(2, "0");

type Period = { type: "week" | "month"; key: string; start: Date; end: Date };

/** Okresy do ogłoszenia DZIŚ (UTC) — lub wymuszony przez ?force. */
function duePeriods(now: Date, force?: string | null): Period[] {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), day = now.getUTCDate();
  const periods: Period[] = [];

  if (force === "week") {
    const wi = Math.floor((day - 1) / 7);                 // bieżący tydzień do teraz
    const start = new Date(Date.UTC(y, m, wi * 7 + 1));
    periods.push({ type: "week", key: `${y}-${pad2(m + 1)}-W${wi + 1}-test`, start, end: now });
    return periods;
  }
  if (force === "month") {
    periods.push({ type: "month", key: `${y}-${pad2(m + 1)}-test`, start: new Date(Date.UTC(y, m, 1)), end: now });
    return periods;
  }

  // AUTO: tydzień ogłaszany w dniu 8/15/22/29 (właśnie zakończone okno tyg.)
  if (day === 8 || day === 15 || day === 22 || day === 29) {
    const wi = Math.floor((day - 1) / 7) - 1;             // poprzednie okno
    const start = new Date(Date.UTC(y, m, wi * 7 + 1));
    const end = new Date(Date.UTC(y, m, (wi + 1) * 7 + 1));
    periods.push({ type: "week", key: `${y}-${pad2(m + 1)}-W${wi + 1}`, start, end });
  }
  // miesiąc ogłaszany 1. dnia (poprzedni miesiąc)
  if (day === 1) {
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    periods.push({ type: "month", key: `${py}-${pad2(pm + 1)}`, start: new Date(Date.UTC(py, pm, 1)), end: new Date(Date.UTC(y, m, 1)) });
  }
  return periods;
}

/** Policz wynik (likes + orders×2) per drink w oknie [start,end). */
async function computeScores(start: Date, end: Date) {
  const s = start.toISOString(), e = end.toISOString();
  const [drinksRes, likesRes, ordersRes] = await Promise.all([
    supabase.from("community_drinks").select("id,name,author_name,author_email,lang").eq("is_published", true),
    supabase.from("drink_likes").select("drink_id").gte("created_at", s).lt("created_at", e),
    supabase.from("drink_orders").select("drink_id").gte("created_at", s).lt("created_at", e).not("drink_id", "is", null),
  ]);
  const drinks = drinksRes.data || [];
  const likeCount = new Map<string, number>();
  (likesRes.data || []).forEach((r: any) => { if (r.drink_id) likeCount.set(r.drink_id, (likeCount.get(r.drink_id) || 0) + 1); });
  const orderCount = new Map<string, number>();
  (ordersRes.data || []).forEach((r: any) => { if (r.drink_id) orderCount.set(r.drink_id, (orderCount.get(r.drink_id) || 0) + 1); });
  return drinks
    .map((d: any) => ({ ...d, score: (likeCount.get(d.id) || 0) + (orderCount.get(d.id) || 0) * 2 }))
    .sort((a: any, b: any) => b.score - a.score);
}

/** Lista odbiorców „ogłoszenia": autorzy community + newsletter (dedup po e-mailu, bez zwycięzcy). */
async function buildRecipients(winnerEmail: string) {
  const [authorsRes, newsRes] = await Promise.all([
    supabase.from("community_drinks").select("author_email,author_name,lang").not("author_email", "is", null),
    supabase.from("newsletter").select("email,name,language"),
  ]);
  const map = new Map<string, { email: string; name: string; lang: Lang }>();
  (authorsRes.data || []).forEach((a: any) => {
    const email = (a.author_email || "").trim().toLowerCase();
    if (email && !map.has(email)) map.set(email, { email, name: a.author_name || "", lang: normLang(a.lang) });
  });
  (newsRes.data || []).forEach((n: any) => {
    const email = (n.email || "").trim().toLowerCase();
    if (!email) return;
    // newsletter ma jawny język — nadpisuje domyślny
    map.set(email, { email, name: n.name || map.get(email)?.name || "", lang: normLang(n.language) });
  });
  if (winnerEmail) map.delete(winnerEmail.trim().toLowerCase());
  return [...map.values()];
}

async function announce(p: Period, force: boolean) {
  const ranked = await computeScores(p.start, p.end);
  const winner = ranked.find((d: any) => d.score > 0);
  if (!winner) return { period: p.key, skipped: "no_activity" };

  // Idempotencja — nie ogłaszaj 2x tego samego okresu (force pomija bramkę)
  if (!force) {
    const ins = await supabase.from("winner_announcements")
      .insert({ period_type: p.type, period_key: p.key, drink_id: winner.id, drink_name: winner.name, score: winner.score })
      .select("id");
    if (ins.error || !ins.data || ins.data.length === 0) return { period: p.key, skipped: "already_announced" };
  }

  const link = `${SITE}/#ready-drinks`;
  const winLang = normLang(winner.lang);
  const winnerMail = winnerEmailHTML({ winnerDrink: winner.name, winnerAuthor: winner.author_name || "", recipientName: winner.author_name || "", period: p.type, lang: winLang, link });
  const recipients = (await buildRecipients(winner.author_email || "")).map((r) => {
    const m = winnerOthersEmailHTML({ winnerDrink: winner.name, winnerAuthor: winner.author_name || "", recipientName: r.name, period: p.type, lang: r.lang, link });
    return { email: r.email, name: r.name, lang: r.lang, email_subject: m.subject, email_html: m.html };
  });

  // Drink Miesiąca → oznacz w bazie (front pokazuje koronę/featured)
  if (p.type === "month") {
    await supabase.from("community_drinks").update({ is_drink_of_month: false }).eq("is_drink_of_month", true);
    await supabase.from("community_drinks").update({ is_drink_of_month: true }).eq("id", winner.id);
  }

  let sent = false;
  if (WINNER_WEBHOOK) {
    try {
      const res = await fetch(WINNER_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "winner_announcement",
          period: p.type,
          winner_drink: winner.name,
          winner_author: winner.author_name || "",
          winner_email: winner.author_email || "",
          winner_lang: winLang,
          winner_email_subject: winnerMail.subject,
          winner_email_html: winnerMail.html,
          recipients,
          link,
          source: "announce-winner-cron",
        }),
      });
      sent = res.ok;
    } catch { sent = false; }
  }

  return { period: p.key, type: p.type, winner: winner.name, score: winner.score, recipients: recipients.length, sent };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force");
  // FORCE (test, pomija bramkę idempotencji) wymaga sekretu. Tryb AUTO jest publiczny:
  // jest bezpieczny, bo ogłasza TYLKO w dni graniczne (1/8/15/22/29) i jest idempotentny
  // (tabela winner_announcements z unikalnym period_key blokuje duplikaty). Dzięki temu
  // można go wołać z frontu przy każdym wejściu na stronę — bez crona.
  if (force && searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const periods = duePeriods(new Date(), force);
  if (periods.length === 0) {
    return NextResponse.json({ ok: true, message: "nothing due today", utc: new Date().toISOString() });
  }
  const results = [];
  for (const p of periods) results.push(await announce(p, !!force));
  return NextResponse.json({ ok: true, results });
}
