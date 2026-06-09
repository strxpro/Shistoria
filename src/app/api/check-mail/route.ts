import { NextRequest, NextResponse } from "next/server";
import tls from "node:tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/check-mail — czyta nieprzeczytane e-maile z OVH (IMAP) i zapisuje je do
 * tabeli contact_messages w Supabase. Wołany przez cron.org co minutę.
 *
 * Bezpieczeństwo: ?key=SEKRET musi pasować do CRON_SECRET (env).
 * Dane IMAP/Supabase z env (Vercel) — nic poufnego w kodzie.
 *
 * Implementacja IMAP minimalna na czystym node:tls (bez bibliotek → 0 MB instalacji).
 */

const IMAP_HOST = process.env.IMAP_HOST || "ssl0.ovh.net";
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const IMAP_USER = process.env.IMAP_USER || "info@shistoria.it";
const IMAP_PASS = process.env.IMAP_PASS || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// ─── Minimalny klient IMAP (tylko to czego potrzebujemy) ──────────────────────
function imapFetchUnseen(): Promise<{ from: string; fromName: string; subject: string; body: string; uid: string }[]> {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host: IMAP_HOST, port: IMAP_PORT, servername: IMAP_HOST }, () => {});
    sock.setEncoding("utf8");
    sock.setTimeout(20000);

    let buffer = "";
    let tag = 0;
    const nextTag = () => `A${++tag}`;
    const results: { from: string; fromName: string; subject: string; body: string; uid: string }[] = [];
    let step: "greet" | "login" | "select" | "search" | "fetch" | "store" | "logout" = "greet";
    let pendingTag = "";
    let uids: string[] = [];
    let fetchIdx = 0;
    let fetchAcc = "";

    const send = (cmd: string) => { pendingTag = nextTag(); sock.write(`${pendingTag} ${cmd}\r\n`); return pendingTag; };

    const fail = (e: any) => { try { sock.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };

    sock.on("timeout", () => fail(new Error("IMAP timeout")));
    sock.on("error", fail);

    sock.on("data", (chunk: string) => {
      buffer += chunk;
      // przetwarzaj liniami zakończonymi odpowiedzią z bieżącym tagiem
      if (step === "greet") {
        if (buffer.includes("* OK")) { buffer = ""; step = "login"; send(`LOGIN "${IMAP_USER}" "${IMAP_PASS.replace(/"/g, '\\"')}"`); }
        return;
      }
      const done = pendingTag && buffer.includes(`${pendingTag} `);
      if (!done) {
        // zbieraj body podczas FETCH
        if (step === "fetch") fetchAcc += "";
        return;
      }
      const ok = buffer.includes(`${pendingTag} OK`);
      const data = buffer;
      buffer = "";

      if (step === "login") {
        if (!ok) return fail(new Error("IMAP login nieudany — sprawdź IMAP_USER/IMAP_PASS"));
        step = "select"; send("SELECT INBOX");
      } else if (step === "select") {
        if (!ok) return fail(new Error("IMAP SELECT INBOX nieudany"));
        step = "search"; send("UID SEARCH UNSEEN");
      } else if (step === "search") {
        // odpowiedź: * SEARCH 12 13 14
        const m = data.match(/\* SEARCH([0-9 ]*)/i);
        uids = m && m[1].trim() ? m[1].trim().split(/\s+/).slice(0, 15) : [];
        if (uids.length === 0) { step = "logout"; send("LOGOUT"); return; }
        step = "fetch"; fetchIdx = 0; fetchAcc = "";
        send(`UID FETCH ${uids[0]} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)] BODY.PEEK[TEXT])`);
      } else if (step === "fetch") {
        const uid = uids[fetchIdx];
        const raw = data;
        // FROM
        const fromLine = (raw.match(/From:\s*(.*)/i)?.[1] || "").trim();
        let fromName = fromLine, fromEmail = fromLine;
        const em = fromLine.match(/<([^>]+)>/);
        if (em) { fromEmail = em[1].trim(); fromName = fromLine.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || fromEmail; }
        else { const justEmail = fromLine.match(/[\w.+-]+@[\w.-]+/); if (justEmail) { fromEmail = justEmail[0]; } }
        const subject = decodeMime((raw.match(/Subject:\s*(.*)/i)?.[1] || "").trim());
        // TEXT body: bierzemy największy blok po nagłówkach literalu {n}
        let body = extractBody(raw);
        // POMIŃ własne powiadomienia / autorespondery (żeby nie zaśmiecać czatu):
        // - maile od samego siebie (info@shistoria.it)
        // - noreply / mailer-daemon / make.com
        // - powiadomienia o nowej rezerwacji (te wysyła system, nie klient)
        const lowerFrom = fromEmail.toLowerCase();
        const isOwn = lowerFrom === IMAP_USER.toLowerCase();
        const isNoreply = /no-?reply|mailer-daemon|postmaster|notification|noreply/i.test(lowerFrom);
        const isSystemSubject = /nuova prenotazione|drink del mese|drink della settimana|nuova richiesta|new reservation/i.test(subject);
        if (fromEmail && fromEmail.includes("@") && !isOwn && !isNoreply && !isSystemSubject) {
          results.push({ from: fromEmail, fromName: fromName || fromEmail, subject, body: body.slice(0, 4000), uid });
        }
        fetchIdx++;
        if (fetchIdx < uids.length) { send(`UID FETCH ${uids[fetchIdx]} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)] BODY.PEEK[TEXT])`); }
        else { step = "store"; send(`UID STORE ${uids.join(",")} +FLAGS (\\Seen)`); }
      } else if (step === "store") {
        step = "logout"; send("LOGOUT");
      } else if (step === "logout") {
        try { sock.end(); } catch {}
        resolve(results);
      }
    });
  });
}

