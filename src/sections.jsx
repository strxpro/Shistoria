import React from 'react';
import { SplitReveal, Placeholder, TextClipReveal } from "./shell";
import AttrazioniMap from "./components/AttrazioniMap";
import { sendReservation, subscribeEventReminder } from "./lib/make-webhooks";

// Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer
const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

// ─── Eventi ───────────────────────────────────────────────────────────────────
function Eventi({ t }) {
  const [events, setEvents] = useStateE([]);
  const [activeIdx, setActiveIdx] = useStateE(0);
  const [playing, setPlaying] = useStateE(true);
  const intervalRef = useRefE(null);
  const touchRef = useRefE({ startX: 0, startY: 0 });
  const [reminderEvent, setReminderEvent] = useStateE(null);
  const [remForm, setRemForm] = useStateE({ name: "", email: "" });
  const [remSent, setRemSent] = useStateE(false);
  const evLang = (typeof window !== "undefined" && window.currentLanguage) || "it";
  const remindLabel = ({ it: "Ricordamelo", pl: "Przypomnij mi", en: "Remind me", de: "Erinnere mich", fr: "Rappelle-moi", es: "Recuérdamelo" })[evLang] || "Ricordamelo";

  useEffectE(() => {
    let ch;
    const load = async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
        const sb = createClient(url, key);
        const fetchEv = async () => {
          const { data } = await sb.from("events").select("*").eq("is_published", true).order("event_date", { ascending: true });
          if (data && data.length > 0) setEvents(data);
          else if (typeof window !== "undefined" && window.EVENTI_DATA?.length > 0) setEvents(window.EVENTI_DATA);
        };
        await fetchEv();
        // realtime — nowy/zmieniony event pojawia się na stronie BEZ odświeżania
        ch = sb.channel("events_rt").on("postgres_changes", { event: "*", schema: "public", table: "events" }, fetchEv).subscribe();
      } catch {
        if (typeof window !== "undefined" && window.EVENTI_DATA?.length > 0) setEvents(window.EVENTI_DATA);
      }
    };
    load();
    return () => { try { ch?.unsubscribe?.(); } catch {} };
  }, []);

  // Auto-przesuwanie co 4s (tylko gdy playing)
  useEffectE(() => {
    if (events.length <= 1 || !playing) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % events.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [events.length, playing]);

  const goNext = () => setActiveIdx(i => (i + 1) % events.length);
  const goPrev = () => setActiveIdx(i => (i - 1 + events.length) % events.length);

  // Swipe na mobile
  const onTouchStart = (e) => { touchRef.current.startX = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goNext(); else goPrev();
  };

  // Klik w lewą/prawą połowę karuzeli = prev/next (jak Instagram stories)
  const onCarouselClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goPrev(); else goNext();
  };

  // Pozycja karty (circular piramida)
  const getCardStyle = (i, total) => {
    let diff = i - activeIdx;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    const absDiff = Math.abs(diff);
    if (absDiff > 2) return { visible: false };
    const isCenter = diff === 0;
    const isAdj = absDiff === 1;
    const scale = isCenter ? 1 : isAdj ? 0.85 : 0.68;
    const opacity = isCenter ? 1 : isAdj ? 0.78 : 0.4;
    const baseShift = typeof window !== "undefined" && window.innerWidth < 768 ? 200 : 320;
    const x = diff * (isAdj ? baseShift : baseShift * 1.7);
    const z = isCenter ? 3 : isAdj ? 2 : 1;
    return { visible: true, scale, opacity, x, z };
  };

  if (events.length === 0) return null;

  return (
    <section className="eventi" id="eventi">
      <div className="container">
        <div className="ev-head reveal">
          <span className="kicker">— {t("eventi.eyebrow")} · 05</span>
          <SplitReveal as="h2" className="h2">{t("eventi.heading")}</SplitReveal>
          <TextClipReveal text={t("eventi.intro")} className="ev-intro" />
        </div>

        {/* Piramidowa karuzela — klik lewa/prawa = nawigacja */}
        <div className="ev-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onCarouselClick}>

          {events.map((e, i) => {
            const s = getCardStyle(i, events.length);
            if (!s.visible) return null;
            const isActive = i === activeIdx;
            return (
              <article key={e.id || i} className={`ev-card ${isActive ? "ev-card-active" : ""}`}
                style={{ "--ev-x": `${s.x}px`, "--ev-s": s.scale, "--ev-o": s.opacity, "--ev-z": s.z }}
                onClick={(ev) => {
                  if (!isActive) { ev.stopPropagation(); setActiveIdx(i); return; }
                  // aktywna karta: klik lewa/prawa połowa = prev/next (ale nie na przyciskach)
                  if (ev.target.closest("button")) return;
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const x = ev.clientX - rect.left;
                  ev.stopPropagation();
                  if (x < rect.width / 2) goPrev(); else goNext();
                }}>
                {/* Progress indicators (stories style) — tylko na aktywnej */}
                {isActive && (
                  <div className="ev-progress">
                    {events.map((_, pi) => (
                      <div key={pi} className={`ev-progress-seg ${pi === activeIdx ? "active" : pi < activeIdx ? "done" : ""}`}>
                        {pi === activeIdx && playing && <div className="ev-progress-fill" />}
                        {pi === activeIdx && !playing && <div className="ev-progress-fill" style={{ animationPlayState: "paused", width: "30%" }} />}
                      </div>
                    ))}
                  </div>
                )}
                {/* Play/Stop — w rogu AKTYWNEJ karty */}
                {isActive && (
                  <button className="ev-playstop" onClick={(ev) => { ev.stopPropagation(); setPlaying(p => !p); }} aria-label={playing ? "Pausa" : "Play"}>
                    {playing ? "❚❚" : "▶"}
                  </button>
                )}
                <div className="ev-card-bg" style={{ background: e.custom_colors?.bg || (e.phType === "food" ? "#2d1b0e" : e.phType === "sea" ? "#0e2840" : "#1a1040") }}>
                  {e.image_url && <img src={e.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.7 }} />}
                </div>
                <div className="ev-card-content">
                  <span className="ev-card-tag">{e.tag || "Evento"}</span>
                  <h4 className="ev-card-title">{e.title}</h4>
                  <span className="ev-card-date">{e.event_date || e.date || ""}</span>
                  {e.description && <p className="ev-card-desc">{e.description}</p>}
                  {isActive && (
                    <button className="ev-remind-btn" onClick={(ev) => { ev.stopPropagation(); setReminderEvent(e); }}>
                      🔔 {remindLabel}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Dots */}
        <div className="ev-dots">
          {events.map((_, i) => (
            <button key={i} className={`ev-dot ${i === activeIdx ? "active" : ""}`} onClick={() => setActiveIdx(i)} aria-label={`Evento ${i + 1}`} />
          ))}
        </div>

        {/* Arrows (desktop) */}
        <div className="ev-arrows">
          <button className="ev-arrow ev-arrow-l" onClick={goPrev} aria-label="Precedente">‹</button>
          <button className="ev-arrow ev-arrow-r" onClick={goNext} aria-label="Successivo">›</button>
        </div>

        <div className="ev-cta reveal">
          <a href="#contatti" className="btn btn-ghost">Tutti gli eventi <span className="arrow">→</span></a>
        </div>
      </div>

      {/* Modal przypomnienia o wydarzeniu */}
      {reminderEvent && (
        <div className="ev-rem-overlay" onClick={() => { setReminderEvent(null); setRemSent(false); }}>
          <div className="ev-rem-pop" onClick={(e) => e.stopPropagation()}>
            <button className="ev-rem-close" onClick={() => { setReminderEvent(null); setRemSent(false); }}>×</button>
            {remSent ? (
              <div className="ev-rem-done">
                <span className="ev-rem-done-ico">✓</span>
                <h4>{({ it: "Ti ricorderemo!", pl: "Przypomnimy Ci!", en: "We'll remind you!", de: "Wir erinnern dich!", fr: "On te le rappellera!", es: "¡Te lo recordaremos!" })[evLang]}</h4>
                <p>{({ it: "Riceverai un'email 3 giorni prima e 5 ore prima dell'evento.", pl: "Otrzymasz e-mail 3 dni przed i 5 godzin przed wydarzeniem.", en: "You'll get an email 3 days before and 5 hours before the event.", de: "Du erhältst eine E-Mail 3 Tage und 5 Stunden vor dem Event.", fr: "Tu recevras un e-mail 3 jours et 5 heures avant l'événement.", es: "Recibirás un correo 3 días y 5 horas antes del evento." })[evLang]}</p>
              </div>
            ) : (
              <>
                <span className="ev-rem-kicker">🔔 {reminderEvent.title}</span>
                <h4 className="ev-rem-title">{({ it: "Ricevi un promemoria", pl: "Otrzymaj przypomnienie", en: "Get a reminder", de: "Erhalte eine Erinnerung", fr: "Recevoir un rappel", es: "Recibe un recordatorio" })[evLang]}</h4>
                <p className="ev-rem-sub">{({ it: "Email 3 giorni prima + 5 ore prima dell'evento.", pl: "E-mail 3 dni przed + 5 godzin przed wydarzeniem.", en: "Email 3 days before + 5 hours before the event.", de: "E-Mail 3 Tage + 5 Stunden vor dem Event.", fr: "E-mail 3 jours + 5 heures avant l'événement.", es: "Correo 3 días + 5 horas antes del evento." })[evLang]}</p>
                <input className="ev-rem-input" placeholder={({ it: "Il tuo nome", pl: "Twoje imię", en: "Your name", de: "Dein Name", fr: "Ton nom", es: "Tu nombre" })[evLang]}
                  value={remForm.name} onChange={(e) => setRemForm({ ...remForm, name: e.target.value })} />
                <input className="ev-rem-input" type="email" placeholder="Email"
                  value={remForm.email} onChange={(e) => setRemForm({ ...remForm, email: e.target.value })} />
                <button className="btn ev-rem-submit" disabled={!remForm.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(remForm.email)}
                  onClick={async () => {
                    await subscribeEventReminder({
                      name: remForm.name, email: remForm.email, lang: evLang,
                      event_title: reminderEvent.title,
                      event_date: reminderEvent.event_date || reminderEvent.date || "",
                      event_description: reminderEvent.description || "",
                    });
                    setRemSent(true);
                  }}>
                  {({ it: "Avvisami", pl: "Powiadom mnie", en: "Notify me", de: "Benachrichtigen", fr: "Préviens-moi", es: "Avísame" })[evLang]} →
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <style>{`
        .eventi { background: var(--c-bg); padding: 120px 0; overflow:hidden; }
        .ev-head { max-width: 720px; margin-bottom: 64px; text-wrap:balance; }
        .ev-head .kicker { display: block; margin-bottom: 24px; }
        .ev-head .h2 { text-wrap:balance; word-break:keep-all; }
        .ev-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(18px, 2vw, 26px); line-height: 1.4; margin-top: 28px; max-width: 560px; color: var(--c-deep); }

        .ev-carousel { position:relative; display:flex; align-items:center; justify-content:center; height:min(600px, 82vh); overflow:visible; touch-action:pan-y; perspective:1000px; cursor:pointer; }
        .ev-card { position:absolute; width:min(380px, 78vw); aspect-ratio:9/16; border-radius:24px; overflow:hidden; cursor:pointer;
          transform:translateX(var(--ev-x, 0)) scale(var(--ev-s, 1)) rotateY(calc(var(--ev-x, 0) * -0.015deg)); opacity:var(--ev-o, 1); z-index:var(--ev-z, 1);
          transition:transform .65s cubic-bezier(.22,.9,.36,1), opacity .5s ease;
          box-shadow:0 20px 60px rgba(0,0,0,0.3); will-change:transform,opacity; transform-style:preserve-3d; }
        .ev-card-active { box-shadow:0 30px 80px rgba(0,0,0,0.45); }
        .ev-playstop { position:absolute; bottom:14px; right:14px; z-index:20; width:38px; height:38px; border-radius:50%; border:none;
          background:rgba(0,0,0,0.5); color:#fff; font-size:12px; cursor:pointer; display:grid; place-items:center; backdrop-filter:blur(6px);
          transition:background .2s; }
        .ev-playstop:hover { background:rgba(0,0,0,0.75); }
        .ev-remind-btn { margin-top:14px; align-self:flex-start; display:inline-flex; align-items:center; gap:6px; padding:10px 18px;
          border-radius:999px; border:1px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.12); color:#fff;
          font-family:var(--f-body); font-size:13px; font-weight:600; cursor:pointer; backdrop-filter:blur(6px); transition:all .2s; }
        .ev-remind-btn:hover { background:var(--c-coral,#E8927C); border-color:transparent; }
        .ev-rem-overlay { position:fixed; inset:0; z-index:5000; background:rgba(10,15,20,0.6); backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center; padding:24px; }
        .ev-rem-pop { position:relative; width:min(380px,92vw); background:#fff; border-radius:20px; padding:28px 24px;
          box-shadow:0 30px 80px rgba(0,0,0,0.3); display:flex; flex-direction:column; gap:12px; box-sizing:border-box; }
        .ev-rem-close { position:absolute; top:12px; right:12px; width:32px; height:32px; border-radius:50%; border:none;
          background:var(--c-bg); color:var(--c-deep); font-size:18px; cursor:pointer; }
        .ev-rem-kicker { font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:var(--c-coral,#E8927C); font-weight:700; }
        .ev-rem-title { font-family:var(--f-display); font-weight:800; font-size:22px; color:var(--c-deep); margin:0; overflow-wrap:anywhere; }
        .ev-rem-sub { font-size:13px; color:var(--c-mute); line-height:1.4; margin:0 0 6px; }
        .ev-rem-input { width:100%; box-sizing:border-box; padding:12px 14px; border-radius:12px; border:1px solid var(--c-line);
          background:var(--c-bg); color:var(--c-deep); font-size:14px; font-family:inherit; outline:none; }
        .ev-rem-input:focus { border-color:var(--c-coral,#E8927C); }
        .ev-rem-submit { margin-top:6px; width:100%; justify-content:center; }
        .ev-rem-submit:disabled { opacity:0.45; cursor:not-allowed; }
        .ev-rem-done { display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; padding:12px 0; }
        .ev-rem-done-ico { width:54px; height:54px; border-radius:50%; background:rgba(39,174,96,0.15); color:#27ae60; font-size:26px; display:grid; place-items:center; }
        .ev-rem-done h4 { font-family:var(--f-display); font-weight:800; font-size:22px; color:var(--c-deep); margin:0; }
        .ev-rem-done p { font-size:13px; color:var(--c-mute); line-height:1.5; margin:0; }
        .ev-card:hover { box-shadow:0 30px 80px rgba(0,0,0,0.4); }

        /* Progress indicators (Framer ReelCarousel style) */
        .ev-progress { position:absolute; top:14px; left:16px; right:16px; z-index:10; display:flex; gap:4px; }
        .ev-progress-seg { flex:1; height:3px; border-radius:2px; background:rgba(255,255,255,0.3); overflow:hidden; }
        .ev-progress-seg.done { background:rgba(255,255,255,0.8); }
        .ev-progress-fill { height:100%; background:#fff; border-radius:2px; animation:evProgressFill 4s linear forwards; }
        @keyframes evProgressFill { from { width:0; } to { width:100%; } }
        .ev-card-bg { position:absolute; inset:0; }
        .ev-card-bg img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .ev-card-content { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; padding:28px; color:#fff;
          background:linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.75) 100%); }
        .ev-card-tag { font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--c-coral,#E8927C); margin-bottom:8px; font-weight:700; }
        .ev-card-title { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(18px, 4vw, 24px); line-height:1.15; margin:0 0 6px; }
        .ev-card-date { font-size:13px; opacity:0.7; font-weight:600; }
        .ev-card-desc { font-size:12px; opacity:0.65; margin-top:8px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

        .ev-dots { display:flex; justify-content:center; gap:8px; margin-top:28px; }
        .ev-dot { width:8px; height:8px; border-radius:50%; background:rgba(14,34,48,0.2); border:none; cursor:pointer; transition:all .3s; padding:0; }
        .ev-dot.active { background:var(--c-coral,#E8927C); transform:scale(1.4); }

        .ev-arrows { display:flex; justify-content:center; gap:16px; margin-top:16px; }
        .ev-arrow { width:40px; height:40px; border-radius:50%; border:1px solid var(--c-line,rgba(14,34,48,0.15)); background:transparent; color:var(--c-deep);
          font-size:22px; cursor:pointer; display:grid; place-items:center; transition:all .25s; }
        .ev-arrow:hover { background:var(--c-deep); color:#fff; border-color:var(--c-deep); }

        .ev-cta { margin-top: 56px; text-align: center; }

        @media (max-width:768px) {
          .ev-carousel { height:min(560px, 80vh); }
          .ev-card { width:min(300px, 80vw); }
          .ev-arrows { display:none; }
        }
      `}</style>
    </section>
  );
}

function EventCard({ item, index }) {
  const [hover, setHover] = useStateE(false);
  // varying heights for masonry feel
  const h = [380, 460, 320, 420, 380, 440][index % 6];
  return (
    <article className="event-card reveal" style={{ height: h, animationDelay: `${index * 0.08}s` }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Placeholder type={item.phType} label={`EVENT · ${item.date}`} style={{ width: "100%", height: "100%", transform: hover ? "scale(1.05)" : "scale(1)", transition: "transform 0.8s var(--ease-out)" }} />
      <div className="event-card-tag">
        <span className="chip" style={{ background: "rgba(255,255,255,0.95)", color: "var(--c-deep)" }}>{item.tag}</span>
      </div>
      <div className="event-card-bottom">
        <div className="event-card-date">{item.date}</div>
        <h4 className="event-card-title">{item.title}</h4>
      </div>
      <div className="event-card-overlay" style={{ opacity: hover ? 1 : 0 }}>
        <span className="event-card-cta">Scopri di più →</span>
      </div>
      <style>{`
        .event-card { position: relative; border-radius: 20px; overflow: hidden; cursor: pointer; }
        .event-card-tag { position: absolute; top: 16px; left: 16px; z-index: 2; }
        .event-card-bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 24px; background: linear-gradient(180deg, transparent 0%, rgba(10,29,42,0.85) 100%); color: #fff; }
        .event-card-date { font-family: var(--f-display); font-weight: 800; font-size: 14px; letter-spacing: 0.1em; color: var(--c-coral); }
        .event-card-title { font-family: var(--f-display); font-weight: 700; font-size: 22px; margin-top: 4px; letter-spacing: -0.01em; line-height: 1.1; }
        .event-card-overlay { position: absolute; inset: 0; background: linear-gradient(140deg, rgba(91,184,212,0.7) 0%, rgba(26,61,82,0.85) 100%); display: flex; align-items: center; justify-content: center; transition: opacity 0.4s; }
        .event-card-cta { color: #fff; font-family: var(--f-display); font-weight: 700; font-size: 24px; letter-spacing: -0.01em; }
      `}</style>
    </article>
  );
}

// ─── Social Feed ──────────────────────────────────────────────────────────────
function SocialFeed({ t }) {
  return (
    <section className="social" id="social">
      <div className="container">
        <div className="social-head reveal">
          <span className="kicker">— {t("social.eyebrow")} · 06</span>
          <SplitReveal as="h2" className="h2">{t("social.heading")}</SplitReveal>
        </div>

        <div className="social-grid">
          <div className="social-col">
            <div className="social-col-head">
              <div className="social-icon">⌖</div>
              <div>
                <h4 className="social-handle">@shistoria.renamajore</h4>
                <span className="kicker">{t("social.instagram")}</span>
              </div>
              <a href="#" className="social-link">→</a>
            </div>
            <div className="social-ig-grid">
              {[
                { type: "food", l: "Carbonara di mare" },
                { type: "sea", l: "Tramonto · ieri" },
                { type: "food", l: "Pasta del giorno" },
                { type: "rock", l: "Sala domenica" },
                { type: "food", l: "Aperitivo · 18h" },
                { type: "sea", l: "Calma del mattino" },
                { type: "rock", l: "Lavagna del giorno" },
                { type: "food", l: "Dolce di nonna" },
                { type: "sea", l: "Vista di sempre" },
              ].map((p, i) => (
                <div key={i} className="social-ig-cell">
                  <Placeholder type={p.type} label={p.l} style={{ width: "100%", height: "100%" }} />
                  <div className="social-ig-overlay">
                    <span>♥ {Math.floor(80 + Math.random() * 400)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="social-col">
            <div className="social-col-head">
              <div className="social-icon">f</div>
              <div>
                <h4 className="social-handle">S'Historia Rena Majore</h4>
                <span className="kicker">{t("social.facebook")}</span>
              </div>
              <a href="#" className="social-link">→</a>
            </div>
            <div className="social-fb-list">
              {[
                { d: "ieri", t: "Aperitivo al tramonto", body: "Stasera musica acustica dalle 19:30. Vi aspettiamo con calici di Vermentino freddo e tagliere di pecorino." },
                { d: "3 giorni fa", t: "Nuovo menu d'estate", body: "Da oggi nuova carta estiva: pesce crudo, fregula con vongole, gelato al mirto. Venite a provarla!" },
                { d: "1 settimana fa", t: "Riservato il chef's table per chi vuole", body: "Otto coperti, otto portate. Lo chef cucina davanti a voi. Prenotate prima del weekend." },
              ].map((p, i) => (
                <article key={i} className="social-fb-card">
                  <div className="social-fb-meta">
                    <span className="social-fb-avatar">S'H</span>
                    <div>
                      <strong>S'Historia</strong>
                      <span className="kicker" style={{ display: "block", marginTop: 2 }}>{p.d}</span>
                    </div>
                  </div>
                  <h5 className="social-fb-title">{p.t}</h5>
                  <p className="social-fb-body">{p.body}</p>
                  <a href="#" className="social-fb-cta">Leggi su Facebook →</a>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .social { background: linear-gradient(180deg, #FFFFFF 0%, #EBF6FA 100%); padding: 120px 0; }
        .social-head { max-width: 720px; margin-bottom: 64px; }
        .social-head .kicker { display: block; margin-bottom: 24px; }
        .social-grid { display: grid; grid-template-columns: 1fr; gap: 48px; }
        @media (min-width: 1024px) { .social-grid { grid-template-columns: 1.4fr 1fr; gap: 64px; } }
        .social-col-head { display: flex; align-items: center; gap: 16px; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--c-line); }
        .social-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--c-deep); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--f-display); font-weight: 800; font-size: 20px; }
        .social-handle { font-family: var(--f-display); font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
        .social-link { margin-left: auto; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--c-line); display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
        .social-link:hover { background: var(--c-deep); color: #fff; border-color: var(--c-deep); }
        .social-ig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .social-ig-cell { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; cursor: pointer; }
        .social-ig-overlay { position: absolute; inset: 0; background: rgba(26,61,82,0.6); color: #fff; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; font-family: var(--f-display); font-weight: 700; }
        .social-ig-cell:hover .social-ig-overlay { opacity: 1; }
        .social-fb-list { display: flex; flex-direction: column; gap: 16px; }
        .social-fb-card { background: #fff; padding: 20px; border-radius: 14px; border: 1px solid var(--c-line); }
        .social-fb-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .social-fb-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--c-sky); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--f-display); font-weight: 800; font-size: 12px; }
        .social-fb-title { font-family: var(--f-display); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
        .social-fb-body { font-size: 14px; color: var(--c-mute); margin-top: 8px; line-height: 1.5; }
        .social-fb-cta { display: inline-block; margin-top: 12px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-sky); font-weight: 500; }
      `}</style>
    </section>
  );
}

// ─── Attrazioni ───────────────────────────────────────────────────────────────
function Attrazioni({ t }) {
  const places = (typeof window !== "undefined" && window.ATTRAZIONI_DATA) || [];
  const [selected, setSelected] = useStateE(0);
  const cats = [
    { id: "all", label: "Tutto" },
    { id: "Spiagge", label: "🏖 Spiagge" },
    { id: "Natura", label: "🌿 Natura" },
    { id: "Cultura", label: "🏛 Cultura" },
    { id: "Escursioni", label: "🛥 Escursioni" },
  ];
  const [cat, setCat] = useStateE("all");
  const filtered = cat === "all" ? places : places.filter((p) => p.category === cat);
  const listRef = useRefE(null);

  // Mobile: gdy scrollujesz listę, automatycznie zaznacz na mapie kartę najbliżej krawędzi pod mapą.
  useEffectE(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const onScroll = () => {
      const cards = listRef.current ? listRef.current.querySelectorAll("[data-atr-idx]") : [];
      const vh = window.innerHeight;
      // mapa zajmuje górę ekranu (~64px + ~50vh); karty oceniamy względem punktu tuż pod mapą
      const trigger = vh * 0.66;
      let best = null, bestDist = Infinity;
      cards.forEach((el) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top - trigger);
        if (r.bottom > trigger - 60 && r.top < vh && dist < bestDist) { bestDist = dist; best = parseInt(el.dataset.atrIdx); }
      });
      if (best !== null && !Number.isNaN(best)) setSelected(best);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [filtered.length]);

  return (
    <section className="attrazioni" id="attrazioni">
      <div className="container">
        <div className="atr-head reveal">
          <span className="kicker">— {t("attrazioni.eyebrow")} · 07</span>
          <SplitReveal as="h2" className="h2">{t("attrazioni.heading")}</SplitReveal>
          <TextClipReveal text={t("attrazioni.intro")} className="atr-intro" />
        </div>

        <div className="atr-cats reveal">
          {cats.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`atr-cat ${cat === c.id ? "active" : ""}`}>{c.label}</button>
          ))}
        </div>

        <div className="atr-split">
          {/* Map — prawdziwa mapa Leaflet/OpenStreetMap z pinezkami w kolorystyce strony */}
          <div className="atr-map">
            <div className="atr-map-bg">
              <AttrazioniMap places={places} selected={selected} onSelect={setSelected} />
              <div className="atr-map-label">Sardegna · Costa Nord</div>
            </div>
          </div>

          {/* List */}
          <div className="atr-list" ref={listRef}>
            {filtered.map((p, i) => {
              const realIdx = places.indexOf(p);
              return (
                <button
                  key={realIdx}
                  data-atr-idx={realIdx}
                  className={`atr-card ${selected === realIdx ? "active" : ""}`}
                  onClick={() => setSelected(realIdx)}
                >
                  <span className="atr-card-icon">{p.icon}</span>
                  <div className="atr-card-body">
                    <div className="atr-card-line">
                      <h5 className="atr-card-name">{p.name}</h5>
                      <span className="atr-card-dist">{p.dist}</span>
                    </div>
                    <p className="atr-card-desc">{p.desc}</p>
                    <span className="atr-card-cat">— {p.category}</span>
                  </div>
                </button>
              );
            })}
            <a href="https://www.google.com/maps/place/Via+Delfino,+07020+Rena+Majore+OT,+Italia" target="_blank" rel="noopener" className="btn atr-directions">
              ◎ {t("attrazioni.directions")} <span className="arrow">→</span>
            </a>
          </div>
        </div>
      </div>
      <style>{`
        .attrazioni { background: var(--c-bg); padding: 120px 0; }
        .atr-head { max-width: 720px; margin-bottom: 48px; }
        .atr-head .kicker { display: block; margin-bottom: 24px; }
        .atr-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(20px, 2vw, 28px); line-height: 1.4; margin-top: 32px; max-width: 600px; }
        .atr-cats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 1px solid var(--c-line); }
        .atr-cat { padding: 10px 18px; border-radius: 999px; font-size: 12px; letter-spacing: 0.1em; font-weight: 500; border: 1px solid var(--c-line); color: var(--c-deep); transition: all 0.3s; }
        .atr-cat:hover { border-color: var(--c-deep); }
        .atr-cat.active { background: var(--c-deep); color: #fff; border-color: var(--c-deep); }
        .atr-split { display: grid; grid-template-columns: 1fr; gap: 32px; }
        @media (min-width: 1024px) { .atr-split { grid-template-columns: 1.2fr 1fr; gap: 48px; align-items: start; } }
        .atr-map { position: sticky; top: 100px; }
        /* Mobile: mapa przyklejona na górze (z tłem), kategorie i lista przewijają się POD nią */
        @media (max-width: 1023px) {
          .atr-cats { position: relative; z-index: 1; margin-bottom: 16px; padding-bottom: 16px; }
          .atr-map { position: sticky; top: 60px; z-index: 10; margin-bottom: 16px; padding: 8px 0 12px; background: var(--c-bg); }
          .atr-map-bg { aspect-ratio: 16/10; box-shadow: 0 16px 40px rgba(26,61,82,0.18); background: #D8ECF3; }
          /* lista pod mapą; ostatni element (przycisk dojazdu) ma zapas, by nie chował się pod mapę */
          .atr-list { position: relative; z-index: 4; }
          .atr-directions { position: relative; z-index: 11; margin-top: 24px; align-self: center; }
        }
        .atr-map-bg { position: relative; aspect-ratio: 4/3; border-radius: 20px; overflow: hidden; background: #D8ECF3; box-shadow: 0 24px 80px rgba(26,61,82,0.12); }
        /* Leaflet map */
        .atr-leaf { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; background: #D8ECF3; }
        .atr-leaf .leaflet-control-attribution { display: none !important; }
        .atr-leaf-pin-wrap { background: none !important; border: none !important; }
        .atr-leaf-pin { position: relative; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--pin-bg, #5BB8D4); border: 2px solid #fff; box-shadow: 0 4px 14px rgba(26,61,82,0.4); display: flex; align-items: center; justify-content: center; transition: transform .25s; }
        .atr-leaf-pin span { transform: rotate(45deg); color: #fff; font-family: var(--f-display); font-weight: 800; font-size: 12px; }
        .atr-leaf-pin.is-active { box-shadow: 0 6px 22px rgba(232,146,124,0.6); animation: atrPinPop .4s cubic-bezier(.2,1.3,.4,1); }
        @keyframes atrPinPop { from { transform: rotate(-45deg) scale(0.6); } to { transform: rotate(-45deg) scale(1); } }
        .atr-leaf-tip { background: var(--c-deep, #1A3D52); color: #fff; border: none; border-radius: 8px; font-family: var(--f-body); font-size: 11px; font-weight: 600; padding: 4px 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
        .atr-leaf-tip::before { border-top-color: var(--c-deep, #1A3D52); }
        /* Etykieta dystansu na środku przerywanej linii */
        .atr-leaf-dist-wrap { background: none !important; border: none !important; }
        .atr-leaf-dist { display: inline-block; background: var(--c-coral, #E8927C); color: #fff; font-family: var(--f-display, "Syne", sans-serif); font-weight: 800; font-size: 11px; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; box-shadow: 0 4px 14px rgba(232,146,124,0.5); white-space: nowrap; text-align: center; }
        .atr-map-svg { width: 100%; height: 100%; display: block; }
        .atr-pin { position: absolute; transform: translate(-50%, -100%); width: 32px; height: 32px; border-radius: 50%; background: var(--c-sky); color: #fff; font-family: var(--f-display); font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(26,61,82,0.3); transition: all 0.3s; border: 2px solid #fff; }
        .atr-pin:hover, .atr-pin.active { background: var(--c-coral); transform: translate(-50%, -100%) scale(1.2); z-index: 2; }
        .atr-pin.home { background: var(--c-deep); width: 40px; height: 40px; font-size: 14px; }
        .atr-pin-pulse { position: absolute; inset: -10px; border-radius: 50%; border: 2px solid var(--c-coral); animation: pulse 1.5s ease-out infinite; }
        @keyframes pulse { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
        .atr-map-label { position: absolute; left: 16px; bottom: 16px; z-index: 2; padding: 8px 14px; background: rgba(255,255,255,0.92); border-radius: 999px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-deep); font-weight: 500; pointer-events: none; }
        .atr-map-credit { position: absolute; right: 16px; bottom: 16px; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(26,61,82,0.5); }
        .atr-list { display: flex; flex-direction: column; gap: 12px; }
        .atr-card { display: flex; gap: 16px; align-items: flex-start; padding: 20px; background: #fff; border: 1px solid var(--c-line); border-radius: 16px; text-align: left; transition: all 0.3s; cursor: pointer; }
        .atr-card:hover, .atr-card.active { border-color: var(--c-sky); background: var(--c-sand); }
        .atr-card-icon { font-size: 28px; flex-shrink: 0; }
        .atr-card-body { flex: 1; }
        .atr-card-line { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
        .atr-card-name { font-family: var(--f-display); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
        .atr-card-dist { font-family: var(--f-serif); font-style: italic; color: var(--c-sky); font-size: 14px; flex-shrink: 0; }
        .atr-card-desc { font-size: 13px; color: var(--c-mute); margin-top: 4px; line-height: 1.5; }
        .atr-card-cat { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-coral); margin-top: 6px; display: block; }
        .atr-directions { margin-top: 16px; align-self: flex-start; }
      `}</style>
    </section>
  );
}

// ─── Recensioni ───────────────────────────────────────────────────────────────
function Recensioni({ t }) {
  const staticData = (typeof window !== "undefined" && window.RECENSIONI_DATA) || [];
  const [dbReviews, setDbReviews] = useStateE([]);
  const [filter, setFilter] = useStateE("all");
  const [writeOpen, setWriteOpen] = useStateE(false);
  const [writeTab, setWriteTab] = useStateE("local"); // "local" | "google"
  const [reviewForm, setReviewForm] = useStateE({ name: "", email: "", text: "" });
  const [reviewSent, setReviewSent] = useStateE(false);
  const sources = ["all", "Google", "TripAdvisor", "Locale"];

  // Wczytaj zatwierdzone recenzje z DB (dodane przez gości, zatwierdzone w adminie) + realtime
  useEffectE(() => {
    let ch;
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
        const sb = createClient(url, key);
        const fetchR = async () => {
          const { data } = await sb.from("reviews").select("*").eq("is_approved", true).order("created_at", { ascending: false });
          if (data) setDbReviews(data.map((r) => ({ name: r.name, text: r.content, source: r.source || "Locale", stars: r.stars || 5 })));
        };
        await fetchR();
        ch = sb.channel("reviews_rt").on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, fetchR).subscribe();
      } catch { /* ignore — fallback statyczne */ }
    })();
    return () => { try { ch?.unsubscribe?.(); } catch {} };
  }, []);

  const data = dbReviews.length > 0 ? [...dbReviews, ...staticData] : staticData;
  const filtered = filter === "all" ? data : data.filter((r) => r.source === filter);
  const stream = filtered.concat(filtered);

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.name || !reviewForm.text) return;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
      const sb = createClient(url, key);
      await sb.from("reviews").insert({
        name: reviewForm.name,
        email: reviewForm.email || null,
        content: reviewForm.text,
        source: "Locale",
        stars: 5,
        language: (typeof window !== "undefined" && window.currentLanguage) || "it",
      });
    } catch (err) { console.error("Review submit error:", err); }
    setReviewSent(true);
  };

  return (
    <section className="recensioni" id="recensioni">
      <div className="container">
        <div className="rec-head reveal">
          <span className="kicker">— {t("recensioni.eyebrow")} · 08</span>
          <SplitReveal as="h2" className="h2">{t("recensioni.heading")}</SplitReveal>
          <div className="rec-stats">
            <div><span>4.9</span><label>★ Google</label></div>
            <div><span>5.0</span><label>★ TripAdvisor</label></div>
            <div><span>340+</span><label>recensioni</label></div>
          </div>
        </div>

        <div className="rec-filters reveal">
          {sources.map((s) => (
            <button key={s} className={`rec-filter ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
              {s === "all" ? "Tutte" : s}
            </button>
          ))}
          <button className="rec-filter rec-write-btn" onClick={() => setWriteOpen(true)}>
            ✎ Scrivi messaggio
          </button>
        </div>
      </div>

      <div className="rec-marquee">
        <div className="rec-track">
          {stream.map((r, i) => (
            <article key={i} className="rec-card">
              <div className="rec-stars">{"★".repeat(r.stars)}<span style={{ color: "var(--c-line)" }}>{"★".repeat(5 - r.stars)}</span></div>
              <blockquote className="rec-text">"{r.text}"</blockquote>
              <div className="rec-meta">
                <span className="rec-name">{r.name}</span>
                <span className="rec-source">{r.source}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Popout — scrivi messaggio (2 zakładki: Locale / Google) */}
      {writeOpen && (
        <div className="rec-write-overlay" onClick={() => setWriteOpen(false)}>
          <div className="rec-write-popout" onClick={(e) => e.stopPropagation()}>
            <button className="rec-write-close" onClick={() => setWriteOpen(false)}>×</button>
            <div className="rec-write-tabs">
              <button className={writeTab === "local" ? "active" : ""} onClick={() => setWriteTab("local")}>✎ Locale</button>
              <button className={writeTab === "google" ? "active" : ""} onClick={() => setWriteTab("google")}>⭐ Google</button>
            </div>
            {writeTab === "google" ? (
              <div className="rec-write-google">
                <p>Lascia una recensione su Google — ci aiuta tantissimo!</p>
                <a href="https://g.page/r/CVK_gqHsp7TMEAE/review" target="_blank" rel="noopener" className="btn rec-google-btn">
                  Scrivi su Google ★ →
                </a>
              </div>
            ) : reviewSent ? (
              <div className="rec-write-success">
                <span>🎉</span>
                <h4>Grazie per il tuo messaggio!</h4>
                <p>Sarà visibile dopo approvazione.</p>
              </div>
            ) : (
              <form className="rec-write-form" onSubmit={submitReview}>
                <input placeholder="Il tuo nome *" value={reviewForm.name} onChange={(e) => setReviewForm(f => ({...f, name: e.target.value}))} required />
                <input type="email" placeholder="Email (facoltativa)" value={reviewForm.email} onChange={(e) => setReviewForm(f => ({...f, email: e.target.value}))} />
                <textarea placeholder="La tua esperienza..." rows={4} value={reviewForm.text} onChange={(e) => setReviewForm(f => ({...f, text: e.target.value}))} required />
                <button type="submit" className="btn rec-submit-btn">Invia →</button>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        .recensioni { background: linear-gradient(180deg, #EBF6FA 0%, #FFFFFF 100%); padding: 120px 0; overflow: hidden; }
        .rec-head { max-width: 720px; margin-bottom: 48px; }
        .rec-head .kicker { display: block; margin-bottom: 24px; }
        .rec-stats { display: flex; gap: 48px; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--c-line); flex-wrap: wrap; }
        .rec-stats div { display: flex; flex-direction: column; }
        .rec-stats span { font-family: var(--f-display); font-weight: 800; font-size: 40px; line-height: 1; color: var(--c-sky); letter-spacing: -0.03em; }
        .rec-stats label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-mute); margin-top: 4px; }
        .rec-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 64px; align-items:center; }
        .rec-filter { padding: 8px 16px; border-radius: 999px; font-size: 12px; letter-spacing: 0.1em; font-weight: 500; border: 1px solid var(--c-line); color: var(--c-deep); cursor:pointer; transition:all .25s; background:transparent; }
        .rec-filter.active { background: var(--c-deep); color: #fff; border-color: var(--c-deep); }
        .rec-write-btn { background:var(--c-coral); color:#fff; border-color:var(--c-coral); margin-left:auto; }
        .rec-write-btn:hover { background:#d9745c; }
        .rec-marquee { overflow: hidden; position: relative; }
        .rec-marquee::before, .rec-marquee::after { content: ''; position: absolute; top: 0; bottom: 0; width: 120px; z-index: 2; pointer-events: none; }
        .rec-marquee::before { left: 0; background: linear-gradient(90deg, #EBF6FA 0%, transparent 100%); }
        .rec-marquee::after { right: 0; background: linear-gradient(-90deg, #EBF6FA 0%, transparent 100%); }
        .rec-track { display: flex; gap: 24px; animation: marquee 90s linear infinite; padding: 24px 0; width: max-content; }
        .rec-track:hover { animation-play-state: paused; }
        .rec-card { flex: 0 0 380px; background: #fff; border: 1px solid var(--c-line); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; gap: 16px; }
        .rec-stars { color: var(--c-coral); font-size: 16px; letter-spacing: 4px; }
        .rec-text { font-family: var(--f-serif); font-style: italic; font-size: 18px; line-height: 1.5; color: var(--c-deep); }
        .rec-meta { display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--c-line); }
        .rec-name { font-family: var(--f-display); font-weight: 700; font-size: 14px; }
        .rec-source { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-sky); }
        .rec-write-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:24px; }
        .rec-write-popout { width:min(480px,92vw); max-height:85vh; overflow-y:auto; background:#fff; border-radius:24px; padding:32px; position:relative; color:var(--c-deep); }
        .rec-write-close { position:absolute; top:16px; right:16px; width:32px; height:32px; border-radius:50%; border:1px solid var(--c-line); background:transparent; font-size:18px; cursor:pointer; display:grid; place-items:center; }
        .rec-write-tabs { display:flex; gap:8px; margin-bottom:24px; }
        .rec-write-tabs button { flex:1; padding:12px; border-radius:12px; border:1px solid var(--c-line); background:transparent; font-weight:600; font-size:13px; cursor:pointer; transition:all .2s; }
        .rec-write-tabs button.active { background:var(--c-deep); color:#fff; border-color:var(--c-deep); }
        .rec-write-form { display:flex; flex-direction:column; gap:14px; }
        .rec-write-form input, .rec-write-form textarea { padding:12px 16px; border-radius:12px; border:1px solid var(--c-line); font-size:14px; font-family:inherit; resize:vertical; }
        .rec-submit-btn { background:var(--c-coral); color:#fff; align-self:flex-start; }
        .rec-write-google { text-align:center; padding:32px 0; }
        .rec-write-google p { margin-bottom:20px; opacity:0.7; font-size:15px; }
        .rec-google-btn { background:var(--c-deep); color:#fff; }
        .rec-write-success { text-align:center; padding:32px; }
        .rec-write-success span { font-size:40px; display:block; margin-bottom:12px; }
        .rec-write-success h4 { font-size:20px; margin:0 0 8px; }
        @media (max-width:768px) { .rec-card { flex:0 0 300px; padding:24px; } .rec-text { font-size:15px; } }
      `}</style>
    </section>
  );
}

// ─── Custom Time Picker (stylizowany pod stronę) ──────────────────────────────
function CustomTimePicker({ value, onChange, slots, lang }) {
  const [open, setOpen] = useStateE(false);
  const wrapRef = useRefE(null);
  useEffectE(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const PLACEHOLDER = { it: "Seleziona ora", pl: "Wybierz godzinę", en: "Select time", de: "Uhrzeit wählen", fr: "Choisir l'heure", es: "Elegir hora" }[lang || "it"];
  // Grupy: pranzo / cena dla czytelności
  const lunch = slots.filter((s) => parseInt(s) < 17);
  const dinner = slots.filter((s) => parseInt(s) >= 17);
  const GROUP = { lunch: { it:"Pranzo",pl:"Obiad",en:"Lunch",de:"Mittag",fr:"Déjeuner",es:"Almuerzo" }, dinner: { it:"Cena",pl:"Kolacja",en:"Dinner",de:"Abend",fr:"Dîner",es:"Cena" } };
  const g = (k) => GROUP[k][lang || "it"];
  return (
    <div className="cdp" ref={wrapRef}>
      <button type="button" className={`cdp-trigger ${value ? "has-val" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span>{value || PLACEHOLDER}</span>
        <span className="cdp-cal-ico">🕐</span>
      </button>
      {open && (
        <div className="cdp-pop ctp-pop">
          <div className="ctp-group-label">🍝 {g("lunch")}</div>
          <div className="ctp-grid">
            {lunch.map((s) => (
              <button type="button" key={s} className={`ctp-slot ${value === s ? "sel" : ""}`} onClick={() => { onChange(s); setOpen(false); }}>{s}</button>
            ))}
          </div>
          <div className="ctp-group-label">🌙 {g("dinner")}</div>
          <div className="ctp-grid">
            {dinner.map((s) => (
              <button type="button" key={s} className={`ctp-slot ${value === s ? "sel" : ""}`} onClick={() => { onChange(s); setOpen(false); }}>{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Date Picker (stylizowany pod stronę, wielojęzyczny) ───────────────
function CustomDatePicker({ value, onChange, lang, closedDates = [] }) {
  const [open, setOpen] = useStateE(false);
  const [view, setView] = useStateE(() => { const d = value ? new Date(value) : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const wrapRef = useRefE(null);

  useEffectE(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const L = lang || "it";
  const MONTHS = {
    it: ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"],
    pl: ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"],
    en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    de: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
    fr: ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
    es: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  };
  const DOW = {
    it: ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"], pl: ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"],
    en: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], de: ["Mo","Di","Mi","Do","Fr","Sa","So"],
    fr: ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"], es: ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"],
  };
  const months = MONTHS[L] || MONTHS.it;
  const dow = DOW[L] || DOW.it;
  const PLACEHOLDER = { it: "Seleziona data", pl: "Wybierz datę", en: "Select date", de: "Datum wählen", fr: "Choisir une date", es: "Elegir fecha" }[L];

  const firstDay = new Date(view.y, view.m, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // poniedziałek = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const selectedStr = value || "";

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (d) => {
    const mm = String(view.m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${view.y}-${mm}-${dd}`);
    setOpen(false);
  };
  const fmt = (s) => { if (!s) return PLACEHOLDER; const [y,m,d] = s.split("-"); return `${d}.${m}.${y}`; };
  const prevMonth = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const nextMonth = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });

  return (
    <div className="cdp" ref={wrapRef}>
      <button type="button" className={`cdp-trigger ${value ? "has-val" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span>{fmt(value)}</span>
        <span className="cdp-cal-ico">📅</span>
      </button>
      {open && (
        <div className="cdp-pop">
          <div className="cdp-head">
            <button type="button" className="cdp-nav" onClick={prevMonth}>‹</button>
            <span className="cdp-month">{months[view.m]} {view.y}</span>
            <button type="button" className="cdp-nav" onClick={nextMonth}>›</button>
          </div>
          <div className="cdp-dow">{dow.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cdp-grid">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} className="cdp-empty" />;
              const ds = `${view.y}-${String(view.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
              const cellDate = new Date(view.y, view.m, d);
              const isPast = cellDate < today;
              const isSel = ds === selectedStr;
              const isTue = cellDate.getDay() === 2; // wtorek zamknięte
              const isClosedDate = closedDates.includes(ds); // chiusura straordinaria
              const blocked = isPast || isTue || isClosedDate;
              return (
                <button type="button" key={i} disabled={blocked}
                  className={`cdp-day ${isSel ? "sel" : ""} ${isPast ? "past" : ""} ${(isTue || isClosedDate) ? "closed" : ""}`}
                  onClick={() => pick(d)} title={isClosedDate ? "Chiuso (chiusura straordinaria)" : isTue ? "Martedì · chiuso" : ""}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contatti ─────────────────────────────────────────────────────────────────
function Contatti({ t }) {
  const [form, setForm] = useStateE({ firstName: "", lastName: "", email: "", phone: "", date: "", time: "", people: 2, message: "" });
  const [submitted, setSubmitted] = useStateE(false);
  const [sending, setSending] = useStateE(false);
  const [errors, setErrors] = useStateE({});

  // Godziny do wyboru (wg godzin otwarcia restauracji)
  const TIME_SLOTS = ["12:00","12:30","13:00","13:30","14:00","14:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00"];

  // Godziny otwarcia z DB (edytowalne z admina, zmiana NA ŻYWO)
  const [hours, setHours] = useStateE([
    { day: "Lun — Dom", time: "12:00 — 14:30 · 19:00 — 23:00", closed: false },
    { day: "Martedì", time: "chiuso", closed: true },
  ]);
  const [slots, setSlots] = useStateE(TIME_SLOTS);
  const [closedDates, setClosedDates] = useStateE([]); // chiusure straordinarie z admina
  useEffectE(() => {
    let ch;
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
        const sb = createClient(url, key);
        const apply = (d) => { if (d?.hours?.length) setHours(d.hours); if (d?.time_slots?.length) setSlots(d.time_slots); setClosedDates(d?.closed_dates || []); };
        const { data } = await sb.from("opening_hours").select("*").eq("id", 1).single();
        apply(data);
        ch = sb.channel("opening_hours_rt").on("postgres_changes", { event: "*", schema: "public", table: "opening_hours" }, (p) => apply(p.new)).subscribe();
      } catch { /* ignore — fallback domyślne godziny */ }
    })();
    return () => { try { ch?.unsubscribe?.(); } catch {} };
  }, []);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.firstName) err.firstName = true;
    if (!form.lastName) err.lastName = true;
    if (!form.email || !form.email.includes("@")) err.email = true;
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    setSending(true);
    const lang = (typeof window !== "undefined" && window.currentLanguage) || "it";
    const fullName = `${form.firstName} ${form.lastName}`.trim();

    // Zapisz do Supabase
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
      const sb = createClient(url, key);
      await sb.from("contact_messages").insert({
        name: fullName,
        email: form.email,
        phone: form.phone || null,
        date: form.date || null,
        people: form.people,
        message: [form.time ? `Ora: ${form.time}` : "", form.message].filter(Boolean).join(" · ") || null,
        language: lang, // auto-wykryty język klienta
      });
    } catch (err2) { console.error("Contact save error:", err2); }

    // make.com webhook (e-mail właściciel po IT + klient w jego języku + WhatsApp)
    try {
      const { sendReservation } = await import("./lib/make-webhooks");
      await sendReservation({ name: fullName, firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, date: form.date, time: form.time, people: form.people, message: form.message, lang });
    } catch (err3) { console.error("Make webhook error:", err3); }

    // WhatsApp callmebot (fallback bezpośredni, jeśli skonfigurowany window.__CALLMEBOT)
    const cmb = typeof window !== "undefined" && window.__CALLMEBOT;
    if (cmb && cmb.phone && cmb.apikey) {
      try {
        const msg = encodeURIComponent(`Nuova prenotazione S'Historia:\n${fullName} (${lang})\n${form.email} ${form.phone}\n${form.people} pers. ${form.date} ${form.time}\n${form.message || ""}`);
        await fetch(`https://api.callmebot.com/whatsapp.php?phone=${cmb.phone}&text=${msg}&apikey=${cmb.apikey}`, { mode: "no-cors" });
      } catch (err4) { console.error("WhatsApp error:", err4); }
    }

    // Krótka animacja "wypełnienia" przycisku przed pokazaniem toast
    await new Promise((r) => setTimeout(r, 700));
    try { const a = await import("./lib/analytics"); a.trackConversion(); } catch {}
    setSending(false);
    setSubmitted(true);
  };

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "", date: "", time: "", people: 2, message: "" });
    setSubmitted(false);
    setErrors({});
  };

  return (
    <section className="contatti" id="contatti">
      <div className="container">
        <div className="cnt-head reveal">
          <span className="kicker" style={{ color: "var(--c-coral)" }}>— {t("contatti.eyebrow")} · 09</span>
          <SplitReveal as="h2" className="h2" invert>{t("contatti.heading")}</SplitReveal>
        </div>

        <div className="cnt-split">
          {/* Info */}
          <div className="cnt-info">
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>Indirizzo</span>
              <p className="cnt-info-text">{t("contatti.address")}</p>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>Telefono</span>
              <a href={`tel:${t("contatti.phone")}`} className="cnt-info-link">{t("contatti.phone")}</a>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>Email</span>
              <a href={`mailto:${t("contatti.email")}`} className="cnt-info-link">{t("contatti.email")}</a>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>{t("contatti.hoursTitle")}</span>
              <div className="cnt-hours">
                {hours.map((h, i) => (
                  <div key={i}><span>{h.day}</span><span style={h.closed ? { color: "var(--c-coral)" } : undefined}>{h.time}</span></div>
                ))}
              </div>
            </div>
            <div className="cnt-mini-map">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3066.8!2d9.15!3d41.13!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12d94b8c3d1c3af5%3A0x4cb4a7a1a282bf52!2sRena+Majore!5e0!3m2!1sit!2sit!4v1"
                width="100%" height="100%" style={{ border: 0, borderRadius: 16 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="S'Historia location"
              />
            </div>
          </div>

          {/* Form */}
          <div className="cnt-form-wrap">
            {submitted ? (
              <div className="cnt-success">
                <button className="cnt-success-close" onClick={resetForm} aria-label="Chiudi">×</button>
                <div className="cnt-success-icon">✦</div>
                <h3>{t("contatti.success")}</h3>
                <p>Ti scriveremo entro 24 ore per confermare.</p>
                <button className="cnt-success-again" onClick={resetForm}>
                  {({ it: "Nuova richiesta", pl: "Nowa prośba", en: "New request", de: "Neue Anfrage", fr: "Nouvelle demande", es: "Nueva solicitud" })[(typeof window !== "undefined" && window.currentLanguage) || "it"]}
                </button>
              </div>
            ) : (
              <form className="cnt-form" onSubmit={submit}>
                <h3 className="cnt-form-title">{t("contatti.formTitle")}</h3>
                <div className="cnt-form-grid">
                  <div className={`field ${errors.firstName ? "err" : ""}`}>
                    <label>{t("contatti.fields.firstName") || "Nome"} *</label>
                    <input value={form.firstName} onChange={upd("firstName")} placeholder="Mario" />
                  </div>
                  <div className={`field ${errors.lastName ? "err" : ""}`}>
                    <label>{t("contatti.fields.lastName") || "Cognome"} *</label>
                    <input value={form.lastName} onChange={upd("lastName")} placeholder="Rossi" />
                  </div>
                  <div className={`field ${errors.email ? "err" : ""}`}>
                    <label>{t("contatti.fields.email")} *</label>
                    <input type="email" value={form.email} onChange={upd("email")} placeholder="mario@email.com" />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.phone")}</label>
                    <input value={form.phone} onChange={upd("phone")} placeholder="+39 ..." />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.date")}</label>
                    <CustomDatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} lang={(typeof window !== "undefined" && window.currentLanguage) || "it"} closedDates={closedDates} />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.time") || "Ora"}</label>
                    <CustomTimePicker value={form.time} onChange={(v) => setForm((f) => ({ ...f, time: v }))} slots={slots} lang={(typeof window !== "undefined" && window.currentLanguage) || "it"} />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.people")}</label>
                    <div className="stepper">
                      <button type="button" onClick={() => setForm((f) => ({ ...f, people: Math.max(1, f.people - 1) }))}>−</button>
                      <span>{form.people}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, people: Math.min(20, f.people + 1) }))}>+</button>
                    </div>
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>{t("contatti.fields.message")}</label>
                    <textarea rows={3} value={form.message} onChange={upd("message")} placeholder="Allergie, occasione speciale, richieste..." />
                  </div>
                </div>
                <button type="submit" className={`btn cnt-submit ${sending ? "is-sending" : ""}`} disabled={sending}>
                  <span className="cnt-submit-fill" aria-hidden="true" />
                  <span className="cnt-submit-label">
                    {sending ? (
                      <span className="cnt-dots"><span></span><span></span><span></span></span>
                    ) : (
                      <>{t("contatti.submit")} <span className="arrow">→</span></>
                    )}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .contatti { background: var(--c-deep); color: #fff; padding: 120px 0; }
        .cnt-head { max-width: 720px; margin-bottom: 80px; }
        .cnt-head .kicker { display: block; margin-bottom: 24px; }
        .cnt-split { display: grid; grid-template-columns: 1fr; gap: 64px; }
        @media (min-width: 1024px) { .cnt-split { grid-template-columns: 1fr 1.4fr; gap: 96px; } }
        .cnt-info { display: flex; flex-direction: column; gap: 32px; }
        .cnt-info-block { display: flex; flex-direction: column; gap: 6px; }
        .cnt-info-text { font-family: var(--f-display); font-weight: 600; font-size: 18px; line-height: 1.4; letter-spacing: -0.01em; max-width: 320px; }
        .cnt-info-link { font-family: var(--f-display); font-weight: 700; font-size: 22px; letter-spacing: -0.01em; transition: color 0.3s; }
        .cnt-info-link:hover { color: var(--c-sky); }
        .cnt-hours { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
        .cnt-hours div { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .cnt-hours span:first-child { color: rgba(255,255,255,0.6); }
        .cnt-mini-map { height: 180px; border-radius: 16px; overflow: hidden; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-top: 8px; max-width: 100%; box-sizing: border-box; }
        .cnt-mini-map iframe { width: 100%; height: 100%; border: 0; display: block; }
        .cnt-form { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; backdrop-filter: blur(20px); }
        @media (max-width: 768px) {
          .contatti { padding: 80px 0; overflow: hidden; }
          .cnt-split { gap: 40px; }
          .cnt-form { padding: 24px 18px; border-radius: 18px; }
          .cnt-form-title { font-size: 24px; margin-bottom: 22px; }
          .cnt-info, .cnt-form-wrap { max-width: 100%; min-width: 0; }
          .cnt-info-text, .cnt-info-link { overflow-wrap: anywhere; word-break: break-word; max-width: 100%; }
        }
        .cnt-form-title { font-family: var(--f-display); font-weight: 800; font-size: 32px; letter-spacing: -0.02em; margin-bottom: 32px; }
        .cnt-form-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 640px) { .cnt-form-grid { grid-template-columns: 1fr 1fr; } }
        .field.err input { border-bottom-color: var(--c-coral); animation: shake 0.3s; }
        @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .stepper { display: flex; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2); }
        .cnt-select { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; color: #fff;
          font-family: var(--f-body); font-size: 15px; padding: 12px 36px 12px 14px; outline: none; cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%23E8927C' stroke-width='1.6' fill='none'/></svg>");
          background-repeat: no-repeat; background-position: right 14px center; transition: border-color .25s, background .25s; }
        .cnt-select:hover, .cnt-select:focus { border-color: var(--c-coral, #E8927C); background: rgba(232,146,124,0.08); }
        .cnt-select option { background: var(--c-deep); color: #fff; padding: 8px; }
        .cnt-date { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; color: #fff;
          font-family: var(--f-body); font-size: 15px; padding: 12px 14px; outline: none; transition: border-color .25s, background .25s; color-scheme: dark; }
        .cnt-date:hover, .cnt-date:focus { border-color: var(--c-coral, #E8927C); background: rgba(232,146,124,0.08); }
        .cnt-date::-webkit-calendar-picker-indicator { filter: invert(1) sepia(1) saturate(4) hue-rotate(-20deg); cursor: pointer; opacity: 0.8; }
        /* Custom date picker */
        .cdp { position: relative; }
        .cdp-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; color: rgba(255,255,255,0.45); font-family: var(--f-body); font-size: 15px;
          padding: 12px 14px; cursor: pointer; transition: border-color .25s, background .25s; }
        .cdp-trigger.has-val { color: #fff; }
        .cdp-trigger:hover { border-color: var(--c-coral, #E8927C); background: rgba(232,146,124,0.08); }
        .cdp-cal-ico { font-size: 16px; opacity: 0.8; }
        .cdp-pop { position: absolute; z-index: 50; top: calc(100% + 8px); left: 0; width: 300px; max-width: 90vw; background: #0c1f2b;
          border: 1px solid rgba(255,255,255,0.14); border-radius: 16px; padding: 16px; box-shadow: 0 24px 60px rgba(0,0,0,0.5); animation: cdpIn .2s ease; }
        @keyframes cdpIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .cdp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .cdp-month { font-family: var(--f-display); font-weight: 800; font-size: 15px; color: #fff; }
        .cdp-nav { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.14); background: none; color: #fff; font-size: 18px; cursor: pointer; transition: all .2s; }
        .cdp-nav:hover { background: var(--c-coral, #E8927C); border-color: transparent; }
        .cdp-dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 6px; }
        .cdp-dow span { text-align: center; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(255,255,255,0.4); padding: 4px 0; }
        .cdp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .cdp-empty { aspect-ratio: 1; }
        .cdp-day { aspect-ratio: 1; border: none; background: none; color: #fff; font-size: 13px; border-radius: 9px; cursor: pointer; transition: all .15s; display: grid; place-items: center; }
        .cdp-day:hover:not(:disabled) { background: rgba(232,146,124,0.25); }
        .cdp-day.sel { background: var(--c-coral, #E8927C); color: #1a1014; font-weight: 800; }
        .cdp-day.past { opacity: 0.25; cursor: not-allowed; }
        .cdp-day.closed { opacity: 0.3; cursor: not-allowed; text-decoration: line-through; color: var(--c-coral, #E8927C); }
        .ctp-pop { width: 280px; }
        .ctp-group-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-coral, #E8927C); font-weight: 700; margin: 4px 0 8px; }
        .ctp-group-label:not(:first-child) { margin-top: 14px; }
        .ctp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .ctp-slot { padding: 9px 0; border-radius: 9px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; cursor: pointer; transition: all .15s; }
        .ctp-slot:hover { background: rgba(232,146,124,0.25); border-color: var(--c-coral, #E8927C); }
        .ctp-slot.sel { background: var(--c-coral, #E8927C); color: #1a1014; font-weight: 800; border-color: transparent; }
        .cnt-whatsapp { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px 0; }
        .cnt-whatsapp input { position: absolute; opacity: 0; width: 0; height: 0; }
        .cnt-wa-box { width: 24px; height: 24px; flex-shrink: 0; border-radius: 7px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); position: relative; transition: all .2s; }
        .cnt-whatsapp input:checked + .cnt-wa-box { background: #25D366; border-color: #25D366; }
        .cnt-whatsapp input:checked + .cnt-wa-box::after { content: "✓"; position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 15px; font-weight: 800; }
        .cnt-wa-text { font-size: 14px; color: rgba(255,255,255,0.85); }
        .stepper button { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 16px; }
        .stepper button:hover { background: var(--c-sky); border-color: var(--c-sky); }
        .stepper span { font-family: var(--f-display); font-weight: 700; font-size: 22px; min-width: 32px; text-align: center; }
        .cnt-submit { margin-top: 32px; background: var(--c-coral); color: #fff; position: relative; overflow: hidden; }
        .cnt-submit:hover { background: var(--c-sky); }
        .cnt-submit.is-sending { pointer-events: none; }
        .cnt-submit-fill { position: absolute; left: 0; bottom: 0; width: 100%; height: 0; background: var(--c-sky); z-index: 0; transition: height .7s cubic-bezier(.2,.8,.2,1); }
        .cnt-submit.is-sending .cnt-submit-fill { height: 100%; }
        .cnt-submit-label { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 8px; }
        .cnt-dots { display: inline-flex; gap: 5px; align-items: center; }
        .cnt-dots span { width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: cntBounce 1s infinite ease-in-out; }
        .cnt-dots span:nth-child(2) { animation-delay: .15s; }
        .cnt-dots span:nth-child(3) { animation-delay: .3s; }
        @keyframes cntBounce { 0%,80%,100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-7px); opacity: 1; } }
        .cnt-success { position: relative; background: rgba(91,184,212,0.1); border: 1px solid var(--c-sky); border-radius: 24px; padding: 80px 40px; text-align: center; animation: cntToastIn .4s cubic-bezier(.2,.9,.3,1); }
        @keyframes cntToastIn { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
        .cnt-success-close { position: absolute; top: 16px; right: 16px; width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.25); color: #fff; font-size: 22px; cursor: pointer; display: grid; place-items: center; transition: all .2s; }
        .cnt-success-close:hover { background: var(--c-coral); border-color: transparent; }
        .cnt-success-again { margin-top: 24px; padding: 12px 26px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25); background: transparent; color: #fff; font-family: var(--f-body); font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s; }
        .cnt-success-again:hover { background: var(--c-coral); border-color: transparent; }
        .cnt-success-icon { font-size: 64px; color: var(--c-coral); margin-bottom: 24px; }
        .cnt-success h3 { font-family: var(--f-display); font-weight: 800; font-size: 32px; letter-spacing: -0.02em; }
        .cnt-success p { font-family: var(--f-serif); font-style: italic; opacity: 0.7; margin-top: 8px; font-size: 18px; }
      `}</style>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ t }) {
  const lang = (typeof window !== "undefined" && window.currentLanguage) || "it";
  const [news, setNews] = useStateE({ email: "", name: "", open: false, sent: false });
  const L = {
    news: { it:"Una mail al mese. Stagioni, eventi, ricette.", pl:"Jeden mail miesięcznie. Sezony, wydarzenia, przepisy.", en:"One email a month. Seasons, events, recipes.", de:"Eine Mail im Monat. Saisons, Events, Rezepte.", fr:"Un e-mail par mois. Saisons, événements, recettes.", es:"Un correo al mes. Temporadas, eventos, recetas." },
    name: { it:"Il tuo nome", pl:"Twoje imię", en:"Your name", de:"Dein Name", fr:"Ton nom", es:"Tu nombre" },
    sub: { it:"Iscriviti", pl:"Zapisz się", en:"Subscribe", de:"Abonnieren", fr:"S'inscrire", es:"Suscribirse" },
    done: { it:"Iscritto! Grazie 🍸", pl:"Zapisano! Dziękujemy 🍸", en:"Subscribed! Thanks 🍸", de:"Angemeldet! Danke 🍸", fr:"Inscrit ! Merci 🍸", es:"¡Suscrito! Gracias 🍸" },
    legal: { it:"Note legali", pl:"Informacje prawne", en:"Legal", de:"Rechtliches", fr:"Mentions légales", es:"Legal" },
    privacy: { it:"Privacy", pl:"Prywatność", en:"Privacy", de:"Datenschutz", fr:"Confidentialité", es:"Privacidad" },
    terms: { it:"Termini", pl:"Regulamin", en:"Terms", de:"AGB", fr:"Conditions", es:"Términos" },
    cookie: { it:"Cookie", pl:"Cookies", en:"Cookies", de:"Cookies", fr:"Cookies", es:"Cookies" },
  };
  const tr = (k) => (L[k]?.[lang]) || L[k]?.it || "";
  const submitNews = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(news.email)) return;
    if (!news.open) { setNews((n) => ({ ...n, open: true })); return; }
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
      const sb = createClient(url, key);
      await sb.from("newsletter").insert({ email: news.email, name: news.name || null, language: lang });
    } catch { /* tabela opcjonalna */ }
    setNews((n) => ({ ...n, sent: true }));
    setTimeout(() => setNews({ email: "", name: "", open: false, sent: false }), 4000);
  };
  return (
    <footer className="footer">
      <div className="footer-bg">
        <Placeholder type="sea" label="" style={{ width: "100%", height: "100%", opacity: 0.15 }} />
      </div>
      <div className="container footer-content">
        <div className="footer-top reveal">
          <div className="footer-logo">
            <h3 className="footer-name">S'Historia</h3>
            <p className="footer-tagline">{t("footer.tagline")}</p>
          </div>
        </div>

        <div className="footer-grid">
          <div>
            <span className="kicker">{t("footer.explore")}</span>
            <ul>
              <li><a href="#storia">{t("nav.storia")}</a></li>
              <li><a href="#ristorante">{t("nav.ristorante")}</a></li>
              <li><a href="#bar">{t("nav.bar")}</a></li>
              <li><a href="#eventi">{t("nav.eventi")}</a></li>
              <li><a href="#attrazioni">Dintorni</a></li>
            </ul>
          </div>
          <div>
            <span className="kicker">{t("footer.contact")}</span>
            <ul>
              <li>Via Delfino</li>
              <li>07020 Rena Majore (OT)</li>
              <li>{t("contatti.phone")}</li>
              <li>{t("contatti.email")}</li>
            </ul>
          </div>
          <div>
            <span className="kicker">{t("footer.follow")}</span>
            <ul>
              <li><a href="https://instagram.com" target="_blank" rel="noopener">Instagram</a></li>
              <li><a href="https://facebook.com" target="_blank" rel="noopener">Facebook</a></li>
              <li><a href="https://tripadvisor.com" target="_blank" rel="noopener">TripAdvisor</a></li>
              <li><a href="https://g.page/r/CVK_gqHsp7TMEAE" target="_blank" rel="noopener">Google</a></li>
            </ul>
          </div>
          <div>
            <span className="kicker">Newsletter</span>
            <p className="footer-news">{tr("news")}</p>
            {news.sent ? (
              <div className="footer-news-done">✓ {tr("done")}</div>
            ) : (
              <div className="footer-news-form">
                <div className="footer-input">
                  <input placeholder="la-tua-mail@esempio.com" value={news.email} onChange={(e) => setNews((n) => ({ ...n, email: e.target.value }))} />
                  {!news.open && <button onClick={submitNews}>→</button>}
                </div>
                <div className={`footer-news-expand ${news.open ? "open" : ""}`}>
                  <input className="footer-news-name" placeholder={tr("name")} value={news.name} onChange={(e) => setNews((n) => ({ ...n, name: e.target.value }))} />
                  <button className="footer-news-sub" onClick={submitNews}>{tr("sub")} →</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sekcja prawna */}
        <div className="footer-legal">
          <span className="footer-legal-title">{tr("legal")}</span>
          <div className="footer-legal-links">
            <a href="#">{tr("privacy")}</a>
            <a href="#">{tr("terms")}</a>
            <a href="#">{tr("cookie")}</a>
          </div>
          <p className="footer-legal-info">S'Historia di Giovanni Taras · P.IVA 01234567890 · Via Delfino, 07020 Rena Majore (OT), Italia</p>
        </div>

        <div className="footer-bottom">
          <span>© 2026 S'Historia · Rena Majore · Sardegna</span>
          <span style={{ fontFamily: "var(--f-serif)", fontStyle: "italic" }}>Con amore, dal 1996.</span>
        </div>
        <div className="footer-credit">
          <a href="mailto:shardananuragici@gmail.com">Creato da shardananuragici@gmail.com</a>
        </div>
      </div>
      <style>{`
        .footer { position: relative; background: var(--c-deep); color: #fff; padding: 120px 0 40px; overflow: hidden; }
        .footer-bg { position: absolute; inset: 0; }
        .footer-content { position: relative; z-index: 1; }
        .footer-top { text-align: center; margin-bottom: 80px; }
        .footer-name { font-family: var(--f-display); font-weight: 800; font-size: clamp(48px, 10vw, 160px); letter-spacing: -0.04em; line-height: 0.9; overflow-wrap: anywhere; word-break: break-word; }
        .footer-tagline { font-family: var(--f-serif); font-style: italic; font-size: 22px; margin-top: 16px; opacity: 0.7; }
        .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px 24px; padding-top: 48px; border-top: 1px solid rgba(255,255,255,0.1); }
        @media (min-width: 1024px) { .footer-grid { grid-template-columns: repeat(4, 1fr); gap: 48px; } }
        .footer-grid .kicker { color: var(--c-sky); display: block; margin-bottom: 16px; }
        .footer-grid ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .footer-grid a { transition: color 0.3s; }
        .footer-grid a:hover { color: var(--c-coral); }
        .footer-news { font-family: var(--f-serif); font-style: italic; opacity: 0.7; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
        .footer-input { display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.2); }
        .footer-input input { flex: 1; background: transparent; border: 0; color: #fff; font-family: var(--f-body); font-size: 14px; padding: 10px 0; outline: none; }
        .footer-input input::placeholder { color: rgba(255,255,255,0.3); }
        .footer-input button { width: 40px; height: 40px; color: #fff; }
        .footer-input button:hover { color: var(--c-coral); }
        /* Newsletter — rozwijane pole imię + przycisk */
        .footer-news-expand { max-height:0; overflow:hidden; opacity:0; transition:max-height .35s cubic-bezier(.2,.85,.2,1), opacity .3s; }
        .footer-news-expand.open { max-height:140px; opacity:1; margin-top:12px; }
        .footer-news-name { width:100%; box-sizing:border-box; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; font-size:14px; padding:11px 14px; outline:none; }
        .footer-news-name::placeholder { color:rgba(255,255,255,0.4); }
        .footer-news-sub { margin-top:10px; width:100%; padding:12px; border-radius:10px; border:none; background:var(--c-coral,#E8927C); color:#fff; font-weight:700; font-size:13px; cursor:pointer; }
        .footer-news-done { padding:14px; border-radius:12px; background:rgba(39,174,96,0.18); border:1px solid rgba(39,174,96,0.5); color:#5fd38a; font-weight:700; font-size:14px; }
        /* Sekcja prawna */
        .footer-legal { padding-top:32px; margin-top:48px; border-top:1px solid rgba(255,255,255,0.1); }
        .footer-legal-title { display:block; font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:var(--c-sky); margin-bottom:12px; }
        .footer-legal-links { display:flex; gap:20px; flex-wrap:wrap; }
        .footer-legal-links a { font-size:13px; color:rgba(255,255,255,0.7); transition:color .2s; }
        .footer-legal-links a:hover { color:var(--c-coral); }
        .footer-legal-info { font-size:11px; opacity:0.5; margin-top:14px; line-height:1.6; overflow-wrap:anywhere; }
        .footer-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 32px; margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); }
        .footer-credit { text-align:center; padding-top:18px; }
        .footer-credit a { font-size:11px; color:rgba(255,255,255,0.35); letter-spacing:0.05em; transition:color .2s; }
        .footer-credit a:hover { color:var(--c-coral); }
        @media (max-width:768px) {
          .footer { padding:80px 0 32px; }
          .footer-bottom { flex-direction:column; align-items:center; text-align:center; gap:8px; }
          .footer-legal-links { justify-content:center; }
          .footer-legal { text-align:center; }
          .footer-legal-title { text-align:center; }
        }
      `}</style>
    </footer>
  );
}

export { Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer };
