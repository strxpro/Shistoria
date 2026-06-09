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
        if (fromEmail && fromEmail.includes("@")) {
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

// Wyciągnij czytelny tekst z surowej odpowiedzi FETCH (pomija nagłówki/HTML grubsze)
function extractBody(raw: string): string {
  // weź fragment po ostatnim literalu {n}\r\n
  const parts = raw.split(/\}\r?\n/);
  let text = parts.length > 1 ? parts[parts.length - 1] : raw;
  // utnij końcowy ") A.. OK"
  text = text.replace(/\)\s*A\d+ OK[\s\S]*$/i, "");
  // usuń tagi HTML jeśli to HTML
  if (/<[a-z][\s\S]*>/i.test(text)) text = text.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
  // dekoduj quoted-printable proste
  text = text.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
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