// Dekoduj proste =?UTF-8?B?...?= / =?UTF-8?Q?...?= w temacie
function decodeMime(s: string): string {
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_m, _cs, enc, txt) => {
    try {
      if (enc.toUpperCase() === "B") return Buffer.from(txt, "base64").toString("utf8");
      return txt.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16)));
    } catch { return txt; }
  });
}

// Wyciągnij CZYSTY tekst z surowej odpowiedzi FETCH (obsługa multipart MIME + quoted-printable + HTML)
function extractBody(raw: string): string {
  // 1) odetnij część przed pierwszym literalem {n}\r\n (to są dane FETCH/nagłówki IMAP)
  let body = raw;
  const litIdx = raw.search(/\}\r?\n/);
  if (litIdx >= 0) body = raw.slice(litIdx + raw.slice(litIdx).indexOf("\n") + 1);
  // utnij końcówkę odpowiedzi IMAP ") A.. OK"
  body = body.replace(/\)\s*A\d+ OK[\s\S]*$/i, "");

  // 2) jeśli to multipart — znajdź granicę i wybierz część text/plain (albo text/html)
  const boundaryMatch = body.match(/boundary="?([^"\r\n;]+)"?/i);
  if (boundaryMatch) {
    const boundary = "--" + boundaryMatch[1];
    const parts = body.split(boundary).filter((p) => /content-type:/i.test(p));
    const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p));
    const html = parts.find((p) => /content-type:\s*text\/html/i.test(p));
    const chosen = plain || html;
    if (chosen) body = chosen;
  }

  // 3) usuń nagłówki części (wszystko do pierwszej pustej linii) — zostaw samą treść
  const headerEnd = body.search(/\r?\n\r?\n/);
  const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(body.slice(0, headerEnd >= 0 ? headerEnd : 400));
  const isB64 = /content-transfer-encoding:\s*base64/i.test(body.slice(0, headerEnd >= 0 ? headerEnd : 400));
  const isHtml = /content-type:\s*text\/html/i.test(body.slice(0, headerEnd >= 0 ? headerEnd : 400));
  if (headerEnd >= 0) body = body.slice(headerEnd).replace(/^\r?\n\r?\n/, "");

  // 4) dekodowanie
  if (isB64) {
    try { body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { /* ignore */ }
  } else if (isQP) {
    body = body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    try { body = Buffer.from(body, "latin1").toString("utf8"); } catch { /* ignore */ }
  }

  // 5) jeśli HTML — usuń style/skrypty/tagi, zostaw tekst
  if (isHtml || /<[a-z][\s\S]*>/i.test(body)) {
    body = body
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\/(p|div|tr|h[1-6]|li|br)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  }

  // 6) sprzątanie: usuń pozostałe granice MIME i nadmiar białych znaków
  body = body
    .replace(/--[A-Za-z0-9'._-]{10,}--?/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return body || "(messaggio vuoto)";
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!CRON_SECRET || key !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!IMAP_PASS) {
    return NextResponse.json({ ok: false, error: "IMAP_PASS non configurato (env)" }, { status: 500 });
  }
  try {
    const mails = await imapFetchUnseen();
    let saved = 0;
    for (const m of mails) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          name: m.fromName,
          email: m.from,
          message: m.subject ? `${m.subject}\n\n${m.body}` : m.body,
          language: "it",
          is_read: false,
        }),
      });
      if (res.ok) saved++;
    }
    return NextResponse.json({ ok: true, fetched: mails.length, saved });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "errore" }, { status: 500 });
  }
}
