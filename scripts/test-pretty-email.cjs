/**
 * test-pretty-email.cjs — wysyła PRAWDZIWY, markowy e-mail testowy przez webhook
 * newslettera make.com (Webhook → Send an email, Content Type = HTML).
 *
 * Uruchom:  node scripts/test-pretty-email.cjs
 * (opcjonalnie inny adres:  node scripts/test-pretty-email.cjs ktos@example.com )
 *
 * To pokazuje, jak wyglądają maile z pełną szatą. Brzydki mail wcześniej był
 * tylko dlatego, że testowy payload miał minimalny HTML.
 */

const WEBHOOK = "https://hook.eu1.make.com/lqnvmsdrxchdb954pzosqh6ccwp6l8as"; // newsletter
const TO = process.argv[2] || "claudiotaras3@gmail.com";

const BRAND = {
  name: "S'Historia",
  tagline: "Ristorante · Bar · Cocktail",
  card: "#12303f",
  coral: "#E8927C",
  sky: "#5BB8D4",
  cream: "#F5EDE0",
  muted: "#9fb3c2",
  site: "https://www.shistoria.it",
};

function shell(inner) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a1822;">
  <div style="max-width:580px;margin:0 auto;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;">
    <div style="text-align:center;padding:36px 24px 20px;background:linear-gradient(180deg,#0E222F,#0a1822);">
      <img src="${BRAND.site}/logo.png" alt="S'Historia" width="120" style="display:inline-block;max-width:120px;height:auto;filter:brightness(0) invert(1);" />
      <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${BRAND.coral};margin-top:14px;">${BRAND.tagline}</div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,transparent,${BRAND.coral},${BRAND.sky},transparent);"></div>
    <div style="background:${BRAND.card};padding:34px 30px;">${inner}</div>
    <div style="text-align:center;padding:24px;background:#0a1822;color:${BRAND.muted};font-size:12px;line-height:1.7;">
      <a href="${BRAND.site}" style="color:${BRAND.sky};text-decoration:none;font-weight:600;">www.shistoria.it</a><br>
      Via Delfino · 07020 Rena Majore (OT), Sardegna<br>
      <span style="opacity:0.6;">info@shistoria.it</span>
    </div>
  </div></body></html>`;
}

const inner = `
  <div style="text-align:center;font-size:42px;margin-bottom:6px;">🍸</div>
  <h1 style="margin:0 0 10px;font-size:24px;color:${BRAND.cream};text-align:center;font-weight:800;">Ciao Claudio!</h1>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.cream};text-align:center;">
    Questa è un'email di prova con la grafica completa di S'Historia — logo, colori e pulsante.
    Se la vedi così, la formattazione HTML funziona correttamente. 🎉
  </p>
  <div style="text-align:center;margin:26px 0 8px;">
    <a href="${BRAND.site}" style="display:inline-block;background:${BRAND.coral};color:#1a1014;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:999px;">Visita il sito →</a>
  </div>
`;

const subject = "✨ Test grafica email — S'Historia";
const html = shell(inner);

(async () => {
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "newsletter_signup",
      email: TO,
      name: "Claudio",
      lang: "it",
      email_subject: subject,
      email_html: html,
      source: "shistoria.it",
      ts: new Date().toISOString(),
    }),
  });
  console.log("Status:", res.status, "→ wysłano markowy mail testowy na", TO);
  console.log("Sprawdź skrzynkę. Jeśli mail jest ładny → szata działa; brzydki = w make Content Type NIE jest HTML.");
})();
