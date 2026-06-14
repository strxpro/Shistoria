import { NextRequest, NextResponse } from "next/server";
import { newsletterBroadcastHTML, type Lang } from "@/lib/email-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/notify-subscribers — wysyła do WSZYSTKICH subskrybentów newslettera
 * powiadomienie o nowym drinku LUB nowym evencie, każdy mail spersonalizowany
 * i przetłumaczony na język subskrybenta. Maile są PRE-RENDEROWANE w kodzie —
 * make.com tylko iteruje listę `recipients` i wysyła gotowy `email_html`.
 *
 * Wywołanie (POST):
 *   /api/notify-subscribers?key=CRON_SECRET
 *   body: {
 *     kind: "drink" | "event",
 *     title: string,
 *     description?: string,
 *     image_url?: string,
 *     when_text?: string,        // tylko event
 *     link?: string
 *   }
 *
 * Bezpieczeństwo: ?key=SEKRET musi pasować do CRON_SECRET (env).
 * Subskrybentów czytamy service-key'em (omija RLS).
 */

const CRON_SECRET = process.env.CRON_SECRET || "";
const ADMIN_PIN = process.env.ADMIN_PIN || "shistoria2026"; // ten sam co panel admina
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const MAKE_WEBHOOK =
  process.env.NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK ||
  process.env.MAKE_NEWSLETTER_WEBHOOK ||
  "";

const norm = (l?: string): Lang => (["it", "pl", "en", "de", "fr", "es"].includes(l || "") ? (l as Lang) : "it");

async function loadSubscribers(): Promise<{ email: string; name: string; lang: string }[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/newsletter?select=email,name,language&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as { email: string; name?: string; language?: string }[];
  // deduplikacja po emailu
  const seen = new Set<string>();
  const out: { email: string; name: string; lang: string }[] = [];
  for (const r of rows) {
    const e = (r.email || "").trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push({ email: r.email.trim(), name: r.name || "", lang: norm(r.language) });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || "";
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  // Auth: albo ?key=CRON_SECRET (cron/automat), albo admin_pin z panelu admina.
  const keyOk = CRON_SECRET && key === CRON_SECRET;
  const pinOk = body?.admin_pin && body.admin_pin === ADMIN_PIN;
  if (!keyOk && !pinOk) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!MAKE_WEBHOOK) {
    return NextResponse.json({ ok: false, error: "NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK non configurato (env)" }, { status: 500 });
  }

  const kind = body.kind === "event" ? "event" : "drink";
  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, error: "title obbligatorio" }, { status: 400 });
  }
  const description = body.description || "";
  const imageUrl = body.image_url || "";
  const whenText = body.when_text || "";
  const link = body.link || "";

  const subs = await loadSubscribers();
  if (subs.length === 0) {
    return NextResponse.json({ ok: true, recipients: 0, note: "Nessun iscritto." });
  }

  // Pre-renderuj mail dla KAŻDEGO subskrybenta w jego języku
  const recipients = subs.map((s) => {
    const lang = norm(s.lang);
    const mail = newsletterBroadcastHTML({
      name: s.name,
      kind: kind as "drink" | "event",
      title,
      description,
      imageUrl,
      whenText,
      lang,
      link,
    });
    return { email: s.email, name: s.name, lang, email_subject: mail.subject, email_html: mail.html };
  });

  // Wyślij do make.com — jeden payload z listą gotowych maili (make iteruje i wysyła)
  try {
    await fetch(MAKE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "newsletter_broadcast",
        kind,
        title,
        recipients,
        source: "shistoria.it",
        ts: new Date().toISOString(),
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "errore invio make" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recipients: recipients.length, kind, title });
}
