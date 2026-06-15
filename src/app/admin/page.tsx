"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { translateToAll } from "../../lib/translate";
import dynamic from "next/dynamic";
import ErrorBoundary from "../../components/ErrorBoundary";

// Prawdziwy globus 3D (WebGL) — ładowany tylko w przeglądarce (bez SSR)
const StatsGlobe = dynamic(() => import("../../components/StatsGlobe"), {
  ssr: false,
  loading: () => <div className="stats-globe-loading">🌍</div>,
});

type Tab = "menu" | "events" | "drinks" | "orders" | "messages" | "reviews" | "stats" | "hours" | "newsletter" | "ospiti";

// Skeleton loading — animowane „kości" zamiast napisu Caricamento
function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-skel">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="admin-skel-row">
          <div className="admin-skel-box admin-skel-thumb" />
          <div className="admin-skel-lines">
            <div className="admin-skel-box admin-skel-line" style={{ width: `${60 + (i % 3) * 12}%` }} />
            <div className="admin-skel-box admin-skel-line admin-skel-line-sm" style={{ width: `${30 + (i % 4) * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Flaga jako OBRAZEK (flagcdn) — renderuje się na każdym systemie, też na Windows,
// gdzie emoji flag (regional indicators) nie działają i pokazują się jako "PL"/"??".
function FlagImg({ code, size = 22 }: { code?: string; size?: number }) {
  const cc = (code || "").trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return <span style={{ fontSize: size - 2, lineHeight: 1 }} aria-hidden="true">🌍</span>;
  return <img src={`https://flagcdn.com/w40/${cc}.png`} alt={cc.toUpperCase()} loading="lazy"
    style={{ width: size, height: "auto", borderRadius: 3, display: "inline-block", verticalAlign: "middle", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />;
}
// Język UI → kod kraju flagi (en → Wielka Brytania)
const LANG_CC: Record<string, string> = { it: "it", pl: "pl", en: "gb", de: "de", fr: "fr", es: "es" };

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("menu");
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [notif, setNotif] = useState<{ messages: number; reviews: number; orders: number; comments: number }>({ messages: 0, reviews: 0, orders: 0, comments: 0 });
  const [bellOpen, setBellOpen] = useState(false);
  const [composeGuest, setComposeGuest] = useState<{ email: string; name?: string; lang?: string } | null>(null);

  // Liczniki powiadomień (nieprzeczytane wiadomości, recenzje do zatwierdzenia, nowe zamówienia dziś)
  useEffect(() => {
    if (!authed) return;
    const loadNotif = async () => {
      try {
        const since = new Date(Date.now() - 86400000).toISOString();
        // Komentarze do drinków: liczymy nowe od ostatniego "przeczytania" dzwonka (localStorage)
        const seenC = (typeof localStorage !== "undefined" && localStorage.getItem("sh-admin-comments-seen")) || since;
        const [m, r, o, c] = await Promise.all([
          supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("is_read", false),
          supabase.from("reviews").select("id", { count: "exact", head: true }).eq("is_approved", false),
          supabase.from("drink_orders").select("id", { count: "exact", head: true }).gte("created_at", since),
          supabase.from("drink_comments").select("id", { count: "exact", head: true }).gte("created_at", seenC),
        ]);
        setNotif({ messages: m.count || 0, reviews: r.count || 0, orders: o.count || 0, comments: c.count || 0 });
      } catch { /* ignore */ }
    };
    loadNotif();
    const ch = supabase.channel("admin_notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, loadNotif)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, loadNotif)
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_orders" }, loadNotif)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "drink_comments" }, loadNotif)
      .subscribe();
    const poll = setInterval(loadNotif, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [authed]);
  const totalNotif = notif.messages + notif.reviews + notif.comments;
  // Oznacz komentarze jako przeczytane (zapamiętaj moment otwarcia dzwonka)
  const markCommentsSeen = () => {
    try { localStorage.setItem("sh-admin-comments-seen", new Date().toISOString()); } catch {}
    setNotif((n) => ({ ...n, comments: 0 }));
  };

  // Wczytaj zapamiętany motyw
  useEffect(() => {
    try { const t = localStorage.getItem("sh-admin-theme"); if (t === "light" || t === "dark") setTheme(t); } catch {}
  }, []);
  const toggleTheme = () => setTheme((t) => { const n = t === "dark" ? "light" : "dark"; try { localStorage.setItem("sh-admin-theme", n); } catch {} return n; });

  // Prosty PIN do admina (w produkcji zastąpić Supabase Auth)
  const checkPin = () => {
    if (pin === "shistoria2026") { setAuthed(true); setPinErr(false); }
    else { setPinErr(true); setPin(""); }
  };

  if (!authed) {
    return (
      <div className={`admin-login admin-theme-${theme}`}>
        <div className="admin-login-card">
          <h1>S'Historia</h1>
          <p>Pannello di controllo</p>
          <input
            type="password"
            placeholder="PIN di accesso"
            value={pin}
            className={pinErr ? "pin-err" : ""}
            onChange={(e) => { setPin(e.target.value); setPinErr(false); }}
            onKeyDown={(e) => e.key === "Enter" && checkPin()}
          />
          {pinErr && <span className="admin-pin-error">⚠ PIN errato. Riprova.</span>}
          <button onClick={checkPin}>Entra →</button>
        </div>
        <AdminStyles />
      </div>
    );
  }

  return (
    <div className={`admin admin-theme-${theme}`}>
      {navOpen && <div className="admin-nav-scrim" onClick={() => setNavOpen(false)} />}
      <aside className={`admin-nav ${navOpen ? "is-open" : ""}`}>
        <div className="admin-logo">
          <div className="admin-logo-mark">S'H</div>
          <div className="admin-logo-txt">
            <h2>S'Historia</h2>
            <span>Admin Panel</span>
          </div>
          <button className="admin-nav-close" onClick={() => setNavOpen(false)} aria-label="Chiudi menu">✕</button>
        </div>
        <nav>
          {([
            { id: "menu", label: "Menu & Orari", ico: "🍽" },
            { id: "events", label: "Eventi", ico: "🎭" },
            { id: "drinks", label: "Drink & Ordini", ico: "🍸" },
            { id: "messages", label: "Messaggi", ico: "💬" },
            { id: "ospiti", label: "Ospiti", ico: "👥" },
            { id: "newsletter", label: "Newsletter", ico: "📧" },
            { id: "reviews", label: "Recensioni", ico: "⭐" },
            { id: "stats", label: "Statistiche", ico: "📊" },
          ] as { id: Tab; label: string; ico: string }[]).map((t) => {
            const badge = t.id === "messages" ? notif.messages : t.id === "reviews" ? notif.reviews : t.id === "drinks" ? notif.orders : 0;
            return (
              <button
                key={t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => { setTab(t.id); setNavOpen(false); }}
              >
                <span className="admin-nav-ico">{t.ico}</span>
                <span className="admin-nav-label">{t.label}</span>
                {badge > 0 && <span className="admin-nav-badge">{badge > 99 ? "99+" : badge}</span>}
              </button>
            );
          })}
        </nav>
        {/* Przełącznik motywu jasny/ciemny */}
        <button className="admin-theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? "☀️ Tema chiaro" : "🌙 Tema scuro"}
        </button>
      </aside>
      <button className="admin-nav-toggle" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">{navOpen ? "✕" : "☰"}</button>

      {/* 🔔 Dzwonek powiadomień — prawy górny róg */}
      <div className="admin-bell-wrap">
        <button className="admin-bell" onClick={() => setBellOpen((o) => !o)} aria-label="Notifiche">
          🔔{totalNotif > 0 && <span className="admin-bell-badge">{totalNotif > 99 ? "99+" : totalNotif}</span>}
        </button>
        {bellOpen && (
          <>
            <div className="admin-bell-backdrop" onClick={() => setBellOpen(false)} />
            <div className="admin-bell-pop">
              <div className="admin-bell-head">Notifiche</div>
              {totalNotif === 0 && notif.orders === 0 && <div className="admin-bell-empty">Tutto in ordine ✓</div>}
              {notif.messages > 0 && (
                <button className="admin-bell-item" onClick={() => { setTab("messages"); setBellOpen(false); }}>
                  💬 <span><strong>{notif.messages}</strong> messaggi non letti</span>
                </button>
              )}
              {notif.reviews > 0 && (
                <button className="admin-bell-item" onClick={() => { setTab("reviews"); setBellOpen(false); }}>
                  ⭐ <span><strong>{notif.reviews}</strong> recensioni da approvare</span>
                </button>
              )}
              {notif.comments > 0 && (
                <button className="admin-bell-item" onClick={() => { setTab("drinks"); markCommentsSeen(); setBellOpen(false); }}>
                  🗨️ <span><strong>{notif.comments}</strong> nuovi commenti sui drink</span>
                </button>
              )}
              {notif.orders > 0 && (
                <button className="admin-bell-item" onClick={() => { setTab("drinks"); setBellOpen(false); }}>
                  📱 <span><strong>{notif.orders}</strong> ordini nelle 24h</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <main className="admin-main">
        {tab === "menu" && <MenuHoursPanel />}
        {tab === "events" && <EventsPanel />}
        {tab === "drinks" && <DrinksOrdersPanel />}
        {tab === "messages" && <MessagesPanel compose={composeGuest} onComposeUsed={() => setComposeGuest(null)} />}
        {tab === "ospiti" && <OspitiPanel onWrite={(g) => { setComposeGuest(g); setTab("messages"); }} />}
        {tab === "newsletter" && <NewsletterPanel />}
        {tab === "reviews" && <ReviewsPanel />}
        {tab === "stats" && <StatsPanel />}
      </main>
      <AdminStyles />
    </div>
  );
}

// ─── Menu + Orari (połączona zakładka z pod-zakładkami) ────────────────────────
function MenuHoursPanel() {
  const [sub, setSub] = useState<"menu" | "hours">("menu");
  return (
    <div className="admin-subtabs-wrap">
      <div className="admin-subtabs">
        <button className={sub === "menu" ? "active" : ""} onClick={() => setSub("menu")}>🍽 Menu</button>
        <button className={sub === "hours" ? "active" : ""} onClick={() => setSub("hours")}>🕐 Orari & Date</button>
      </div>
      {sub === "menu" ? <MenuPanel /> : <HoursPanel />}
    </div>
  );
}

// ─── Drink & Ordini (połączona zakładka z pod-zakładkami) ──────────────────────
function DrinksOrdersPanel() {
  const [sub, setSub] = useState<"drinks" | "orders">("drinks");
  return (
    <div className="admin-subtabs-wrap">
      <div className="admin-subtabs">
        <button className={sub === "drinks" ? "active" : ""} onClick={() => setSub("drinks")}>🍸 Drink Clienti</button>
        <button className={sub === "orders" ? "active" : ""} onClick={() => setSub("orders")}>📱 Ordini QR</button>
      </div>
      {sub === "drinks" ? <DrinksPanel /> : <OrdersPanel />}
    </div>
  );
}

// ─── Menu Panel ───────────────────────────────────────────────────────────────
function MenuPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);
  const [section, setSection] = useState<"ristorante" | "bar" | "all">("all");
  const [sortByLikes, setSortByLikes] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let { data } = await supabase.from("menu_items").select("*").order("sort_order");
    // Auto-seed z menu-data jeśli baza pusta — żeby od razu widzieć pozycje ze strony
    if (!data || data.length === 0) {
      await importMenu(true);
      const res = await supabase.from("menu_items").select("*").order("sort_order");
      data = res.data;
    }
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Import menu attuale dalla pagina (silent = bez confirm, do auto-seed)
  const importMenu = async (silent = false) => {
    if (!silent && !confirm("Importare il menu attuale nella base dati? Questo sovrascriverà i dati esistenti.")) return;
    if (!silent) setLoading(true);
    if (!silent) await supabase.from("menu_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // Załaduj menu-data client-side (ustawia window.FULL_MENU / DRINKS_MENU)
    if (typeof window !== "undefined" && !(window as any).FULL_MENU) {
      // @ts-ignore — menu-data.js to skrypt ustawiający window.*, nie moduł ES
      try { await import("../../menu-data.js"); } catch {}
    }
    // Importa menu ristorante (da window.FULL_MENU - data.js)
    const ristoranteItems: any[] = [];
    const FULL_MENU = (window as any).FULL_MENU || [];
    FULL_MENU.forEach((cat: any, catIdx: number) => {
      (cat.items || []).forEach((item: any, itemIdx: number) => {
        ristoranteItems.push({
          section: "ristorante",
          category: cat.label || cat.id,
          name: item.name,
          price: item.price,
          description: item.desc || null,
          allergens: item.allergen || null,
          note: item.note || null,
          image_url: item.img || null,
          is_featured: item.featured || false,
          sort_order: catIdx * 100 + itemIdx,
        });
      });
    });

    // Importa drink menu (da window.DRINKS_MENU - menu-data.js)
    const DRINKS_MENU = (window as any).DRINKS_MENU || { items: [] };
    const drinkItems: any[] = [];
    (DRINKS_MENU.items || []).forEach((item: any, idx: number) => {
      drinkItems.push({
        section: "bar",
        category: item.cat || "altro",
        name: item.name,
        price: item.price,
        description: item.desc || null,
        allergens: null,
        note: null,
        is_featured: false,
        sort_order: 10000 + idx,
      });
    });

    const allItems = [...ristoranteItems, ...drinkItems];
    if (allItems.length > 0) {
      // Supabase insert in batches of 100
      for (let i = 0; i < allItems.length; i += 100) {
        await supabase.from("menu_items").insert(allItems.slice(i, i + 100));
      }
    }
    if (!silent) load();
  };

  const filtered = (section === "all" ? items : items.filter((it) => {
    if (section === "bar") return ["cocktails", "analcolici", "spina", "bottiglia", "vodka", "grappe", "bianchi", "rossi", "bollicine"].includes(it.category?.toLowerCase());
    return !["cocktails", "analcolici", "spina", "bottiglia", "vodka", "grappe", "bianchi", "rossi", "bollicine"].includes(it.category?.toLowerCase());
  })).slice().sort((a, b) => sortByLikes ? (b.likes || 0) - (a.likes || 0) : (a.sort_order || 0) - (b.sort_order || 0));

  const save = async (item: any) => {
    setSaving(true);
    // Auto-tłumaczenie nazwy i opisu na wszystkie języki (IT = oryginał)
    try {
      const [nameTr, descTr] = await Promise.all([
        item.name ? translateToAll(item.name) : Promise.resolve(null),
        item.description ? translateToAll(item.description) : Promise.resolve(null),
      ]);
      if (nameTr) item.name_i18n = nameTr;
      if (descTr) item.desc_i18n = descTr;
    } catch { /* tłumaczenie opcjonalne — zapisz mimo błędu */ }
    if (item.id) {
      await supabase.from("menu_items").update(item).eq("id", item.id);
    } else {
      await supabase.from("menu_items").insert(item);
    }
    setSaving(false);
    setEditItem(null);
    load();
  };

  const remove = async (id: string) => {
    if (confirm("Eliminare questo piatto?")) {
      await supabase.from("menu_items").delete().eq("id", id);
      load();
    }
  };

  // ── Import z PDF (pdf.js ładowany z CDN — bez bundlowania, oszczędza miejsce) ──
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");
  const [pdfPreview, setPdfPreview] = useState<any[] | null>(null);

  const loadPdfJs = (): Promise<any> => new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) return resolve(w.pdfjsLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) { lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; resolve(lib); }
      else reject(new Error("pdf.js non caricato"));
    };
    s.onerror = () => reject(new Error("Impossibile caricare pdf.js (rete)"));
    document.head.appendChild(s);
  });

  // Parsuj wiersze tekstu z PDF → pozycje menu (nazwa + cena + ewentualnie opis)
  const parseMenuLines = (lines: string[]): any[] => {
    const items: any[] = [];
    let currentCat = "";
    const priceRe = /(\d{1,3}[.,]\d{2})\s*€?|€\s*(\d{1,3}[.,]\d{2})/;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(priceRe);
      if (m) {
        const price = (m[1] || m[2] || "").replace(".", ",");
        const name = line.replace(priceRe, "").replace(/[.·•\-–—\s]+$/, "").trim();
        if (name && name.length > 1) items.push({ section: "ristorante", category: currentCat || "Menu", name, price: price ? `${price} €` : "", description: "" });
      } else if (line.length < 32 && /^[A-ZÀ-Ü0-9][A-Za-zÀ-ü'\s&]+$/.test(line) && !line.includes(",")) {
        // krótka linia bez ceny, dużymi literami → nagłówek kategorii
        currentCat = line;
      } else if (items.length > 0 && line.length > 3) {
        // dłuższa linia po pozycji → opis ostatniej
        const last = items[items.length - 1];
        last.description = (last.description ? last.description + " " : "") + line;
      }
    }
    return items;
  };

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset, by ten sam plik dało się wgrać ponownie
    if (!file) return;
    setPdfBusy(true); setPdfMsg("Lettura del PDF...");
    try {
      const pdfjsLib = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const allLines: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        // grupuj itemy po Y (wiersze)
        const rows: Record<number, string[]> = {};
        for (const it of tc.items as any[]) {
          const y = Math.round(it.transform[5]);
          (rows[y] = rows[y] || []).push(it.str);
        }
        Object.keys(rows).map(Number).sort((a, b) => b - a).forEach((y) => allLines.push(rows[y].join(" ")));
      }
      const parsed = parseMenuLines(allLines);
      if (parsed.length === 0) { setPdfMsg("Nessuna voce riconosciuta. Prova un PDF con prezzi (es. 12,00 €)."); setPdfBusy(false); return; }
      setPdfPreview(parsed);
      setPdfMsg(`Trovate ${parsed.length} voci. Controlla e conferma.`);
    } catch (err: any) {
      setPdfMsg("Errore: " + (err?.message || "PDF non leggibile"));
    }
    setPdfBusy(false);
  };

  // Zatwierdź import z PDF → tłumaczenie + zapis do DB
  const confirmPdfImport = async () => {
    if (!pdfPreview) return;
    setPdfBusy(true); setPdfMsg("Traduzione e salvataggio...");
    try {
      // Dedup: pomijamy pozycje o nazwie już istniejącej w menu (case-insensitive) i duplikaty w samym PDF
      const existing = new Set(items.map((it) => (it.name || "").trim().toLowerCase()));
      let i = 0, skipped = 0;
      for (const it of pdfPreview) {
        const key = (it.name || "").trim().toLowerCase();
        if (!key || existing.has(key)) { skipped++; continue; }
        existing.add(key);
        setPdfMsg(`Salvataggio ${++i}/${pdfPreview.length}...`);
        const payload: any = { ...it, sort_order: 5000 + i };
        try {
          const [nameTr, descTr] = await Promise.all([
            it.name ? translateToAll(it.name) : Promise.resolve(null),
            it.description ? translateToAll(it.description) : Promise.resolve(null),
          ]);
          if (nameTr) payload.name_i18n = nameTr;
          if (descTr) payload.desc_i18n = descTr;
        } catch { /* tłumaczenie opcjonalne */ }
        await supabase.from("menu_items").insert(payload);
      }
      setPdfMsg(`✓ Importate ${i} voci${skipped ? ` · ${skipped} duplicati saltati` : ""}.`);
      setPdfPreview(null);
      load();
      setTimeout(() => setPdfMsg(""), 3500);
    } catch (err: any) {
      setPdfMsg("Errore salvataggio: " + (err?.message || ""));
    }
    setPdfBusy(false);
  };

  // Upload zdjęcia pozycji menu → Supabase Storage (bucket "assets")
  const [uploading, setUploading] = useState(false);
  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("assets").getPublicUrl(path);
        setEditItem((prev: any) => ({ ...prev, image_url: data.publicUrl }));
      } else { alert("Errore upload: " + error.message); }
    } catch (e2) { console.error(e2); }
    setUploading(false);
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Menu</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "ristorante", "bar"] as const).map((s) => (
            <button key={s} className={`admin-btn-sm ${section === s ? "admin-btn-gold" : ""}`} onClick={() => setSection(s)}>
              {s === "all" ? "Tutto" : s === "ristorante" ? "🍽 Ristorante" : "🍸 Bar"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`admin-btn-sm ${sortByLikes ? "admin-btn-gold" : ""}`} onClick={() => setSortByLikes((v) => !v)}>❤️ Più popolari</button>
          <label className="admin-btn-ghost" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            📄 Importa PDF
            <input type="file" accept="application/pdf" hidden onChange={handlePdf} disabled={pdfBusy} />
          </label>
          <button className="admin-btn" onClick={() => setEditItem({ section: "ristorante", category: "", name: "", price: "", description: "" })}>
            + Aggiungi piatto
          </button>
        </div>
      </header>

      {pdfMsg && !pdfPreview && <p style={{ textAlign: "center", fontWeight: 600, opacity: 0.85 }}>{pdfMsg}</p>}

      {/* Anteprima import PDF */}
      {pdfPreview && (
        <div className="admin-modal-overlay" onClick={() => !pdfBusy && setPdfPreview(null)}>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Anteprima import PDF</h3>
            <p style={{ opacity: 0.7, fontSize: 13, marginTop: -12 }}>{pdfMsg}</p>
            <div className="pdf-preview-list">
              {pdfPreview.map((it, i) => (
                <div key={i} className="pdf-preview-row">
                  <input value={it.category} onChange={(e) => setPdfPreview((p) => p!.map((x, xi) => xi === i ? { ...x, category: e.target.value } : x))} placeholder="Categoria" className="pdf-prev-cat" />
                  <input value={it.name} onChange={(e) => setPdfPreview((p) => p!.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} placeholder="Nome" className="pdf-prev-name" />
                  <input value={it.price} onChange={(e) => setPdfPreview((p) => p!.map((x, xi) => xi === i ? { ...x, price: e.target.value } : x))} placeholder="Prezzo" className="pdf-prev-price" />
                  <button className="admin-btn-sm admin-btn-danger" onClick={() => setPdfPreview((p) => p!.filter((_, xi) => xi !== i))}>✕</button>
                </div>
              ))}
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={confirmPdfImport} disabled={pdfBusy}>{pdfBusy ? pdfMsg : `✓ Importa ${pdfPreview.length} voci (con traduzione)`}</button>
              <button className="admin-btn-ghost" onClick={() => setPdfPreview(null)} disabled={pdfBusy}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="admin-modal-overlay" onClick={() => setEditItem(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editItem.id ? "Modifica" : "Nuovo piatto"}</h3>
            <div className="admin-form">
              <label>Foto del piatto</label>
              <div className="menu-img-upload">
                {editItem.image_url ? (
                  <div className="menu-img-preview">
                    <img src={editItem.image_url} alt="" />
                    <button type="button" onClick={() => setEditItem({ ...editItem, image_url: null })}>✕</button>
                  </div>
                ) : (
                  <label className="menu-img-drop">
                    {uploading ? "Caricamento..." : "📷 Carica foto"}
                    <input type="file" accept="image/*" hidden onChange={handleImage} />
                  </label>
                )}
              </div>
              <label>Categoria</label>
              <input value={editItem.category} onChange={(e) => setEditItem({ ...editItem, category: e.target.value })} placeholder="es. Antipasti, Primi..." />
              <label>Sezione</label>
              <select value={editItem.section || "ristorante"} onChange={(e) => setEditItem({ ...editItem, section: e.target.value })} className="menu-sel">
                <option value="ristorante">🍽 Ristorante</option>
                <option value="bar">🍸 Bar</option>
                <option value="dolci">🍰 Dolci</option>
              </select>
              <label>Nome</label>
              <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} placeholder="Nome del piatto" />
              <label>Prezzo</label>
              <input value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })} placeholder="es. 18,00 €" />
              <label>Descrizione</label>
              <textarea value={editItem.description || ""} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })} placeholder="Ingredienti, note..." />
              <label>Allergeni</label>
              <input value={editItem.allergens || ""} onChange={(e) => setEditItem({ ...editItem, allergens: e.target.value })} placeholder="es. 1·7" />
              <div className="admin-form-row">
                <label><input type="checkbox" checked={editItem.is_featured || false} onChange={(e) => setEditItem({ ...editItem, is_featured: e.target.checked })} /> In evidenza</label>
              </div>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={() => save(editItem)} disabled={saving}>{saving ? "Traduzione e salvataggio..." : "Salva"}</button>
              <button className="admin-btn-ghost" onClick={() => setEditItem(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <Skeleton /> : (
        <div className="admin-table">
          <table>
            <thead><tr><th>Foto</th><th>Categoria</th><th>Nome</th><th>Prezzo</th><th>❤️</th><th>Allergeni</th><th></th></tr></thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td data-label="Foto">{it.image_url ? <img src={it.image_url} alt="" className="menu-thumb" /> : <span className="menu-thumb menu-thumb-ph">🍽</span>}</td>
                  <td data-label="Categoria">{it.category}</td>
                  <td data-label="Nome"><strong>{it.name}</strong>{it.is_featured && <span className="admin-badge">★</span>}</td>
                  <td data-label="Prezzo">{it.price}</td>
                  <td data-label="❤️">{(it.likes || 0) > 0 ? <span className="menu-likes-badge">❤️ {it.likes}</span> : "—"}</td>
                  <td data-label="Allergeni">{it.allergens || "—"}</td>
                  <td className="menu-row-actions">
                    <button className="admin-btn-sm" onClick={() => setEditItem(it)}>✎</button>
                    <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(it.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p className="admin-empty">Nessun piatto nel menu. Aggiungi il primo!</p>}
        </div>
      )}
    </div>
  );
}

// ─── Events Panel ─────────────────────────────────────────────────────────────
function ItalianCalendar({ value, onChange, accent }: { value: string; onChange: (d: string) => void; accent?: string }) {
  const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const wd = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  const sel = value ? new Date(value + "T00:00:00") : null;
  const [view, setView] = useState(() => { const b = sel || new Date(); return new Date(b.getFullYear(), b.getMonth(), 1); });
  const y = view.getFullYear(), m = view.getMonth();
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  const fmt = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return (
    <div className="ev-cal">
      <div className="ev-cal-head">
        <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Mese precedente">‹</button>
        <span>{months[m]} {y}</span>
        <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Mese successivo">›</button>
      </div>
      <div className="ev-cal-wd">{wd.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="ev-cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const ds = fmt(d); const isSel = value === ds; const dt = new Date(y, m, d); const isToday = dt.getTime() === today.getTime();
          return (
            <button type="button" key={i} className={`ev-cal-day ${isSel ? "sel" : ""} ${isToday ? "today" : ""}`}
              style={isSel && accent ? { background: accent, borderColor: accent } : undefined} onClick={() => onChange(ds)}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

function EventsPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEvt, setEditEvt] = useState<any>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1); // 3-krokowy stepper
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");
  const [uploading, setUploading] = useState(false);
  const [genreInput, setGenreInput] = useState("");

  // Stonowane, „cieekawe" szablony-motywy (gradienty) — bez prostych płaskich tła
  const TEMPLATES = [
    { id: "festa", label: "Festa", colors: { bg: "linear-gradient(135deg,#2a0a3a,#6a1b9a)", accent: "#e040fb" } },
    { id: "dj", label: "DJ Set", colors: { bg: "linear-gradient(135deg,#06121f,#0d47a1)", accent: "#00e5ff" } },
    { id: "ospite", label: "Ospite Speciale", colors: { bg: "linear-gradient(135deg,#2a0606,#b71c1c)", accent: "#ffd54f" } },
    { id: "live", label: "Live Music", colors: { bg: "linear-gradient(135deg,#15082e,#7b1fa2)", accent: "#ff80ab" } },
    { id: "degustazione", label: "Degustazione", colors: { bg: "linear-gradient(135deg,#241405,#8d3a12)", accent: "#e67e22" } },
    { id: "aperitivo", label: "Aperitivo", colors: { bg: "linear-gradient(135deg,#10202e,#b9770e)", accent: "#ffca28" } },
    { id: "cena", label: "Cena Speciale", colors: { bg: "linear-gradient(135deg,#08231a,#1b7a44)", accent: "#2ecc71" } },
    { id: "notte", label: "Notte / Capodanno", colors: { bg: "linear-gradient(135deg,#05060f,#283593)", accent: "#ffd700" } },
  ];
  const GENRES = ["Pop", "Reggaeton", "Disco", "House", "Techno", "Latino", "Rock", "Jazz", "R&B", "Hip-Hop", "Commerciale", "Anni '80", "Anni '90", "Revival"];
  const toggleGenre = (g: string) => setEditEvt((p: any) => { const cur: string[] = p.genres || []; return { ...p, genres: cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g] }; });
  const addCustomGenre = () => { const g = genreInput.trim(); if (!g) return; setEditEvt((p: any) => ({ ...p, genres: [...new Set([...(p.genres || []), g])] })); setGenreInput(""); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("event_date");
    setEvents(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditEvt({ title: "", description: "", event_date: "", tag: "", template: "festa", custom_colors: TEMPLATES[0].colors, genres: [] }); setStep(1); };
  const openEdit = (evt: any) => { setEditEvt({ ...evt, shareInstagram: !!evt.share_instagram, shareFacebook: !!evt.share_facebook }); setStep(1); };
  const close = () => { setEditEvt(null); setStep(1); };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("assets").getPublicUrl(path);
        setEditEvt((prev: any) => ({ ...prev, image_url: data.publicUrl }));
      } else { alert("Errore upload: " + error.message); }
    } catch (e2) { console.error(e2); }
    setUploading(false);
  };

  const save = async (evt: any) => {
    // mapuj camelCase z formularza na kolumny DB + usuń pola spoza schematu
    const { shareInstagram, shareFacebook, shareStory, genres, ...rest } = evt;
    // Gatunki muzyki dopisujemy do tagu (bez zmiany schematu DB)
    const baseTag = (rest.tag || "").split("·")[0].trim();
    const tag = (genres && genres.length) ? [baseTag, genres.join(", ")].filter(Boolean).join(" · ") : baseTag;
    // event_date to kolumna typu `date` — pusty string ją wywala. Normalizuj: pusty → null, inaczej → YYYY-MM-DD
    let ed: string | null = rest.event_date || null;
    if (ed && !/^\d{4}-\d{2}-\d{2}$/.test(String(ed))) { const d = new Date(ed); ed = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); }
    if (!rest.title || !rest.title.trim()) { alert("Inserisci il titolo dell'evento."); return; }
    const payload: any = { ...rest, event_date: ed, tag, is_published: true, share_instagram: !!shareInstagram, share_facebook: !!shareFacebook, posted: false };
    const res = evt.id
      ? await supabase.from("events").update(payload).eq("id", evt.id)
      : await supabase.from("events").insert(payload);
    if (res.error) { alert("Errore nel salvataggio dell'evento: " + res.error.message); console.error("event save error", res.error); return; }
    close();
    load();
  };

  const remove = async (id: string) => {
    if (confirm("Eliminare questo evento?")) {
      await supabase.from("events").delete().eq("id", id);
      load();
    }
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Eventi</h1>
        <button className="admin-btn" onClick={openNew}>+ Nuovo evento</button>
      </header>

      {editEvt && (
        <div className="admin-modal-overlay" onClick={close}>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            {/* Stepper — 3 kroki */}
            <div className="ev-stepper">
              {[{ n: 1, l: "Template" }, { n: 2, l: "Dettagli" }, { n: 3, l: "Anteprima" }].map((s, i) => (
                <React.Fragment key={s.n}>
                  <div className={`ev-step ${step === s.n ? "active" : ""} ${step > s.n ? "done" : ""}`} onClick={() => { if (s.n < step) setStep(s.n as 1 | 2 | 3); }}>
                    <span className="ev-step-num">{step > s.n ? "✓" : s.n}</span>
                    <span className="ev-step-label">{s.l}</span>
                  </div>
                  {i < 2 && <div className={`ev-step-line ${step > s.n ? "done" : ""}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* KROK 1 — wybór szablonu (4 w rzędzie na desktop, 2x2 na telefonie) */}
            {step === 1 && (
              <>
                <h3>Scegli un template</h3>
                <div className="ev-tpl-grid">
                  {TEMPLATES.map((t) => (
                    <button key={t.id} className={`ev-tpl-card ${editEvt.template === t.id ? "active" : ""}`}
                      style={{ background: t.colors.bg }}
                      onClick={() => setEditEvt({ ...editEvt, template: t.id, custom_colors: t.colors })}>
                      <span className="ev-tpl-dot" style={{ background: t.colors.accent }} />
                      <span className="ev-tpl-label">{t.label}</span>
                      {editEvt.template === t.id && <span className="ev-tpl-check" style={{ color: t.colors.accent }}>✓</span>}
                    </button>
                  ))}
                </div>
                <div className="admin-modal-actions">
                  <button className="admin-btn" onClick={() => setStep(2)}>Avanti →</button>
                  <button className="admin-btn-ghost" onClick={close}>Annulla</button>
                </div>
              </>
            )}

            {/* KROK 2 — dane wydarzenia */}
            {step === 2 && (
              <>
                <h3>Dettagli dell'evento</h3>
                <div className="admin-form">
                  <label>Foto evento (opzionale)</label>
                  <div className="menu-img-upload">
                    {editEvt.image_url ? (
                      <div className="menu-img-preview">
                        <img src={editEvt.image_url} alt="" />
                        <button type="button" onClick={() => setEditEvt({ ...editEvt, image_url: null })}>✕</button>
                      </div>
                    ) : (
                      <label className="menu-img-drop">
                        {uploading ? "Caricamento..." : "📷 Carica foto"}
                        <input type="file" accept="image/*" hidden onChange={handleImage} />
                      </label>
                    )}
                  </div>
                  <label>Titolo</label>
                  <input value={editEvt.title} onChange={(e) => setEditEvt({ ...editEvt, title: e.target.value })} placeholder="Nome dell'evento" />
                  <label>Data</label>
                  <ItalianCalendar value={editEvt.event_date} onChange={(d) => setEditEvt({ ...editEvt, event_date: d })} accent={editEvt.custom_colors?.accent} />
                  <label>Tag</label>
                  <input value={editEvt.tag || ""} onChange={(e) => setEditEvt({ ...editEvt, tag: e.target.value })} placeholder="es. Live Music, Degustazione..." />
                  <label>Generi musicali (opzionale)</label>
                  <div className="ev-genres">
                    {GENRES.map((g) => (
                      <button type="button" key={g} className={`ev-genre ${(editEvt.genres || []).includes(g) ? "on" : ""}`} onClick={() => toggleGenre(g)}>{g}</button>
                    ))}
                    {(editEvt.genres || []).filter((g: string) => !GENRES.includes(g)).map((g: string) => (
                      <button type="button" key={g} className="ev-genre on" onClick={() => toggleGenre(g)}>{g} ✕</button>
                    ))}
                  </div>
                  <div className="ev-genre-add">
                    <input value={genreInput} onChange={(e) => setGenreInput(e.target.value)} placeholder="Altro genere…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomGenre(); } }} />
                    <button type="button" className="admin-btn-sm" onClick={addCustomGenre}>+ Aggiungi</button>
                  </div>
                  <label>Descrizione (italiano — si traduce automaticamente)</label>
                  <textarea value={editEvt.description || ""} onChange={(e) => setEditEvt({ ...editEvt, description: e.target.value })} placeholder="Descrivi l'evento..." />
                  <label>Condividi sui social (alla pubblicazione)</label>
                  <div className="ev-social-toggles">
                    <button type="button" className={`ev-social ev-social-ig ${editEvt.shareInstagram ? "on" : ""}`} onClick={() => setEditEvt({ ...editEvt, shareInstagram: !editEvt.shareInstagram })}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>
                      Instagram
                    </button>
                    <button type="button" className={`ev-social ev-social-story ${editEvt.shareStory ? "on" : ""}`} onClick={() => setEditEvt({ ...editEvt, shareStory: !editEvt.shareStory })}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="4 3"/><circle cx="12" cy="12" r="4"/></svg>
                      Story
                    </button>
                    <button type="button" className={`ev-social ev-social-fb ${editEvt.shareFacebook ? "on" : ""}`} onClick={() => setEditEvt({ ...editEvt, shareFacebook: !editEvt.shareFacebook })}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H9v3h2.3v7h2.2z"/></svg>
                      Facebook
                    </button>
                  </div>
                  {(editEvt.shareInstagram || editEvt.shareFacebook || editEvt.shareStory) && (
                    <p className="ev-social-note">Per pubblicare automaticamente serve la configurazione (vedi <strong>SOCIAL_AUTOPOST.md</strong>). Al salvataggio l'evento viene segnato come "da pubblicare".</p>
                  )}
                </div>
                <div className="admin-modal-actions">
                  <button className="admin-btn" onClick={() => setStep(3)} disabled={!editEvt.title}>Avanti — Anteprima →</button>
                  <button className="admin-btn-ghost" onClick={() => setStep(1)}>← Indietro</button>
                </div>
              </>
            )}

            {/* KROK 3 — podgląd telefon/komputer */}
            {step === 3 && (
              <>
                <h3>Anteprima</h3>
                <div className="ev-preview-switch">
                  <button className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")}>📱 Telefono</button>
                  <button className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")}>💻 Computer</button>
                </div>
                <div className={`ev-preview-stage ${previewMode}`}>
                  <div className="ev-preview-card" style={{ background: editEvt.custom_colors?.bg || "#1a1040" }}>
                    {editEvt.image_url && <img className="ev-preview-img" src={editEvt.image_url} alt="" />}
                    <div className="ev-preview-content">
                      <span className="ev-preview-tag" style={{ color: editEvt.custom_colors?.accent || "#E8927C" }}>{editEvt.tag || "Evento"}</span>
                      <h4 className="ev-preview-title">{editEvt.title || "Titolo evento"}</h4>
                      {editEvt.event_date && <span className="ev-preview-date">{new Date(editEvt.event_date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</span>}
                      {editEvt.description && <p className="ev-preview-desc">{editEvt.description}</p>}
                      <button className="ev-preview-btn" style={{ borderColor: editEvt.custom_colors?.accent }}>Avvisami</button>
                    </div>
                  </div>
                </div>
                <p className="ev-preview-note">Così apparirà sul sito (sezione Eventi). {previewMode === "mobile" ? "Vista telefono." : "Vista computer."}</p>
                <div className="admin-modal-actions">
                  <button className="admin-btn" onClick={() => save(editEvt)}>✓ Salva e pubblica</button>
                  <button className="admin-btn-ghost" onClick={() => setStep(2)}>← Indietro</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loading ? <Skeleton /> : (
        <div className="admin-grid">
          {events.map((evt) => (
            <div key={evt.id} className="admin-event-card" style={{ borderLeftColor: evt.custom_colors?.accent || "#E8927C" }}>
              <span className="admin-event-date">{evt.event_date}</span>
              <h4>{evt.title}</h4>
              <span className="admin-event-tag">{evt.tag}</span>
              <div className="admin-event-actions">
                <button className="admin-btn-sm" onClick={() => openEdit(evt)}>✎</button>
                <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(evt.id)}>✕</button>
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="admin-empty">Nessun evento. Crea il primo!</p>}
        </div>
      )}
    </div>
  );
}

// ─── Drinks Panel ─────────────────────────────────────────────────────────────
// Odliczanie do końca tygodnia/miesiąca (auto-ogłoszenie) — schemat jak endpoint:
// miesiąc → 1. dnia następnego miesiąca; tydzień → najbliższy z dni 8/15/22/29 (po 29 → 8. nast. miesiąca)
function adminCountdown(period: "week" | "month"): string {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
  let end: number;
  if (period === "month") {
    end = new Date(y, m + 1, 1, 0, 0, 0, 0).getTime();
  } else {
    const next = [8, 15, 22, 29].find((d) => d > day);
    end = next ? new Date(y, m, next, 0, 0, 0, 0).getTime() : new Date(y, m + 1, 8, 0, 0, 0, 0).getTime();
  }
  const left = Math.max(0, end - now.getTime());
  const days = Math.floor(left / 86400000), hrs = Math.floor((left % 86400000) / 3600000), min = Math.floor((left % 3600000) / 60000);
  return `${days}g ${String(hrs).padStart(2, "0")}h ${String(min).padStart(2, "0")}m`;
}

// Popout pełnych statystyk drinka (komentarze + liczby)
function DrinkStatsModal({ drink, onClose }: { drink: any; onClose: () => void }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("drink_comments").select("*").eq("drink_id", drink.id).order("created_at", { ascending: false });
        setComments(data || []);
      } catch { setComments([]); }
      setLoading(false);
    })();
  }, [drink.id]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{drink.name} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 14 }}>di {drink.author_name}</span></h3>
        <div className="drk-stats-grid">
          <div className="drk-stat"><span className="drk-stat-ico">👁</span><strong>{drink.views || 0}</strong><span>Visualizzazioni</span></div>
          <div className="drk-stat"><span className="drk-stat-ico">♥</span><strong>{drink.likes || 0}</strong><span>Mi piace</span></div>
          <div className="drk-stat"><span className="drk-stat-ico">💬</span><strong>{drink.comments || comments.length}</strong><span>Commenti</span></div>
          <div className="drk-stat"><span className="drk-stat-ico">🍸</span><strong>{drink.claimed_count || 0}</strong><span>Ordini/Ritiri</span></div>
        </div>
        <div className="drk-stats-cmts">
          <span className="admin-field-lbl">Commenti</span>
          {loading ? <p className="admin-empty">…</p> : comments.length === 0 ? <p className="admin-empty">Nessun commento.</p> : comments.map((c) => (
            <div key={c.id} className="drk-cmt-row">
              <span className="amsg-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{(c.author || "?").charAt(0).toUpperCase()}</span>
              <div><strong>{c.author}</strong> <span style={{ opacity: 0.8 }}>{/^https?:\/\/\S+\.(gif|webp|png|jpe?g)/i.test(c.content) ? "🖼 GIF/foto" : c.content}</span>
                <div style={{ fontSize: 11, opacity: 0.4 }}>{new Date(c.created_at).toLocaleString("it-IT")}</div></div>
            </div>
          ))}
        </div>
        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DrinksPanel() {
  const [drinks, setDrinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [swipe, setSwipe] = useState<{ id: string; x: number }>({ id: "", x: 0 });
  const swipeStart = useRef<{ x: number; id: string } | null>(null);
  const movedRef = useRef(false);
  const [statsDrink, setStatsDrink] = useState<any>(null);
  const [, forceTick] = useState(0);
  useEffect(() => { const t = setInterval(() => forceTick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase.from("community_drinks").select("*").order("created_at", { ascending: false }).limit(200);
    setDrinks(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel("drinks_rt").on("postgres_changes", { event: "*", schema: "public", table: "community_drinks" }, () => load(true)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Score = średnia z lajków + zamówień (claimed). Drinki z tygodnia mają wyższą wagę.
  const scoreOf = (d: any) => {
    const ageDays = (Date.now() - new Date(d.created_at).getTime()) / 86400000;
    const base = (d.likes || 0) + (d.claimed_count || 0) * 2; // zamówienia ważą podwójnie
    if (period === "week") {
      // tydzień: świeższe = wyższa szansa (bonus dla ostatnich 7 dni)
      const weekBonus = ageDays <= 7 ? 1.5 : 0.5;
      return base * weekBonus;
    }
    return base; // miesiąc: czysta średnia
  };
  const ranked = [...drinks].sort((a, b) => scoreOf(b) - scoreOf(a));

  const announceWinner_ = async () => {
    if (ranked.length === 0) { alert("Nessun drink."); return; }
    const winner = ranked[0];
    const label = period === "week" ? "Drink della Settimana" : "Drink del Mese";
    if (!confirm(`Proclamare "${winner.name}" come ${label} e inviare l'email a tutti i creatori?`)) return;
    await supabase.from("community_drinks").update({ is_drink_of_month: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("community_drinks").update({ is_drink_of_month: true }).eq("id", winner.id);
    const recipients = drinks
      .filter((d) => d.author_email && d.id !== winner.id)
      .map((d) => ({ email: d.author_email, name: d.author_name || "Anonimo", lang: d.language || "it" }))
      .filter((r, i, arr) => arr.findIndex((x) => x.email === r.email) === i);
    try {
      const { announceWinner } = await import("../../lib/make-webhooks");
      await announceWinner({ winner_drink: winner.name, winner_author: winner.author_name, winner_email: winner.author_email, winner_lang: winner.language || "it", recipients, period });
      alert(`Proclamato "${winner.name}"! Email inviata a ${recipients.length} creatori (+ vincitore separatamente).`);
    } catch (e) { console.error(e); alert("Drink segnato, ma l'email non è partita (controlla make.com)."); }
    load();
  };

  const remove = async (id: string) => {
    if (confirm("Eliminare questo drink?")) { await supabase.from("community_drinks").delete().eq("id", id); load(); }
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Drink dei Clienti</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ord-filter">
            {([["week","Settimana"],["month","Mese"]] as const).map(([id, lbl]) => (
              <button key={id} className={period === id ? "active" : ""} onClick={() => setPeriod(id)}>{lbl}</button>
            ))}
          </div>
          <button className="admin-btn" onClick={announceWinner_}>👑 Proclama {period === "week" ? "Drink della Settimana" : "Drink del Mese"}</button>
        </div>
      </header>
      <p className="drk-auto-note">✅ La proclamazione è <strong>automatica</strong> ({period === "week" ? "ogni settimana" : "ogni mese"}) — prossima tra <strong>{adminCountdown(period)}</strong>. Non devi fare nulla; usa il pulsante 👑 solo se c'è un problema o vuoi proclamare prima.</p>

      {statsDrink && <DrinkStatsModal drink={statsDrink} onClose={() => setStatsDrink(null)} />}

      {loading ? <Skeleton /> : (
        <>
          {/* Ranking top 3 */}
          {ranked.length > 0 && (
            <div className="drk-ranking">
              {ranked.slice(0, 3).map((d, i) => (
                <div key={d.id} className={`drk-rank drk-rank-${i+1}`}>
                  <span className="drk-rank-pos">{["🥇","🥈","🥉"][i]}</span>
                  <span className="drk-rank-name">{d.name}</span>
                  <span className="drk-rank-by">di {d.author_name}</span>
                  <span className="drk-rank-score">♥{d.likes||0} · 🍸{d.claimed_count||0}</span>
                </div>
              ))}
            </div>
          )}
          <div className="admin-grid">
            {ranked.map((d, i) => {
              const sx = swipe.id === d.id ? swipe.x : 0;
              return (
              <div key={d.id} className="admin-drink-swipe">
                <button className="admin-drink-trash" onClick={() => remove(d.id)} aria-label="Elimina">🗑</button>
                <div
                  className={`admin-drink-card ${d.is_drink_of_month ? "is-month" : ""}`}
                  style={{ transform: `translateX(${sx}px)`, transition: swipeStart.current ? "none" : "transform .25s ease" }}
                  onTouchStart={(e) => { swipeStart.current = { x: e.touches[0].clientX, id: d.id }; movedRef.current = false; }}
                  onTouchMove={(e) => { if (!swipeStart.current || swipeStart.current.id !== d.id) return; const dx = e.touches[0].clientX - swipeStart.current.x; if (Math.abs(dx) > 6) movedRef.current = true; setSwipe({ id: d.id, x: Math.max(-92, Math.min(0, dx)) }); }}
                  onTouchEnd={() => { setSwipe((s) => ({ id: d.id, x: s.id === d.id && s.x < -50 ? -84 : 0 })); swipeStart.current = null; }}
                  onClick={(e) => { if (movedRef.current) { movedRef.current = false; return; } if ((e.target as HTMLElement).closest("button")) return; setStatsDrink(d); }}
                  role="button"
                >
                <button className="admin-drink-x" onClick={(e) => { e.stopPropagation(); remove(d.id); }} aria-label="Elimina">×</button>
                {d.photo_url && <img src={d.photo_url} alt={d.name} className="admin-drink-photo" />}
                <div className="admin-drink-info">
                  <h4>#{i+1} {d.name}{d.is_drink_of_month && <span className="admin-badge">👑</span>}</h4>
                  <span>di {d.author_name} · {d.total_ml}ml · {d.strength_label}</span>
                  <span>👁 {d.views||0} · ♥ {d.likes||0} · 💬 {d.comments||0} · 🍸 {d.claimed_count||0} ritiri</span>
                  {Array.isArray(d.ingredients) && d.ingredients.length > 0 && (
                    <div className="admin-drink-ingr">
                      {d.ingredients.slice(0, 10).map((ing: any, ii: number) => (
                        <span key={ii} className="admin-drink-ingr-pill"><span style={{ background: ing.color || "#888" }} />{ing.name}</span>
                      ))}
                    </div>
                  )}
                  {d.author_email && <span className="drk-email">✉️ {d.author_email}</span>}
                </div>
                <div className="admin-drink-actions">
                  <button className={`admin-btn-sm ${d.is_drink_of_month ? "admin-btn-gold" : ""}`} onClick={async () => { await supabase.from("community_drinks").update({ is_drink_of_month: !d.is_drink_of_month }).eq("id", d.id); load(); }}>
                    {d.is_drink_of_month ? "★ Vincitore" : "☆ Nomina"}
                  </button>
                  <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(d.id)}>✕</button>
                </div>
                </div>
              </div>
              );
            })}
            {drinks.length === 0 && <p className="admin-empty">Nessun drink pubblicato ancora.</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Orders Panel ─────────────────────────────────────────────────────────────
function SwipeDeleteRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const [removing, setRemoving] = useState(false);
  const drag = useRef({ on: false, sx: 0, moved: false });
  const TH = 90;
  const down = (e: React.PointerEvent) => { drag.current = { on: true, sx: e.clientX, moved: false }; };
  const move = (e: React.PointerEvent) => { if (!drag.current.on) return; const d = e.clientX - drag.current.sx; if (Math.abs(d) > 6) drag.current.moved = true; setDx(Math.max(0, Math.min(170, d))); };
  const up = () => {
    if (!drag.current.on) return; drag.current.on = false;
    if (dx >= TH) { setRemoving(true); setTimeout(onDelete, 300); } else setDx(0);
  };
  return (
    <div className={`admin-swipe ${removing ? "removing" : ""}`}>
      <div className="admin-swipe-trash"><span>🗑 Elimina</span></div>
      <div className="admin-swipe-fg" style={{ transform: `translateX(${removing ? 480 : dx}px)`, transition: drag.current.on ? "none" : "transform .3s cubic-bezier(.2,.8,.2,1)" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {children}
      </div>
    </div>
  );
}

function QrScanner({ onDetected }: { onDetected: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const Detector = (typeof window !== "undefined") ? (window as any).BarcodeDetector : null;
    if (!Detector) { setSupported(false); return; }
    const detector = new Detector({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const tick = async () => {
          if (stopped) return;
          try {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes[0]?.rawValue) { onDetected(codes[0].rawValue); return; }
            }
          } catch { /* ignore frame */ }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch { setErr("Impossibile accedere alla fotocamera. Concedi il permesso o usa il codice."); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onDetected]);
  if (!supported) return <p style={{ fontSize: 13, opacity: 0.7, textAlign: "center", margin: "8px 0 14px" }}>📷 Scanner automatico non supportato qui — inserisci il codice di 4 caratteri qui sotto.</p>;
  return (
    <div className="admin-qrcam">
      <video ref={videoRef} playsInline muted />
      <div className="admin-qrcam-frame" />
      {err && <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 8 }}>{err}</p>}
    </div>
  );
}

function OrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [scanOpen, setScanOpen] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [scanMsg, setScanMsg] = useState("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase.from("drink_orders").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = data || [];
    // Auto-„Fatto": zamówienia starsze niż 15 min wciąż „in attesa" → automatycznie completate (sprzątanie)
    const stale = rows.filter((o: any) => o.status !== "completed" && (Date.now() - new Date(o.created_at).getTime()) / 60000 > 15);
    if (stale.length) {
      const ids = stale.map((o: any) => o.id);
      supabase.from("drink_orders").update({ status: "completed", auto_completed: true }).in("id", ids).then(() => { /* best-effort */ });
      stale.forEach((o: any) => { o.status = "completed"; });
    }
    setOrders(rows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // Realtime — nowe zamówienia QR na żywo
  useEffect(() => {
    const ch = supabase.channel("orders_rt").on("postgres_changes", { event: "*", schema: "public", table: "drink_orders" }, () => load(true)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const markDone = async (id: string) => {
    await supabase.from("drink_orders").update({ status: "completed", scanned_at: new Date().toISOString() }).eq("id", id);
    load();
  };
  const deleteOrder = async (id: string) => {
    await supabase.from("drink_orders").delete().eq("id", id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // Odbiór przez kod (ważny 15 min)
  const redeemByCode = async (raw?: string) => {
    const code = (typeof raw === "string" ? raw : codeInput).trim().toUpperCase();
    if (code.length < 4) { setScanMsg("Codice troppo corto"); return; }
    const { data } = await supabase.from("drink_orders").select("*").eq("pickup_code", code).order("created_at", { ascending: false }).limit(1);
    const order = data?.[0];
    if (!order) { setScanMsg("❌ Codice non trovato"); return; }
    const ageMin = (Date.now() - new Date(order.created_at).getTime()) / 60000;
    if (order.status === "completed") { setScanMsg("⚠ Già ritirato"); return; }
    if (ageMin > 15) { setScanMsg("⏱ Codice scaduto (max 15 min)"); return; }
    await markDone(order.id);
    setScanMsg(`✓ ${order.drink_name} — consegnato!`);
    setCodeInput("");
    setTimeout(() => { setScanOpen(false); setCamOn(false); setScanMsg(""); }, 1800);
  };

  // Odczyt z aparatu (QR zawiera URL /order/<id> albo sam kod)
  const onScanDetected = async (text: string) => {
    setCamOn(false);
    const m = text.match(/\/order\/([^/?#\s]+)/);
    if (m) {
      const id = m[1];
      const order = orders.find((o) => o.id === id);
      if (order?.status === "completed") { setScanMsg("⚠ Già ritirato"); return; }
      await markDone(id);
      setScanMsg(`✓ ${order?.drink_name || "Drink"} — consegnato!`);
      setTimeout(() => { setScanOpen(false); setScanMsg(""); }, 1800);
    } else {
      // może to sam kod
      redeemByCode(text.replace(/[^A-Za-z0-9]/g, "").slice(0, 6));
    }
  };

  const filtered = orders.filter((o) => filter === "all" ? true : o.status === (filter === "completed" ? "completed" : "pending") || (filter === "pending" && !o.status));

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Ordini QR</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ord-filter">
            {([["all","Tutti"],["pending","In attesa"],["completed","Completati"]] as const).map(([id, lbl]) => (
              <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{lbl}</button>
            ))}
          </div>
          <button className="admin-btn" onClick={() => { setScanOpen(true); setScanMsg(""); setCamOn(true); }}>📷 Scansiona / Codice</button>
        </div>
      </header>

      {scanOpen && (
        <div className="admin-modal-overlay" onClick={() => { setScanOpen(false); setCamOn(false); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ritira drink</h3>
            <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 14 }}>Inquadra il QR del cliente con la fotocamera, oppure inserisci il codice di 4 caratteri (valido 15 min).</p>
            {camOn ? <QrScanner onDetected={onScanDetected} /> : (
              <button className="admin-btn" onClick={() => setCamOn(true)} style={{ display: "block", width: "100%", marginBottom: 14 }}>📷 Apri fotocamera</button>
            )}
            <div className="admin-form">
              <label>Codice ritiro (4 caratteri)</label>
              <input value={codeInput} maxLength={6} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setScanMsg(""); }} placeholder="es. A7K2" style={{ textTransform: "uppercase", letterSpacing: "0.3em", fontSize: 22, textAlign: "center" }} onKeyDown={(e) => e.key === "Enter" && redeemByCode()} />
            </div>
            {scanMsg && <p style={{ textAlign: "center", fontWeight: 700, margin: "12px 0" }}>{scanMsg}</p>}
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={() => redeemByCode()}>Conferma ritiro</button>
              <button className="admin-btn-ghost" onClick={() => { setScanOpen(false); setCamOn(false); }}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <Skeleton /> : (
        <div className="admin-orders">
          {filtered.map((o) => (
            <SwipeDeleteRow key={o.id} onDelete={() => deleteOrder(o.id)}>
              <div className={`admin-order ${o.status === "completed" ? "done" : ""}`}>
                <div className="admin-order-info">
                  <h4>{o.drink_name}</h4>
                  <span>di {o.author_name} · {o.total_ml}ml · {o.strength_label}</span>
                  <span className="admin-order-time">{new Date(o.created_at).toLocaleString("it-IT")}</span>
                  {o.pickup_code && <span className="ord-code">Codice: <strong>{o.pickup_code}</strong></span>}
                </div>
                <div className="admin-order-ingr">
                  {(o.ingredients || []).slice(0, 5).map((ing: any, i: number) => (
                    <span key={i} className="admin-pill" style={{ background: (ing.color || "#888") + "33", color: ing.color || "#fff" }}>{ing.name}</span>
                  ))}
                </div>
                {o.status !== "completed" ? (
                  <button className="admin-btn" onClick={() => markDone(o.id)}>✓ Fatto</button>
                ) : <span className="admin-done-badge">✓ Completato</span>}
              </div>
            </SwipeDeleteRow>
          ))}
          {filtered.length === 0 && <p className="admin-empty">Nessun ordine in questa categoria.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Messages Panel (chat stile WhatsApp — raggruppato per email) ─────────────
// Tłumaczenie na włoski (darmowy endpoint Google Translate) — AUTO-wykrywanie języka źródłowego.
const _trCache: Record<string, string> = {};
async function toItalian(text: string): Promise<string> {
  if (!text) return text;
  if (_trCache[text]) return _trCache[text];
  try {
    // sl=auto → Google sam wykrywa język wiadomości, tl=it → zawsze włoski
    const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=it&dt=t&q=${encodeURIComponent(text)}`);
    const j = await r.json();
    const detected = j?.[2]; // wykryty język źródłowy
    const out = (j?.[0] || []).map((s: any) => s[0]).join("");
    // jeśli wykryto włoski — nie pokazuj tłumaczenia (to samo)
    const final = detected === "it" ? text : (out || text);
    _trCache[text] = final;
    return final;
  } catch { return text; }
}

function msgIsImage(s: string): boolean {
  return /^https?:\/\/\S+\.(gif|webp|png|jpe?g)(\?\S*)?$/i.test((s || "").trim()) || /\/storage\/v1\/object\/public\/chat\//i.test(s || "");
}
function msgIsLocation(s: string): boolean {
  return /^https?:\/\/\S*(maps\.google|google\.[^/]+\/maps|maps\.app\.goo\.gl|\?q=)/i.test((s || "").trim());
}
function MsgContent({ content, lang }: { content: string; lang?: string }) {
  if (msgIsImage(content)) return <img className="amsg-img" src={content} alt="" loading="lazy" />;
  if (msgIsLocation(content)) {
    const lbl = ({ it: "La nostra posizione", pl: "Nasza lokalizacja", en: "Our location", de: "Unser Standort", fr: "Notre adresse", es: "Nuestra ubicación" } as Record<string, string>)[(lang || "it").slice(0, 2)] || "La nostra posizione";
    return <a className="amsg-loc" href={content} target="_blank" rel="noopener">📍 {lbl}</a>;
  }
  return <p>{content}</p>;
}

function MessagesPanel({ compose, onComposeUsed }: { compose?: { email: string; name?: string; lang?: string } | null; onComposeUsed?: () => void } = {}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [trMap, setTrMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [personInfo, setPersonInfo] = useState<{ msgs: number; drinks: number; orders: number; reviews: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [delArm, setDelArm] = useState(false); // podwójne potwierdzenie kosza
  const fileRef = useRef<HTMLInputElement>(null);
  // Lokalizacja restauracji (edytowalna przez env NEXT_PUBLIC_MAPS_URL)
  const MAPS_URL = process.env.NEXT_PUBLIC_MAPS_URL || "https://maps.google.com/?q=S%27Historia";

  // Upload zdjęcia do Supabase Storage (bucket "chat") i wyślij jako wiadomość
  const onPickImage = async (file: File | null) => {
    if (!file || !activeThread) return;
    setUploading(true);
    try {
      const path = `chat/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("chat").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("chat").getPublicUrl(path);
      if (data?.publicUrl) await sendReply(data.publicUrl);
    } catch (e) {
      alert("Caricamento immagine fallito. Crea il bucket 'chat' (pubblico) in Supabase Storage.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const shareLocation = () => { if (activeThread) sendReply(MAPS_URL); };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: true }).limit(800);
    setMessages(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Realtime — nowe/zmienione wiadomości pojawiają się BEZ odświeżania strony
  useEffect(() => {
    const ch = supabase
      .channel("contact_messages_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, () => { load(true); })
      .subscribe();
    // fallback polling co 15s (gdyby realtime nie był włączony w Supabase)
    const poll = setInterval(() => load(true), 15000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  // Grupuj po emailu → wątki (konwersacje)
  const threads = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const m of messages) {
      const k = (m.email || "—").toLowerCase();
      (map[k] ||= []).push(m);
    }
    return Object.entries(map)
      .map(([email, msgs]) => {
        const lastClient = [...msgs].reverse().find((x: any) => !x.is_staff) || msgs[msgs.length - 1];
        return { email, msgs, last: msgs[msgs.length - 1], name: lastClient?.name || email, unread: msgs.some((x: any) => !x.is_read && !x.is_staff) };
      })
      .sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
  }, [messages]);

  // Compose z zakładki Ospiti — otwórz wątek (nawet pusty/wirtualny) dla wskazanej osoby
  useEffect(() => { if (compose?.email) setActiveEmail(compose.email); }, [compose?.email]);
  const virtualThread = (compose?.email && !threads.some((t) => t.email === compose.email))
    ? { email: compose.email, name: compose.name || compose.email, msgs: [] as any[], last: { language: compose.lang || "it", name: compose.name }, unread: false }
    : null;
  const activeThread = threads.find((t) => t.email === activeEmail) || virtualThread || threads[0] || null;

  // Szukajka — filtruj wątki po imieniu / mailu / treści
  const filteredThreads = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      t.msgs.some((m: any) => (m.message || "").toLowerCase().includes(q))
    );
  }, [threads, search]);

  // Panel info o osobie — z czym jest powiązana (drink / zamówienia / recenzje)
  useEffect(() => {
    if (!activeThread) { setPersonInfo(null); return; }
    let cancelled = false;
    const email = activeThread.email;
    const name = activeThread.name;
    const msgs = activeThread.msgs.length;
    (async () => {
      try {
        const [drk, ord, rev] = await Promise.all([
          supabase.from("community_drinks").select("id", { count: "exact", head: true }).eq("author_name", name),
          supabase.from("drink_orders").select("id", { count: "exact", head: true }).eq("author_name", name),
          supabase.from("reviews").select("id", { count: "exact", head: true }).eq("email", email),
        ]);
        if (!cancelled) setPersonInfo({ msgs, drinks: drk.count || 0, orders: ord.count || 0, reviews: rev.count || 0 });
      } catch { if (!cancelled) setPersonInfo({ msgs, drinks: 0, orders: 0, reviews: 0 }); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.email]);

  // Tłumacz KAŻDĄ wiadomość klienta na włoski (auto-wykrywanie języka źródłowego)
  useEffect(() => {
    if (!activeThread) return;
    activeThread.msgs.forEach(async (m: any) => {
      if (m.message && !m.is_staff && !trMap[m.id]) {
        const it = await toItalian(m.message);
        if (it && it !== m.message) setTrMap((prev) => ({ ...prev, [m.id]: it }));
      }
    });
  }, [activeThread, trMap]);

  const markThreadRead = async (email: string) => {
    await supabase.from("contact_messages").update({ is_read: true }).eq("email", email);
    load(true);
  };

  const sendReply = async (raw?: string) => {
    const replyIt = (typeof raw === "string" ? raw : draft).trim();
    if (!replyIt || !activeThread) return;
    const isUrl = /^https?:\/\//i.test(replyIt);
    setSending(true);
    const target = activeThread.last;
    // Wykryj JĘZYK KLIENTA z jego ostatniej wiadomości (kontakt z IMAP ma zapisane "it",
    // więc nie ufamy temu — wykrywamy realny język tekstu klienta).
    let lang = (target.language || "it").slice(0, 2);
    const clientMsg = ([...activeThread.msgs].reverse().find((m: any) => !m.is_staff)?.message) || "";
    if (clientMsg) {
      try {
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(clientMsg.slice(0, 200))}`);
        const j = await r.json();
        const detected = j?.[2];
        if (detected && ["it", "pl", "en", "de", "fr", "es"].includes(detected)) lang = detected;
      } catch { /* zostaw domyślny */ }
    }
    if (!["it", "pl", "en", "de", "fr", "es"].includes(lang)) lang = "it";
    // Zapis odpowiedzi jako OSOBNY dymek (nowy wiersz is_staff=true). Fallback: stare admin_reply.
    let inserted = false;
    try {
      const { error } = await supabase.from("contact_messages").insert({ email: activeThread.email, name: "S'Historia", message: replyIt, language: lang, is_read: true, is_staff: true });
      if (!error) inserted = true;
    } catch { /* kolumna is_staff może nie istnieć — fallback poniżej */ }
    if (!inserted) {
      await supabase.from("contact_messages").update({ admin_reply: replyIt, is_read: true }).eq("id", target.id);
    } else {
      await supabase.from("contact_messages").update({ is_read: true }).eq("email", activeThread.email);
    }
    // Pre-tłumaczenie odpowiedzi na język klienta (URL-e: zdjęcia/lokalizacja — nie tłumaczymy)
    let replyTranslated = replyIt;
    if (lang !== "it" && !isUrl) {
      try {
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=it&tl=${lang}&dt=t&q=${encodeURIComponent(replyIt)}`);
        const j = await r.json();
        replyTranslated = (j?.[0] || []).map((s: any) => s[0]).join("") || replyIt;
      } catch { replyTranslated = replyIt; }
    }
    // Markowy, ładny HTML w języku klienta (logo, kolory) — make wysyła gotowe pola
    let replySubject = "Risposta da S'Historia";
    let replyHtml = replyTranslated;
    try {
      const { adminReplyHTML } = await import("../../lib/email-templates");
      const mail = adminReplyHTML({ name: target.name, replyText: replyTranslated, lang: lang as any });
      replySubject = mail.subject;
      replyHtml = mail.html;
    } catch { /* fallback: czysty tekst */ }
    // Webhook make.com → wyśle e-mail do klienta w jego języku (gotowy markowy HTML)
    try {
      const url = process.env.NEXT_PUBLIC_MAKE_REPLY_WEBHOOK || process.env.NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK;
      if (url) {
        await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "admin_reply", email: activeThread.email, name: target.name, lang, reply_it: replyIt, reply_text: replyTranslated, reply_subject: replySubject, reply_html: replyHtml, reply_to: "info@shistoria.it", from_name: "S'Historia" }),
        });
      }
    } catch (e) { console.error(e); }
    setDraft("");
    setSending(false);
    onComposeUsed?.();
    load(true);
  };

  const removeThread = async (email: string) => {
    if (!delArm) { setDelArm(true); setTimeout(() => setDelArm(false), 3500); return; }
    setDelArm(false);
    await supabase.from("contact_messages").delete().eq("email", email);
    setActiveEmail(null);
    load();
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Messaggi</h1>
        <span className="admin-count">{threads.filter((t) => t.unread).length} non letti</span>
      </header>

      {loading ? <Skeleton /> : (
        <div className="amsg-chat" data-active={activeThread && activeEmail ? "1" : "0"}>
          {/* Lewa kolumna: szukajka + lista konwersacji */}
          <div className="amsg-listcol">
            <div className="amsg-search">
              <span className="amsg-search-ico">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome, email o testo…" />
              {search && <button className="amsg-search-clear" onClick={() => setSearch("")} aria-label="Pulisci">✕</button>}
            </div>
            <div className="amsg-list">
              {filteredThreads.map((t) => (
                <button key={t.email} className={`amsg-thread ${activeThread?.email === t.email ? "active" : ""} ${t.unread ? "unread" : ""}`}
                  onClick={() => { setActiveEmail(t.email); if (t.unread) markThreadRead(t.email); }}>
                  <span className="amsg-avatar">{(t.name || "?").charAt(0).toUpperCase()}</span>
                  <span className="amsg-thread-info">
                    <span className="amsg-thread-name">{t.name}</span>
                    <span className="amsg-thread-preview">{t.last.message || "—"}</span>
                  </span>
                  {t.unread && <span className="amsg-dot" />}
                </button>
              ))}
              {filteredThreads.length === 0 && <p className="admin-empty">{search ? "Nessun risultato." : "Nessun messaggio."}</p>}
            </div>
          </div>

          {/* Prawa kolumna: czat */}
          <div className="amsg-conv">
            {activeThread ? (
              <>
                <div className="amsg-conv-head">
                  <button className="amsg-back" onClick={() => setActiveEmail(null)} aria-label="Indietro">←</button>
                  <div>
                    <strong>{activeThread.name}</strong>
                    <span className="amsg-conv-meta">{activeThread.email} · 🌐 {activeThread.last.language}</span>
                    {personInfo && (
                      <div className="amsg-person">
                        <span className="amsg-badge">💬 {personInfo.msgs} msg</span>
                        {personInfo.drinks > 0 && <span className="amsg-badge amsg-badge-coral">🍸 {personInfo.drinks} drink</span>}
                        {personInfo.orders > 0 && <span className="amsg-badge amsg-badge-sky">📱 {personInfo.orders} ordini</span>}
                        {personInfo.reviews > 0 && <span className="amsg-badge amsg-badge-gold">⭐ {personInfo.reviews} recensioni</span>}
                      </div>
                    )}
                  </div>
                  <button className={`amsg-trash ${delArm ? "arm" : ""}`} onClick={() => removeThread(activeThread.email)}>{delArm ? "Confermi? 🗑" : "🗑"}</button>
                </div>
                <div className="amsg-bubbles">
                  {activeThread.msgs.map((m: any) => (
                    <React.Fragment key={m.id}>
                      {m.is_staff ? (
                        /* Odpowiedź obsługi — osobny dymek po prawej */
                        <div className="amsg-bubble amsg-out">
                          <MsgContent content={m.message} lang={activeThread.last.language} />
                          <span className="amsg-time">Tu · {new Date(m.created_at).toLocaleString("it-IT")}</span>
                        </div>
                      ) : (
                        <>
                          {/* Wiadomość klienta — po lewej */}
                          {m.message && (
                            <div className="amsg-bubble amsg-in">
                              <MsgContent content={m.message} lang={activeThread.last.language} />
                              {trMap[m.id] && (
                                <p className="amsg-tr">🇮🇹 {trMap[m.id]}</p>
                              )}
                              <span className="amsg-time">{new Date(m.created_at).toLocaleString("it-IT")}</span>
                            </div>
                          )}
                          {/* Legacy: odpowiedź zapisana w admin_reply (stare wiersze) */}
                          {m.admin_reply && (
                            <div className="amsg-bubble amsg-out">
                              <p>{m.admin_reply}</p>
                              <span className="amsg-time">Tu · inviato</span>
                            </div>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="amsg-input">
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
                  <button className="amsg-icon-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Foto" title="Invia foto">{uploading ? "…" : "📷"}</button>
                  <button className="amsg-icon-btn" onClick={shareLocation} aria-label="Posizione" title="Condividi posizione">📍</button>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Scrivi in italiano — verrà tradotto nella lingua del cliente..." rows={1}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                  <button className="amsg-send" onClick={() => sendReply()} disabled={sending || !draft.trim()} aria-label="Invia">{sending ? "…" : "➤"}</button>
                </div>
              </>
            ) : <p className="admin-empty">Seleziona una conversazione.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ospiti Panel (CRM — wszyscy ludzie z mailami + powiązania) ───────────────
function GuestDetailModal({ guest, onClose, onWrite }: { guest: any; onClose: () => void; onWrite: (g: any) => void }) {
  const [data, setData] = useState<{ drinks: any[]; orders: number; reviews: any[]; comments: any[]; visits: any[]; liked: any[] } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const [drk, ord, rev, cmt, vis] = await Promise.all([
          supabase.from("community_drinks").select("id,name,likes,claimed_count,created_at").or(`author_email.eq.${guest.email},author_name.eq.${guest.name}`),
          supabase.from("drink_orders").select("id", { count: "exact", head: true }).eq("author_name", guest.name),
          supabase.from("reviews").select("content,stars,created_at").eq("email", guest.email).order("created_at", { ascending: false }),
          supabase.from("drink_comments").select("content,created_at,drink_id").eq("author", guest.name).order("created_at", { ascending: false }).limit(20),
          supabase.from("analytics_visits").select("duration_seconds,top_section,device,os,is_conversion,referrer,created_at,session_id").eq("email", guest.email).order("created_at", { ascending: false }).limit(500),
        ]);
        // Co polubił — przez sesje powiązane z tym emailem (drink_likes ma session_id)
        const sessions = [...new Set((vis.data || []).map((v: any) => v.session_id).filter(Boolean))];
        let liked: any[] = [];
        if (sessions.length) {
          const { data: lk } = await supabase.from("drink_likes").select("drink_id").in("session_id", sessions as string[]);
          const ids = [...new Set((lk || []).map((x: any) => x.drink_id).filter(Boolean))];
          if (ids.length) { const { data: dn } = await supabase.from("community_drinks").select("id,name").in("id", ids as string[]); liked = dn || []; }
        }
        setData({ drinks: drk.data || [], orders: ord.count || 0, reviews: rev.data || [], comments: cmt.data || [], visits: vis.data || [], liked });
      } catch { setData({ drinks: [], orders: 0, reviews: [], comments: [], visits: [], liked: [] }); }
    })();
  }, [guest.email, guest.name]);
  const tags: string[] = [...(guest.tags || [])];
  // Agregacje analityki
  const visits = data?.visits || [];
  const totalVisits = visits.length;
  const totalDur = visits.reduce((s, v) => s + (v.duration_seconds || 0), 0);
  const avgDur = totalVisits ? Math.round(totalDur / totalVisits) : 0;
  const lastVisit = visits[0]?.created_at ? new Date(visits[0].created_at).toLocaleDateString("it-IT") : "—";
  const fmtDur = (s: number) => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  const tally = (key: string) => { const m: Record<string, number> = {}; visits.forEach((v: any) => { const k = v[key]; if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const devices = tally("device"); const oses = tally("os"); const sections = tally("top_section"); const refs = tally("referrer");
  const topSection = sections[0]?.[0] || "—";
  const Svg = ({ d, vb = "0 0 24 24" }: { d: string; vb?: string }) => (
    <svg viewBox={vb} width="15" height="15" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}><path d={d} /></svg>
  );
  const osIco: Record<string, React.ReactNode> = {
    Android: <Svg d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.43-.65-3.03-1.01-4.71-1.01s-3.28.36-4.71 1.01L5.17 5.67c-.18-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85L5.92 9.48C2.92 11.07.97 14.05.5 17.5h23c-.47-3.45-2.42-6.43-5.42-8.02zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" />,
    iOS: <Svg d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />,
    macOS: <Svg d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />,
    Windows: <Svg d="M0 3.45L9.75 2.1v9.45H0V3.45zM10.95 1.95L24 0v11.4H10.95V1.95zM0 12.6h9.75v9.45L0 20.7V12.6zM10.95 12.6H24V24l-13.05-1.8V12.6z" />,
    Linux: <Svg d="M12 2C9.5 2 8 4 8 6.5c0 1.2.3 2 .3 3 0 1.3-1.3 2.2-2 3.7-.7 1.5-1.3 3-1.3 4.3 0 .8.5 1.2 1.2 1 .4 1 1.5 1.5 3 1.5h5c1.5 0 2.6-.5 3-1.5.7.2 1.2-.2 1.2-1 0-1.3-.6-2.8-1.3-4.3-.7-1.5-2-2.4-2-3.7 0-1 .3-1.8.3-3C15.7 4 14.5 2 12 2zm-1.5 4c.3 0 .5.3.5.7s-.2.8-.5.8-.5-.4-.5-.8.2-.7.5-.7zm3 0c.3 0 .5.3.5.7s-.2.8-.5.8-.5-.4-.5-.8.2-.7.5-.7zM12 9c.8 0 1.5.4 1.5.8 0 .3-.7.7-1.5.7s-1.5-.4-1.5-.7c0-.4.7-.8 1.5-.8z" />,
  };
  const devIco: Record<string, React.ReactNode> = {
    desktop: <Svg d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z" />,
    mobile: <Svg d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />,
    tablet: <Svg d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 13H5V7h14v10z" />,
  };
  const maxOf = (arr: [string, number][]) => arr[0]?.[1] || 1;
  const Bars = ({ arr, color, ico }: { arr: [string, number][]; color: string; ico?: Record<string, React.ReactNode> }) => (
    <div className="stats-countries">
      {arr.map(([k, n]) => (
        <div key={k} className="stats-country" style={{ cursor: "default" }}>
          <span className="stats-country-name" style={{ minWidth: 100 }}>{ico?.[k] || ""} {k}</span>
          <span className="stats-country-bar-wrap"><span className="stats-country-bar" style={{ width: `${(n / maxOf(arr)) * 100}%`, background: color }} /></span>
          <span className="stats-country-count">{n}</span>
        </div>
      ))}
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="amsg-avatar" style={{ width: 48, height: 48, fontSize: 20 }}>{(guest.name || "?").charAt(0).toUpperCase()}</span>
          <div><h3 style={{ margin: 0 }}>{guest.name} <FlagImg code={LANG_CC[guest.lang]} size={18} /></h3><p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>{guest.email}</p></div>
        </div>
        <div className="amsg-person" style={{ margin: "12px 0 4px" }}>
          {tags.map((tg) => <span key={tg} className="amsg-badge">{tg === "newsletter" ? "📧 Newsletter" : tg === "messaggi" ? "💬 Messaggi" : "⭐ Recensione"}</span>)}
        </div>
        {!data ? <p className="admin-empty">…</p> : (
          <>
            <div className="drk-stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
              <div className="drk-stat"><span className="drk-stat-ico">🍸</span><strong>{data.drinks.length}</strong><span>Drink creati</span></div>
              <div className="drk-stat"><span className="drk-stat-ico">📱</span><strong>{data.orders}</strong><span>Ordini</span></div>
              <div className="drk-stat"><span className="drk-stat-ico">💬</span><strong>{data.comments.length}</strong><span>Commenti</span></div>
              <div className="drk-stat"><span className="drk-stat-ico">⭐</span><strong>{data.reviews.length}</strong><span>Recensioni</span></div>
            </div>
            {data.drinks.length > 0 && (
              <div className="drk-stats-cmts" style={{ marginTop: 14 }}>
                <span className="admin-field-lbl">Drink creati</span>
                {data.drinks.map((d, i) => <div key={i} className="drk-cmt-row"><span>🍸 <strong>{d.name}</strong> · ♥{d.likes || 0} · 🍸{d.claimed_count || 0}</span></div>)}
              </div>
            )}
            {data.comments.length > 0 && (
              <div className="drk-stats-cmts" style={{ marginTop: 10 }}>
                <span className="admin-field-lbl">Commenti lasciati</span>
                {data.comments.slice(0, 8).map((c, i) => <div key={i} className="drk-cmt-row"><span style={{ opacity: 0.85 }}>{/^https?:\/\//.test(c.content) ? "🖼 GIF/foto" : c.content}</span></div>)}
              </div>
            )}
            {data.reviews.length > 0 && (
              <div className="drk-stats-cmts" style={{ marginTop: 10 }}>
                <span className="admin-field-lbl">Recensioni</span>
                {data.reviews.map((r, i) => <div key={i} className="drk-cmt-row"><span>{"★".repeat(r.stars || 0)} {r.content}</span></div>)}
              </div>
            )}
            {/* Analityka powiązana z emailem (wizyty / czas / urządzenie / sezioni) */}
            <div style={{ marginTop: 16 }}>
              <span className="admin-field-lbl">Comportamento sul sito</span>
              {totalVisits === 0 ? (
                <p style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>Nessun dato ancora — i dati di navigazione si collegano quando l'utente apre il sito dallo stesso browser dopo aver lasciato l'email.</p>
              ) : (
                <>
                  <div className="drk-stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 8 }}>
                    <div className="drk-stat"><span className="drk-stat-ico">👁</span><strong>{totalVisits}</strong><span>Visite totali</span></div>
                    <div className="drk-stat"><span className="drk-stat-ico">⏱</span><strong>{fmtDur(totalDur)}</strong><span>Tempo totale</span></div>
                    <div className="drk-stat"><span className="drk-stat-ico">📊</span><strong>{fmtDur(avgDur)}</strong><span>Media/visita</span></div>
                    <div className="drk-stat"><span className="drk-stat-ico">📍</span><strong style={{ fontSize: 15 }}>{topSection}</strong><span>Sezione preferita</span></div>
                    <div className="drk-stat"><span className="drk-stat-ico">🎯</span><strong>{visits.filter((v: any) => v.is_conversion).length}</strong><span>Conversioni</span></div>
                    <div className="drk-stat"><span className="drk-stat-ico">🗓</span><strong style={{ fontSize: 15 }}>{lastVisit}</strong><span>Ultima visita</span></div>
                  </div>
                  {devices.length > 0 && (<><span className="admin-field-lbl" style={{ display: "block", marginTop: 12 }}>Dispositivo</span><Bars arr={devices} color="rgba(232,146,124,0.7)" ico={devIco} /></>)}
                  {oses.length > 0 && (<><span className="admin-field-lbl" style={{ display: "block", marginTop: 10 }}>Sistema (Android / iPhone / PC)</span><Bars arr={oses} color="rgba(91,184,212,0.7)" ico={osIco} /></>)}
                  {sections.length > 0 && (<><span className="admin-field-lbl" style={{ display: "block", marginTop: 10 }}>Dove si ferma di più</span><Bars arr={sections} color="rgba(241,196,15,0.7)" /></>)}
                  {refs.length > 0 && (<><span className="admin-field-lbl" style={{ display: "block", marginTop: 10 }}>Come è arrivato</span><Bars arr={refs} color="rgba(155,213,236,0.6)" /></>)}
                </>
              )}
            </div>
            {data.liked.length > 0 && (
              <div className="drk-stats-cmts" style={{ marginTop: 12 }}>
                <span className="admin-field-lbl">❤️ Drink che ha messo "mi piace"</span>
                {data.liked.map((d, i) => <div key={i} className="drk-cmt-row"><span>♥ <strong>{d.name}</strong></span></div>)}
              </div>
            )}
          </>
        )}
        <div className="admin-modal-actions">
          <button className="admin-btn" onClick={() => { onWrite({ email: guest.email, name: guest.name, lang: guest.lang }); onClose(); }}>✉️ Scrivi (in italiano → tradotto)</button>
          <button className="admin-btn-ghost" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function OspitiPanel({ onWrite }: { onWrite: (g: { email: string; name?: string; lang?: string }) => void }) {
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<any>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [nl, msg, rev] = await Promise.all([
      supabase.from("newsletter").select("email,name,language,created_at").limit(2000),
      supabase.from("contact_messages").select("email,name,language,created_at").limit(2000),
      supabase.from("reviews").select("email,name,created_at").limit(2000),
    ]);
    const map: Record<string, any> = {};
    const add = (email: string, name: string, lang: string, tag: string, at?: string) => {
      const key = (email || "").trim().toLowerCase();
      if (!key || !key.includes("@")) return;
      const g = (map[key] ||= { email: key, name: name || key, lang: lang || "it", tags: new Set<string>(), last: at || "" });
      if (name && (!g.name || g.name === key)) g.name = name;
      if (lang) g.lang = lang;
      g.tags.add(tag);
      if (at && at > g.last) g.last = at;
    };
    (nl.data || []).forEach((x: any) => add(x.email, x.name, x.language, "newsletter", x.created_at));
    (msg.data || []).forEach((x: any) => { if (x.name !== "S'Historia") add(x.email, x.name, x.language, "messaggi", x.created_at); });
    (rev.data || []).forEach((x: any) => add(x.email, x.name, "it", "recensione", x.created_at));
    const list = Object.values(map).sort((a: any, b: any) => (b.last || "").localeCompare(a.last || ""));
    setGuests(list);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const filtered = q ? guests.filter((g) => g.email.includes(q) || (g.name || "").toLowerCase().includes(q)) : guests;
  const tagCls: Record<string, string> = { newsletter: "amsg-badge", messaggi: "amsg-badge-sky", recensione: "amsg-badge-gold" };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Ospiti</h1>
        <span className="admin-count">{guests.length} contatti</span>
      </header>
      <div className="amsg-search" style={{ maxWidth: 360, marginBottom: 18 }}>
        <span className="amsg-search-ico">🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome o email…" />
        {search && <button className="amsg-search-clear" onClick={() => setSearch("")}>✕</button>}
      </div>
      {loading ? <Skeleton /> : (
        <div className="ospiti-grid">
          {detail && <GuestDetailModal guest={detail} onClose={() => setDetail(null)} onWrite={onWrite} />}
          {filtered.map((g) => (
            <div key={g.email} className="ospiti-card" onClick={(e) => { if ((e.target as HTMLElement).closest("button")) return; setDetail(g); }}>
              <div className="ospiti-card-top">
                <span className="amsg-avatar">{(g.name || "?").charAt(0).toUpperCase()}</span>
                <div className="ospiti-card-id">
                  <h4>{g.name} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 12 }}><FlagImg code={LANG_CC[g.lang]} size={16} /></span></h4>
                  <p>{g.email}</p>
                </div>
              </div>
              <div className="amsg-person">
                {[...g.tags].map((tg: string) => <span key={tg} className={`amsg-badge ${tagCls[tg] || ""}`}>{tg === "newsletter" ? "📧" : tg === "messaggi" ? "💬" : "⭐"} {tg}</span>)}
              </div>
              <div className="ospiti-card-actions">
                <button className="admin-btn-sm" onClick={() => setDetail(g)}>📊 Dettagli</button>
                <button className="admin-btn-sm" onClick={() => onWrite({ email: g.email, name: g.name, lang: g.lang })}>✉️ Scrivi</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="admin-empty">{search ? "Nessun risultato." : "Nessun contatto ancora."}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Newsletter Panel (subskrybenci + powiązania) ─────────────────────────────
function NewsletterPanel() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assoc, setAssoc] = useState<{ drinks: Set<string>; orders: Set<string>; reviews: Set<string>; msgs: Set<string> }>({ drinks: new Set(), orders: new Set(), reviews: new Set(), msgs: new Set() });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [s, drk, ord, rev, msg] = await Promise.all([
      supabase.from("newsletter").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("community_drinks").select("author_name").limit(1000),
      supabase.from("drink_orders").select("author_name").limit(1000),
      supabase.from("reviews").select("email").limit(1000),
      supabase.from("contact_messages").select("email").limit(1000),
    ]);
    setSubs(s.data || []);
    const lc = (v: any) => (v || "").toString().toLowerCase();
    setAssoc({
      drinks: new Set((drk.data || []).map((d: any) => lc(d.author_name))),
      orders: new Set((ord.data || []).map((d: any) => lc(d.author_name))),
      reviews: new Set((rev.data || []).map((d: any) => lc(d.email))),
      msgs: new Set((msg.data || []).map((d: any) => lc(d.email))),
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel("newsletter_rt").on("postgres_changes", { event: "*", schema: "public", table: "newsletter" }, () => load(true)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q ? subs.filter((s) => (s.email || "").toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q)) : subs;

  const remove = async (id: string) => {
    if (confirm("Rimuovere questo iscritto?")) { await supabase.from("newsletter").delete().eq("id", id); load(true); }
  };

  // ── Broadcast: powiadom wszystkich subskrybentów o nowym drinku/evencie ──
  const [bcOpen, setBcOpen] = useState(false);
  const [bc, setBc] = useState<{ kind: "drink" | "event"; title: string; description: string; image_url: string; when_text: string }>({ kind: "drink", title: "", description: "", image_url: "", when_text: "" });
  const [bcBusy, setBcBusy] = useState(false);
  const [bcMsg, setBcMsg] = useState("");
  const sendBroadcast = async () => {
    if (!bc.title.trim()) { setBcMsg("Inserisci un titolo."); return; }
    if (!confirm(`Inviare questa email a tutti i ${subs.length} iscritti?`)) return;
    setBcBusy(true); setBcMsg("Invio in corso…");
    try {
      const res = await fetch("/api/notify-subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bc, admin_pin: "shistoria2026" }),
      });
      const j = await res.json();
      if (j.ok) {
        setBcMsg(`✓ Inviato a ${j.recipients} iscritti.`);
        setTimeout(() => { setBcOpen(false); setBcMsg(""); setBc({ kind: "drink", title: "", description: "", image_url: "", when_text: "" }); }, 2200);
      } else {
        setBcMsg(`Errore: ${j.error || "invio non riuscito"}`);
      }
    } catch (e: any) {
      setBcMsg(`Errore: ${e?.message || "rete"}`);
    }
    setBcBusy(false);
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Newsletter</h1>
        <span className="admin-count">{subs.length} iscritti</span>
        <button className="admin-btn" style={{ marginLeft: "auto" }} onClick={() => setBcOpen(true)}>📣 Invia a tutti</button>
      </header>

      {bcOpen && (
        <div className="admin-modal-overlay" onClick={() => !bcBusy && setBcOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📣 Notifica agli iscritti</h3>
            <p style={{ opacity: 0.65, fontSize: 13, marginTop: -10 }}>
              L'email viene tradotta automaticamente nella lingua di ogni iscritto ({subs.length} destinatari).
            </p>
            <div className="bc-kind-switch" style={{ display: "flex", gap: 8, margin: "4px 0 14px" }}>
              <button className={`admin-btn-sm ${bc.kind === "drink" ? "" : "admin-btn-ghost"}`} onClick={() => setBc((b) => ({ ...b, kind: "drink" }))}>🍸 Nuovo drink</button>
              <button className={`admin-btn-sm ${bc.kind === "event" ? "" : "admin-btn-ghost"}`} onClick={() => setBc((b) => ({ ...b, kind: "event" }))}>🎉 Nuovo evento</button>
            </div>
            <label className="admin-field">
              <span>Titolo *</span>
              <input value={bc.title} onChange={(e) => setBc((b) => ({ ...b, title: e.target.value }))} placeholder={bc.kind === "drink" ? "Es. Negroni d'Autunno" : "Es. Serata Jazz & Cocktail"} />
            </label>
            {bc.kind === "event" && (
              <label className="admin-field">
                <span>Quando</span>
                <input value={bc.when_text} onChange={(e) => setBc((b) => ({ ...b, when_text: e.target.value }))} placeholder="Es. Venerdì 20 giugno, ore 21:00" />
              </label>
            )}
            <label className="admin-field">
              <span>Descrizione</span>
              <textarea rows={3} value={bc.description} onChange={(e) => setBc((b) => ({ ...b, description: e.target.value }))} placeholder="Breve descrizione…" />
            </label>
            <label className="admin-field">
              <span>URL immagine (facoltativo)</span>
              <input value={bc.image_url} onChange={(e) => setBc((b) => ({ ...b, image_url: e.target.value }))} placeholder="https://…" />
            </label>
            {bcMsg && <p style={{ fontWeight: 600, fontSize: 13, margin: "4px 0 0" }}>{bcMsg}</p>}
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={sendBroadcast} disabled={bcBusy}>{bcBusy ? "Invio…" : `📣 Invia a ${subs.length} iscritti`}</button>
              <button className="admin-btn-ghost" onClick={() => setBcOpen(false)} disabled={bcBusy}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      <div className="amsg-search" style={{ maxWidth: 360, marginBottom: 18 }}>
        <span className="amsg-search-ico">🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome o email…" />
        {search && <button className="amsg-search-clear" onClick={() => setSearch("")}>✕</button>}
      </div>
      {loading ? <Skeleton /> : (
        <div className="admin-orders">
          {filtered.map((s) => {
            const email = (s.email || "").toLowerCase();
            const name = (s.name || "").toLowerCase();
            const tags: { label: string; cls: string }[] = [];
            if (assoc.drinks.has(name)) tags.push({ label: "🍸 Drink", cls: "amsg-badge-coral" });
            if (assoc.orders.has(name)) tags.push({ label: "📱 Ordini", cls: "amsg-badge-sky" });
            if (assoc.reviews.has(email)) tags.push({ label: "⭐ Recensione", cls: "amsg-badge-gold" });
            if (assoc.msgs.has(email)) tags.push({ label: "💬 Messaggi", cls: "" });
            return (
              <div key={s.id} className="admin-order">
                <div className="admin-order-info">
                  <h4>{s.name || "—"} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 13 }}>🌐 {s.language || "it"}</span></h4>
                  <p style={{ opacity: 0.7 }}>{s.email}</p>
                  <div className="amsg-person" style={{ marginTop: 6 }}>
                    {tags.length > 0 ? tags.map((t, i) => <span key={i} className={`amsg-badge ${t.cls}`}>{t.label}</span>) : <span className="amsg-badge">Solo newsletter</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, opacity: 0.5 }}>{s.created_at ? new Date(s.created_at).toLocaleDateString("it-IT") : ""}</span>
                  <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(s.id)}>🗑</button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="admin-empty">{search ? "Nessun risultato." : "Nessun iscritto alla newsletter."}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Reviews Panel (zarządzanie recenzjami lokalnymi) ─────────────────────────
function ReviewsPanel() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", content: "", stars: 5, source: "Google", photo_url: "", language: "it" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
    setReviews(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string, val: boolean) => {
    await supabase.from("reviews").update({ is_approved: val }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (confirm("Eliminare questa recensione?")) {
      await supabase.from("reviews").delete().eq("id", id);
      load();
    }
  };

  // Upload zdjęcia recenzji do bucketa "assets"
  const uploadPhoto = async (file: File) => {
    setBusy(true);
    try {
      const path = `reviews/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
      if (error) { alert("Errore upload: " + error.message); return; }
      const { data } = supabase.storage.from("assets").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
    } finally { setBusy(false); }
  };

  // Dodanie recenzji zewnętrznej (Google/TripAdvisor) ręcznie — od razu approvata
  const addExternal = async () => {
    if (!form.name.trim() || !form.content.trim()) { alert("Nome e testo obbligatori."); return; }
    setBusy(true);
    try {
      await supabase.from("reviews").insert({
        name: form.name.trim(),
        content: form.content.trim(),
        stars: Math.max(1, Math.min(5, form.stars)),
        source: form.source,
        photo_url: form.photo_url || null,
        language: form.language || "it",
        is_approved: true,
      });
      setForm({ name: "", content: "", stars: 5, source: "Google", photo_url: "", language: "it" });
      setAddOpen(false);
      load();
    } catch (e: any) { alert("Errore: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Recensioni</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="admin-count">{reviews.filter(r => !r.is_approved).length} in attesa</span>
          <button className="admin-btn" onClick={() => setAddOpen(true)}>+ Recensione esterna</button>
        </div>
      </header>

      {addOpen && (
        <div className="admin-modal-overlay" onClick={() => !busy && setAddOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px" }}>Aggiungi recensione (Google / TripAdvisor)</h3>
            <p style={{ opacity: 0.65, fontSize: 13, marginTop: -6 }}>
              Copia una recensione reale da Google o TripAdvisor e incollala qui — apparirà subito sul sito.
            </p>
            <div style={{ display: "flex", gap: 8, margin: "4px 0 12px" }}>
              {["Google", "TripAdvisor", "Locale"].map((s) => (
                <button key={s} className={`admin-btn-sm ${form.source === s ? "" : "admin-btn-ghost"}`} onClick={() => setForm((f) => ({ ...f, source: s }))}>{s}</button>
              ))}
            </div>
            <label className="admin-field"><span>Nome cliente *</span>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Es. Marco R." />
            </label>
            <label className="admin-field"><span>Testo recensione *</span>
              <textarea rows={3} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="La loro esperienza…" />
            </label>
            <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "4px 0 12px" }}>
              <div className="rec-star-pick" style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, stars: n }))}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: n <= form.stars ? "#f1c40f" : "#555" }}>★</button>
                ))}
              </div>
              <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} style={{ padding: "6px 10px", borderRadius: 8 }}>
                {["it", "pl", "en", "de", "fr", "es"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <label className="admin-field"><span>Foto (facoltativo)</span>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
            </label>
            {form.photo_url && <img src={form.photo_url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />}
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={addExternal} disabled={busy}>{busy ? "…" : "Aggiungi recensione"}</button>
              <button className="admin-btn-ghost" onClick={() => setAddOpen(false)} disabled={busy}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <Skeleton /> : (
        <div className="admin-orders">
          {reviews.map((r) => (
            <div key={r.id} className={`admin-order ${r.is_approved ? "" : ""}`}>
              {r.photo_url && <img src={r.photo_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />}
              <div className="admin-order-info">
                <h4>{r.name} <span style={{ color: "#f1c40f" }}>{"★".repeat(r.stars)}</span> <span style={{ opacity: 0.5, fontSize: 12 }}>{r.source}</span></h4>
                <span>{r.email || "—"} · 🌐 {r.language}</span>
                <span className="admin-order-time">{new Date(r.created_at).toLocaleString("it-IT")}</span>
              </div>
              <div style={{ flex: 1, fontSize: 13, opacity: 0.8, fontStyle: "italic" }}>
                "{r.content}"
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className={`admin-btn-sm ${r.is_approved ? "admin-btn-gold" : ""}`} onClick={() => approve(r.id, !r.is_approved)}>
                  {r.is_approved ? "★ Approvata" : "☆ Approva"}
                </button>
                <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(r.id)}>✕</button>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <p className="admin-empty">Nessuna recensione.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Stats Panel (statystyki odwiedzin) ───────────────────────────────────────
// ─── Hours Panel (edytor godzin otwarcia — zmiana NA ŻYWO) ───────────────────
function HoursPanel() {
  const [rows, setRows] = useState<{ day: string; time: string; closed: boolean }[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [closedDates, setClosedDates] = useState<string[]>([]); // YYYY-MM-DD chiusure straordinarie
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("opening_hours").select("*").eq("id", 1).single();
    setRows(data?.hours || [{ day: "Lun — Dom", time: "12:00 — 14:30 · 19:00 — 23:00", closed: false }, { day: "Martedì", time: "chiuso", closed: true }]);
    const sl = data?.time_slots || ["12:00","12:30","13:00","13:30","14:00","14:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00"];
    setSlots(sl);
    setClosedDates(data?.closed_dates || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Auto-generacja slotów rezerwacji co 30 min z godzin otwarcia (bez ręcznego wpisywania)
  const genSlots = (rws: { day: string; time: string; closed: boolean }[]): string[] => {
    const set = new Set<string>();
    const re = /(\d{1,2}):(\d{2})\s*[—–\-]\s*(\d{1,2}):(\d{2})/g;
    rws.forEach((r) => {
      if (r.closed) return;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(r.time))) {
        let cur = +m[1] * 60 + +m[2]; const end = +m[3] * 60 + +m[4];
        while (cur <= end) { set.add(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`); cur += 30; }
      }
    });
    return [...set].sort();
  };

  const save = async () => {
    const time_slots = genSlots(rows);
    await supabase.from("opening_hours").upsert({ id: 1, hours: rows, time_slots, closed_dates: closedDates, updated_at: new Date().toISOString() });
    setSlots(time_slots);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  // Chiusura straordinaria — zamknij dany dzień jednym klikiem (zapis natychmiast → realtime na stronie)
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const toggleClosedDate = async (dateStr: string) => {
    const next = closedDates.includes(dateStr) ? closedDates.filter((d) => d !== dateStr) : [...closedDates, dateStr].sort();
    setClosedDates(next);
    await supabase.from("opening_hours").upsert({ id: 1, hours: rows, time_slots: genSlots(rows), closed_dates: next, updated_at: new Date().toISOString() });
  };

  const updRow = (i: number, k: string, v: any) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const addRow = () => setRows((r) => [...r, { day: "", time: "", closed: false }]);
  const delRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  if (loading) return <div className="admin-panel"><Skeleton /></div>;

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Orari di apertura</h1>
        <button className="admin-btn" onClick={save}>{saved ? "✓ Salvato — aggiornato sul sito" : "Salva e pubblica →"}</button>
      </header>
      <p style={{ opacity: 0.6, fontSize: 13, marginTop: -16, marginBottom: 24 }}>Le modifiche appaiono sul sito <strong>in tempo reale</strong>, senza ricaricare la pagina.</p>

      <div className="hours-rows">
        {rows.map((row, i) => (
          <div key={i} className="hours-row">
            <input className="hours-day" value={row.day} placeholder="Giorni (es. Lun — Dom)" onChange={(e) => updRow(i, "day", e.target.value)} />
            <input className="hours-time" value={row.time} placeholder="Orario (es. 12:00 — 14:30)" onChange={(e) => updRow(i, "time", e.target.value)} />
            <label className="hours-closed"><input type="checkbox" checked={row.closed} onChange={(e) => updRow(i, "closed", e.target.checked)} /> Chiuso</label>
            <button className="admin-btn-sm admin-btn-danger" onClick={() => delRow(i)}>✕</button>
          </div>
        ))}
        <button className="admin-btn-ghost" onClick={addRow}>+ Aggiungi riga</button>
      </div>

      <p className="hours-auto-note">⏱ Gli orari prenotabili si generano <strong>automaticamente ogni 30 min</strong> dagli orari di apertura qui sopra. Non devi inserirli a mano.</p>

      {/* Chiusura straordinaria — zamknij konkretny dzień jednym klikiem */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Chiusura straordinaria</h2>
        <p style={{ opacity: 0.6, fontSize: 13, margin: "0 0 14px" }}>Chiudi un giorno specifico con un clic. Appare subito sul sito (in tempo reale).</p>
        <div className="hours-quick">
          {(() => {
            const mk = (off: number) => { const d = new Date(); d.setDate(d.getDate() + off); return fmtDate(d); };
            const opts: [string, string][] = [["Oggi", mk(0)], ["Domani", mk(1)], ["Dopodomani", mk(2)]];
            return (
              <>
                {opts.map(([lbl, ds]) => (
                  <button key={ds} className={`hours-quick-btn ${closedDates.includes(ds) ? "is-closed" : ""}`} onClick={() => toggleClosedDate(ds)}>
                    {closedDates.includes(ds) ? `✓ ${lbl} chiuso` : `Chiudi ${lbl.toLowerCase()}`}
                  </button>
                ))}
                <input type="date" className="hours-date-input" onChange={(e) => { if (e.target.value) toggleClosedDate(e.target.value); }} />
              </>
            );
          })()}
        </div>
        {closedDates.length > 0 && (
          <div className="hours-closed-list">
            {closedDates.map((d) => (
              <span key={d} className="hours-closed-chip">
                {new Date(d + "T00:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}
                <button onClick={() => toggleClosedDate(d)}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Globo 3D (WebGL) — komponent w src/components/StatsGlobe.tsx ─────────────

// ─── Wykresy statystyk (Chart.js z CDN — bez bundlowania) ─────────────────────
function StatsCharts({ visits, byCountry }: { visits: any[]; byCountry: any[] }) {
  const lineRef = useRef<HTMLCanvasElement>(null);
  const doughRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    const loadChart = (): Promise<any> => new Promise((res, rej) => {
      const w = window as any;
      if (w.Chart) return res(w.Chart);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
      s.onload = () => res((window as any).Chart);
      s.onerror = () => rej(new Error("Chart.js load failed"));
      document.head.appendChild(s);
    });
    (async () => {
      try {
        const Chart = await loadChart();
        if (cancelled) return;
        charts.current.forEach((c) => { try { c.destroy(); } catch {} });
        charts.current = [];
        const grid = "rgba(148,163,184,0.12)", tick = "#94a3b8";
        // Wizyty wg dnia
        const byDay: Record<string, number> = {};
        visits.forEach((v) => { const d = (v.created_at || "").slice(0, 10); if (d) byDay[d] = (byDay[d] || 0) + 1; });
        const days = Object.keys(byDay).sort();
        if (lineRef.current) {
          charts.current.push(new Chart(lineRef.current, {
            type: "line",
            data: { labels: days.map((d) => d.slice(5)), datasets: [{ label: "Visite", data: days.map((d) => byDay[d]), borderColor: "#E8927C", backgroundColor: "rgba(232,146,124,0.15)", fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: tick, maxTicksLimit: 8 } }, y: { grid: { color: grid }, ticks: { color: tick, precision: 0 }, beginAtZero: true } } },
          }));
        }
        // Top paesi (doughnut)
        const top = byCountry.slice(0, 6);
        if (doughRef.current && top.length) {
          charts.current.push(new Chart(doughRef.current, {
            type: "doughnut",
            data: { labels: top.map((c) => c.name), datasets: [{ data: top.map((c) => c.count), backgroundColor: ["#E8927C", "#5BB8D4", "#F4D03F", "#9DC85A", "#C8102E", "#A78BFA"], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { color: tick, boxWidth: 12, padding: 10, font: { size: 11 } } } } },
          }));
        }
      } catch { /* CDN offline — wykresy pomijamy, reszta statystyk działa */ }
    })();
    return () => { cancelled = true; charts.current.forEach((c) => { try { c.destroy(); } catch {} }); charts.current = []; };
  }, [visits, byCountry]);

  return (
    <div className="stats-charts">
      <div className="stats-chart-card"><h3>📈 Visite nel tempo</h3><div className="stats-chart-canvas"><canvas ref={lineRef} /></div></div>
      <div className="stats-chart-card"><h3>🌍 Top paesi</h3><div className="stats-chart-canvas"><canvas ref={doughRef} /></div></div>
    </div>
  );
}

function StatsPanel() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"today" | "week" | "month" | "prevmonth" | "all">("month");
  const [counts, setCounts] = useState({ orders: 0, drinks: 0, messages: 0, reviews: 0 });
  const [visits, setVisits] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [popCountry, setPopCountry] = useState<string | null>(null);
  const [online, setOnline] = useState(0);

  // „Online ora" — Supabase Realtime Presence (te same kanaly co strona publiczna)
  useEffect(() => {
    const ch = supabase.channel("online-visitors");
    ch.on("presence", { event: "sync" }, () => {
      try { setOnline(Object.keys(ch.presenceState()).length); } catch {}
    }).subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, []);

  // Zakres dat → from/to ISO
  const rangeDates = () => {
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    if (range === "today") return { from: startOfDay(now), to: now };
    if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: d, to: now }; }
    if (range === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { from: d, to: now }; }
    if (range === "prevmonth") { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); return { from: f, to: t }; }
    return { from: new Date(2020, 0, 1), to: now };
  };

  const load = async () => {
    setLoading(true);
    const { from, to } = rangeDates();
    const fromIso = from.toISOString(), toIso = to.toISOString();
    const [o, d, m, r, v, s] = await Promise.all([
      supabase.from("drink_orders").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("community_drinks").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("reviews").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("analytics_visits").select("*").gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("analytics_sections").select("*").gte("created_at", fromIso).lte("created_at", toIso),
    ]);
    setCounts({ orders: o.count || 0, drinks: d.count || 0, messages: m.count || 0, reviews: r.count || 0 });
    setVisits(v.data || []);
    setSections(s.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  // Agregacje
  const byCountry = React.useMemo(() => {
    const map: Record<string, { code: string; name: string; count: number; durations: number[]; sections: Record<string, number>; conversions: number }> = {};
    for (const v of visits) {
      const code = v.country || "??";
      const e = (map[code] ||= { code, name: v.country_name || (code !== "??" ? code : "Sconosciuto"), count: 0, durations: [], sections: {}, conversions: 0 });
      e.count++; if (v.duration_seconds) e.durations.push(v.duration_seconds);
      if (v.top_section) e.sections[v.top_section] = (e.sections[v.top_section] || 0) + 1;
      if (v.is_conversion) e.conversions++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [visits]);

  const totalVisits = visits.length;
  const maxCount = byCountry[0]?.count || 1;
  const conversions = visits.filter((v) => v.is_conversion).length;
  const emailVisits = visits.filter((v) => v.referrer === "email" || v.utm_source === "email").length;
  const convRate = totalVisits ? Math.round((conversions / totalVisits) * 100) : 0;
  const avgDuration = totalVisits ? Math.round(visits.reduce((s, v) => s + (v.duration_seconds || 0), 0) / totalVisits) : 0;
  const intensity = (c: number) => { const r = c / maxCount; return `rgba(232,146,124,${0.15 + r * 0.85})`; };
  const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;
  const popData = byCountry.find((c) => c.code === popCountry);

  const RANGES: { id: typeof range; label: string }[] = [
    { id: "today", label: "Oggi" }, { id: "week", label: "7 giorni" },
    { id: "month", label: "Questo mese" }, { id: "prevmonth", label: "Mese scorso" }, { id: "all", label: "Tutto" },
  ];

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Statistiche</h1>
        <div className="stats-range">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? "active" : ""} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </div>
      </header>

      {loading ? <Skeleton /> : (
        <>
          {/* KPI ogólne */}
          <div className="stats-kpis">
            <div className="stats-kpi stats-kpi-online"><span className="stats-kpi-val"><span className="stats-online-dot" />{online}</span><span className="stats-kpi-lbl">Online ora</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{totalVisits}</span><span className="stats-kpi-lbl">Visite</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{conversions}</span><span className="stats-kpi-lbl">Conversioni ({convRate}%)</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{emailVisits}</span><span className="stats-kpi-lbl">Da email</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{fmtDur(avgDuration)}</span><span className="stats-kpi-lbl">Tempo medio</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{counts.orders}</span><span className="stats-kpi-lbl">Ordini QR</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{counts.messages}</span><span className="stats-kpi-lbl">Messaggi</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{counts.drinks}</span><span className="stats-kpi-lbl">Drink creati</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{counts.reviews}</span><span className="stats-kpi-lbl">Recensioni</span></div>
          </div>

          {/* Wykresy Chart.js */}
          <ErrorBoundary fallback={() => null}>
            <StatsCharts visits={visits} byCountry={byCountry} />
          </ErrorBoundary>

          {/* Kraje — interaktywne słupki z intensywnością */}
          <div className="stats-section">
            <h3>Da dove arrivano i visitatori</h3>
            {byCountry.length === 0 ? <p className="admin-empty">Nessun dato per questo periodo.</p> : (
              <div className="stats-geo">
                <div className="stats-globe"><ErrorBoundary fallback={() => <div className="stats-globe-loading">🌍</div>}><StatsGlobe countries={byCountry} /></ErrorBoundary></div>
                <div className="stats-countries">
                  {byCountry.map((c) => (
                    <button key={c.code} className="stats-country" onClick={() => setPopCountry(c.code)}>
                      <span className="stats-country-flag"><FlagImg code={c.code} /></span>
                      <span className="stats-country-name">{c.name}</span>
                      <span className="stats-country-bar-wrap">
                        <span className="stats-country-bar" style={{ width: `${(c.count / maxCount) * 100}%`, background: intensity(c.count) }} />
                      </span>
                      <span className="stats-country-count">{c.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Popout kraju */}
          {popData && (
            <div className="stats-pop-overlay" onClick={() => setPopCountry(null)}>
              <div className="stats-pop" onClick={(e) => e.stopPropagation()}>
                <button className="stats-pop-close" onClick={() => setPopCountry(null)}>×</button>
                <div className="stats-pop-head"><span style={{ fontSize: 40 }}><FlagImg code={popData.code} size={40} /></span><h2>{popData.name}</h2></div>
                <div className="stats-pop-grid">
                  <div><span className="stats-pop-val">{popData.count}</span><span className="stats-pop-lbl">Visitatori</span></div>
                  <div><span className="stats-pop-val">{popData.durations.length ? fmtDur(Math.round(popData.durations.reduce((a,b)=>a+b,0)/popData.durations.length)) : "—"}</span><span className="stats-pop-lbl">Tempo medio</span></div>
                  <div><span className="stats-pop-val">{popData.conversions}</span><span className="stats-pop-lbl">Conversioni</span></div>
                </div>
                <div className="stats-pop-sec">
                  <span className="stats-pop-seclbl">Sezioni preferite</span>
                  {Object.entries(popData.sections).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([sec, n]) => (
                    <div key={sec} className="stats-pop-secrow"><span>{sec}</span><span>{n}</span></div>
                  ))}
                  {Object.keys(popData.sections).length === 0 && <p className="admin-empty">—</p>}
                </div>
              </div>
            </div>
          )}

          {/* Sekcje — gdzie się zatrzymują */}
          <div className="stats-section">
            <h3>Sezioni più visitate</h3>
            {(() => {
              const secMap: Record<string, number> = {};
              for (const v of visits) if (v.top_section) secMap[v.top_section] = (secMap[v.top_section] || 0) + 1;
              const arr = Object.entries(secMap).sort((a,b)=>b[1]-a[1]);
              const mx = arr[0]?.[1] || 1;
              return arr.length ? (
                <div className="stats-countries">
                  {arr.map(([sec, n]) => (
                    <div key={sec} className="stats-country" style={{ cursor: "default" }}>
                      <span className="stats-country-name" style={{ minWidth: 120 }}>{sec}</span>
                      <span className="stats-country-bar-wrap"><span className="stats-country-bar" style={{ width: `${(n/mx)*100}%`, background: "rgba(91,184,212,0.7)" }} /></span>
                      <span className="stats-country-count">{n}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="admin-empty">Nessun dato.</p>;
            })()}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function AdminStyles() {
  return (
    <style>{`
      /* ── Pod-zakładki (Drink & Ordini) ── */
      .admin-subtabs-wrap { display:flex; flex-direction:column; gap:0; }
      .admin-subtabs { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; }
      .admin-subtabs button { padding:10px 18px; border-radius:999px; border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.7); font-weight:700; font-size:14px; cursor:pointer;
        transition:all .25s cubic-bezier(.2,.8,.2,1); }
      .admin-subtabs button:hover { background:rgba(232,146,124,0.14); color:#fff; }
      .admin-subtabs button.active { background:var(--cx-accent,#E8927C); color:#1a1a1a; border-color:transparent; box-shadow:0 6px 18px rgba(232,146,124,0.3); }
      .admin-theme-light .admin-subtabs button { background:rgba(0,0,0,0.04); color:#445; border-color:rgba(0,0,0,0.1); }
      .admin-theme-light .admin-subtabs button.active { background:#E8927C; color:#fff; }

      /* ── MOTYW: zmienne (ciemny domyślnie, jasny przez .admin-theme-light) ── */
      .admin-theme-dark, .admin-theme-light { --a-bg:#0a0e14; --a-text:#ffffff; }
      .admin-theme-light { --a-bg:#f4f6f9; --a-text:#15202b; }
      /* Jasny motyw — nadpisania kluczowych powierzchni */
      .admin-theme-light.admin, .admin-theme-light.admin-login { background:#f4f6f9 !important; color:#15202b !important; }
      .admin-theme-light .admin-nav { background:#ffffff !important; border-color:rgba(0,0,0,0.08) !important; }
      .admin-theme-light .admin-logo h2, .admin-theme-light .admin-panel-head h1, .admin-theme-light .admin-nav nav button { color:#15202b !important; }
      .admin-theme-light .admin-nav nav button { background:rgba(0,0,0,0.03) !important; }
      .admin-theme-light .admin-nav nav button:hover { background:rgba(232,146,124,0.14) !important; }
      .admin-theme-light .admin-table, .admin-theme-light .admin-order, .admin-theme-light .admin-event-card, .admin-theme-light .admin-drink-card, .admin-theme-light .stats-country, .admin-theme-light .stats-kpi, .admin-theme-light .amsg-list, .admin-theme-light .amsg-conv { background:#ffffff !important; border-color:rgba(0,0,0,0.08) !important; color:#15202b !important; }
      .admin-theme-light .admin-table th { color:rgba(0,0,0,0.55) !important; border-color:rgba(0,0,0,0.1) !important; }
      .admin-theme-light .admin-table td { border-color:rgba(0,0,0,0.06) !important; color:#15202b !important; }
      .admin-theme-light .admin-modal { background:#ffffff !important; color:#15202b !important; }
      .admin-theme-light .admin-modal-actions { background:linear-gradient(to top,#ffffff 70%,rgba(255,255,255,0)) !important; }
      .admin-theme-light .admin-form input, .admin-theme-light .admin-form textarea, .admin-theme-light .admin-form select, .admin-theme-light .menu-sel, .admin-theme-light .hours-slots, .admin-theme-light .hours-day, .admin-theme-light .hours-time { background:#f4f6f9 !important; color:#15202b !important; border-color:rgba(0,0,0,0.15) !important; }
      .admin-theme-light .admin-btn-ghost, .admin-theme-light .admin-btn-sm { color:#15202b !important; border-color:rgba(0,0,0,0.15) !important; }
      .admin-theme-light .admin-form label, .admin-theme-light .stats-kpi-lbl, .admin-theme-light .admin-count { color:rgba(0,0,0,0.55) !important; }
      .admin-theme-light .amsg-msg.them { background:#eceff3 !important; color:#15202b !important; }
      /* przełącznik motywu */
      .admin-theme-toggle { margin-top:auto; padding:12px 16px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:inherit; font-size:13px; cursor:pointer; transition:all .2s; }
      .admin-theme-toggle:hover { background:rgba(232,146,124,0.15); }
      .admin-theme-light .admin-theme-toggle { background:rgba(0,0,0,0.04); border-color:rgba(0,0,0,0.12); color:#15202b; }
      /* ── Skeleton loading ── */
      .admin-skel { display:flex; flex-direction:column; gap:14px; padding:8px 0; }
      .admin-skel-row { display:flex; gap:14px; align-items:center; }
      .admin-skel-lines { flex:1; display:flex; flex-direction:column; gap:8px; }
      .admin-skel-box { border-radius:10px; background:linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.05) 63%); background-size:400% 100%; animation:adminShimmer 1.4s ease infinite; }
      .admin-theme-light .admin-skel-box { background:linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.1) 37%, rgba(0,0,0,0.05) 63%); background-size:400% 100%; }
      .admin-skel-thumb { width:52px; height:52px; flex-shrink:0; border-radius:12px; }
      .admin-skel-line { height:14px; } .admin-skel-line-sm { height:10px; opacity:0.7; }
      @keyframes adminShimmer { 0%{ background-position:100% 0; } 100%{ background-position:-100% 0; } }

      .admin-login { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0a0e14; color:#fff; font-family:system-ui; }
      .admin-login-card { text-align:center; padding:48px; border-radius:24px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); max-width:360px; width:100%; }
      .admin-login-card h1 { font-size:36px; margin:0 0 8px; }
      .admin-login-card p { opacity:0.6; margin:0 0 32px; }
      .admin-login-card input { width:100%; padding:14px 18px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:#fff; font-size:16px; margin-bottom:16px; }
      .admin-login-card button { width:100%; padding:14px; border-radius:12px; background:#E8927C; color:#fff; font-weight:700; font-size:14px; border:none; cursor:pointer; }
      .admin-login-card input.pin-err { border-color:#e74c3c; animation:adminShake .3s; }
      @keyframes adminShake { 0%,100%{ transform:translateX(0);} 25%{ transform:translateX(-5px);} 75%{ transform:translateX(5px);} }
      .admin-pin-error { display:block; color:#e74c3c; font-size:13px; font-weight:600; margin:-6px 0 14px; }

      .admin { display:grid; grid-template-columns:260px 1fr; min-height:100vh; background:#0a0e14; color:#fff; font-family:system-ui; }
      .admin-nav-toggle { display:none; }
      @media (max-width:768px) {
        .admin { grid-template-columns:1fr; }
        /* nav jako wysuwany drawer z lewej */
        .admin-nav { position:fixed; top:0; left:0; bottom:0; width:260px; z-index:200; transform:translateX(-100%);
          transition:transform .3s cubic-bezier(.2,.8,.2,1); border-right:1px solid rgba(255,255,255,0.1); border-bottom:none; padding:24px 18px; overflow-y:auto; }
        .admin-nav.is-open { transform:translateX(0); box-shadow:0 0 60px rgba(0,0,0,0.6); }
        .admin-nav nav { flex-direction:column; gap:6px; }
        .admin-nav nav button { padding:14px 16px; font-size:15px; }
        .admin-nav-toggle { display:flex; align-items:center; justify-content:center; position:fixed; top:14px; left:14px; z-index:210;
          width:46px; height:46px; border-radius:14px; background:#E8927C; color:#fff; border:none; font-size:20px; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,0.4); }
        .admin-main { padding:70px 16px 16px; max-height:none; }
        .admin-panel-head { flex-direction:column; align-items:flex-start; gap:12px; }
        .admin-panel-head h1 { font-size:22px; }
        .admin-table { font-size:12px; }
        .admin-grid { grid-template-columns:1fr !important; }
        .admin-order { flex-direction:column; gap:12px; }
        .admin-modal { width:100vw; max-width:100vw; max-height:92vh; border-radius:20px 20px 0 0; padding:24px 20px; }
        .admin-modal-overlay { align-items:flex-end; padding:0; }
        .admin-table table { min-width:520px; }
        .admin-panel-head > div { flex-wrap:wrap; }
        /* H8: telefon — karty/rankingi w kolumnie, pełna szerokość, nic nie ucieka */
        .drk-ranking { flex-direction:column; }
        .drk-rank { min-width:0; width:100%; box-sizing:border-box; }
        .admin-table { -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain;
          mask-image:linear-gradient(90deg, #000 92%, transparent); }
        .admin-event-card { width:100%; box-sizing:border-box; }
        .ord-filter { flex-wrap:wrap; }
        .admin-main > section, .admin-main > div { max-width:100%; box-sizing:border-box; }
        .stats-pop-grid { grid-template-columns:1fr 1fr; }
        /* Tabele: przewijanie poziome zamiast łamania layoutu */
        .admin-table { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .admin-table table { min-width:480px; }
        /* KPI 2 kolumny na telefonie */
        .stats-kpis { grid-template-columns:repeat(2,1fr) !important; }
        /* Pod-zakładki pełna szerokość */
        .admin-subtabs { width:100%; }
        .admin-subtabs button { flex:1; text-align:center; padding:10px 8px; font-size:13px; }
        /* Pola formularzy pełna szerokość, brak poziomego przepełnienia */
        .admin-main input, .admin-main textarea, .admin-main select { max-width:100%; box-sizing:border-box; }
        .admin, .admin-main { overflow-x:hidden; }
        /* Globus/mapa statystyk wyśrodkowane i mieszczące się */
        .stats-geo { gap:16px; }
      }
      .admin-nav { padding:32px 20px; background:rgba(255,255,255,0.04); border-right:1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:32px; }
      .admin-logo h2 { font-size:24px; margin:0; color:#fff; } .admin-logo span { font-size:11px; opacity:0.55; letter-spacing:0.15em; text-transform:uppercase; }
      .admin-nav nav { display:flex; flex-direction:column; gap:6px; }
      .admin-nav nav button { display:flex; align-items:center; gap:13px; padding:13px 16px; border-radius:13px; background:rgba(255,255,255,0.03); border:1px solid transparent; color:rgba(255,255,255,0.82); font-size:14px; cursor:pointer; transition:all .2s; text-align:left; width:100%; }
      .admin-nav nav button:hover { background:rgba(232,146,124,0.12); border-color:rgba(232,146,124,0.25); color:#fff; transform:translateX(3px); }
      .admin-nav nav button.active { background:linear-gradient(135deg, rgba(232,146,124,0.28), rgba(91,184,212,0.15)); border-color:rgba(232,146,124,0.5); color:#fff; font-weight:700; box-shadow:0 4px 16px rgba(232,146,124,0.2); }
      .admin-nav-ico { font-size:18px; }
      .admin-main { padding:32px 40px; overflow-y:auto; max-height:100vh; }
      .admin-panel-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:32px; }
      .admin-panel-head h1 { font-size:28px; margin:0; }
      .admin-btn { padding:10px 20px; border-radius:10px; background:#E8927C; color:#fff; font-weight:600; font-size:13px; border:none; cursor:pointer; transition:all .2s; }
      .admin-btn:hover { background:#d9745c; transform:translateY(-1px); }
      .admin-btn-ghost { padding:10px 20px; border-radius:10px; background:none; border:1px solid rgba(255,255,255,0.15); color:#fff; font-size:13px; cursor:pointer; }
      .admin-btn-sm { padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:12px; cursor:pointer; }
      .admin-btn-sm:hover { background:rgba(255,255,255,0.12); }
      .admin-btn-danger { color:#e74c3c; } .admin-btn-danger:hover { background:rgba(231,76,60,0.15); }
      .admin-btn-gold { background:rgba(241,196,15,0.2); color:#f1c40f; border-color:rgba(241,196,15,0.4); }
      .admin-count { font-size:13px; opacity:0.6; }
      .admin-loading { opacity:0.5; font-style:italic; }
      .admin-empty { opacity:0.4; font-style:italic; text-align:center; padding:48px; }
      /* ── Messaggi: chat stile WhatsApp ── */
      .amsg-chat { display:grid; grid-template-columns:300px 1fr; gap:16px; height:70vh; min-height:480px; }
      .amsg-list { display:flex; flex-direction:column; gap:4px; overflow-y:auto; border-right:1px solid rgba(255,255,255,0.08); padding-right:8px; }
      .amsg-thread { display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; background:none; border:none; cursor:pointer; text-align:left; transition:background .15s; position:relative; }
      .amsg-thread:hover { background:rgba(255,255,255,0.05); }
      .amsg-thread.active { background:rgba(232,146,124,0.15); }
      .amsg-thread.unread .amsg-thread-name { font-weight:800; }
      .amsg-avatar { width:42px; height:42px; flex-shrink:0; border-radius:50%; background:linear-gradient(135deg,#E8927C,#5BB8D4); display:grid; place-items:center; color:#fff; font-weight:800; font-size:17px; }
      .amsg-thread-info { display:flex; flex-direction:column; min-width:0; flex:1; }
      .amsg-thread-name { color:#fff; font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .amsg-thread-preview { color:rgba(255,255,255,0.45); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .amsg-dot { width:9px; height:9px; border-radius:50%; background:#E8927C; flex-shrink:0; }
      .amsg-conv { display:flex; flex-direction:column; background:rgba(0,0,0,0.2); border-radius:14px; overflow:hidden; }
      .amsg-conv-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.08); }
      .amsg-conv-head strong { color:#fff; font-size:15px; display:block; }
      .amsg-conv-meta { color:rgba(255,255,255,0.45); font-size:12px; }
      .amsg-bubbles { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:10px; }
      .amsg-bubble { max-width:75%; padding:10px 14px; border-radius:16px; font-size:14px; line-height:1.4; }
      .amsg-bubble p { margin:0; }
      .amsg-in { align-self:flex-start; background:#243845; color:#fff; border-bottom-left-radius:4px; }
      .amsg-out { align-self:flex-end; background:#E8927C; color:#1a1014; border-bottom-right-radius:4px; }
      .amsg-tr { margin-top:6px !important; padding-top:6px; border-top:1px solid rgba(255,255,255,0.15); font-size:12px; opacity:0.8; font-style:italic; }
      .amsg-time { display:block; margin-top:4px; font-size:10px; opacity:0.5; }
      .amsg-input { display:flex; gap:10px; padding:14px; border-top:1px solid rgba(255,255,255,0.08); }
      .amsg-input textarea { flex:1; resize:none; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:12px; color:#fff; padding:10px 14px; font-family:inherit; font-size:14px; outline:none; }
      .amsg-input textarea:focus { border-color:#E8927C; }
      .amsg-icon-btn { flex-shrink:0; width:42px; height:42px; border-radius:12px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.06); color:#fff; font-size:18px; cursor:pointer; }
      .amsg-icon-btn:hover { background:rgba(255,255,255,0.14); }
      .amsg-send { flex-shrink:0; width:44px; height:44px; border-radius:50%; border:none; background:var(--c-coral,#E8927C); color:#fff; font-size:18px; cursor:pointer; display:grid; place-items:center; transition:transform .15s, opacity .2s; }
      .amsg-send:hover { transform:scale(1.08); } .amsg-send:disabled { opacity:0.4; cursor:not-allowed; }
      .amsg-back { display:none; width:38px; height:38px; flex-shrink:0; border-radius:50%; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.06); color:#fff; font-size:18px; cursor:pointer; margin-right:6px; }
      .amsg-trash { flex-shrink:0; padding:8px 12px; border-radius:10px; border:1px solid rgba(220,38,38,0.4); background:rgba(220,38,38,0.12); color:#ff8a8a; font-weight:700; font-size:13px; cursor:pointer; transition:all .2s; }
      .amsg-trash.arm { background:#dc2626; color:#fff; border-color:#dc2626; animation:bellPulse 1s ease-in-out infinite; }
      .amsg-img { max-width:200px; max-height:220px; border-radius:12px; display:block; }
      .amsg-loc { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:12px; background:rgba(91,184,212,0.15); border:1px solid rgba(91,184,212,0.5); color:#9bd6ec; font-weight:700; text-decoration:none; font-size:13px; }
      /* ── Eventi: gatunki + guziki social ── */
      .ev-genres { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:10px; }
      .ev-genre { padding:6px 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
      .ev-genre.on { background:var(--c-coral,#E8927C); border-color:transparent; }
      .ev-genre-add { display:flex; gap:8px; margin-bottom:6px; }
      .ev-genre-add input { flex:1; min-width:0; }
      .ev-social-toggles { display:flex; gap:10px; flex-wrap:wrap; }
      .ev-social { display:inline-flex; align-items:center; gap:8px; padding:10px 16px; border-radius:12px; border:2px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.7); font-weight:700; font-size:13px; cursor:pointer; transition:all .2s; }
      .ev-social.on.ev-social-ig { background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888); border-color:transparent; color:#fff; }
      .ev-social.on.ev-social-fb { background:#1877f2; border-color:transparent; color:#fff; }
      .ev-social.on.ev-social-story { background:linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf); border-color:transparent; color:#fff; }
      .admin-theme-light .ev-genre, .admin-theme-light .ev-social { color:#15202b; }
      /* Własny kalendarz po włosku (data eventu) */
      .ev-cal { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px; margin-bottom:14px; }
      .ev-cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
      .ev-cal-head span { font-weight:800; font-size:15px; text-transform:capitalize; }
      .ev-cal-head button { width:32px; height:32px; border-radius:9px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:inherit; font-size:18px; cursor:pointer; }
      .ev-cal-wd { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:4px; }
      .ev-cal-wd span { text-align:center; font-size:10px; font-weight:700; opacity:0.5; text-transform:uppercase; }
      .ev-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
      .ev-cal-day { aspect-ratio:1; border-radius:9px; border:1px solid transparent; background:rgba(255,255,255,0.05); color:inherit; font-size:13px; cursor:pointer; transition:all .15s; }
      .ev-cal-day:hover { background:rgba(255,255,255,0.14); }
      .ev-cal-day.today { border-color:rgba(255,255,255,0.4); font-weight:800; }
      .ev-cal-day.sel { background:var(--c-coral,#E8927C); border-color:transparent; color:#fff; font-weight:800; }
      .admin-theme-light .ev-cal { background:#f6f8fb; border-color:rgba(0,0,0,0.08); }
      .admin-theme-light .ev-cal-day { background:rgba(0,0,0,0.04); }

      /* ── Ospiti: węższe karty w siatce ── */
      .ospiti-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
      .ospiti-card { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:14px; cursor:pointer; display:flex; flex-direction:column; gap:10px; transition:transform .2s, border-color .2s; }
      .ospiti-card:hover { transform:translateY(-2px); border-color:rgba(232,146,124,0.4); }
      .ospiti-card-top { display:flex; align-items:center; gap:10px; }
      .ospiti-card-id { min-width:0; } .ospiti-card-id h4 { margin:0; font-size:15px; } .ospiti-card-id p { margin:0; font-size:12px; opacity:0.6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .ospiti-card-actions { display:flex; gap:8px; margin-top:auto; }
      .ospiti-card-actions .admin-btn-sm { flex:1; }
      .admin-theme-light .ospiti-card { background:#fff; border-color:rgba(0,0,0,0.08); }
      @media (max-width:768px) {
        .amsg-chat { grid-template-columns:1fr; height:auto; }
        .amsg-list { flex-direction:column; overflow-x:visible; border-right:none; border-bottom:none; padding-bottom:0; }
        .amsg-thread { flex-direction:row; min-width:0; }
        .amsg-thread-preview { display:block; }
        /* Mobile: po wybraniu konwersacji — czat na PEŁNY ekran, lista schowana */
        .amsg-chat[data-active="1"] .amsg-listcol { display:none; }
        .amsg-chat[data-active="0"] .amsg-conv { display:none; }
        .amsg-chat[data-active="1"] .amsg-conv { height:72vh; }
        .amsg-back { display:grid; place-items:center; }
      }
      .admin-badge { display:inline-block; margin-left:8px; color:#f1c40f; }
      /* ── Menu zdjęcia ── */
      .menu-thumb { width:48px; height:48px; border-radius:8px; object-fit:cover; display:block; }
      .menu-thumb-ph { display:grid; place-items:center; background:rgba(255,255,255,0.05); font-size:20px; opacity:0.5; }
      .menu-img-upload { margin-bottom:8px; }
      .menu-img-drop { display:flex; align-items:center; justify-content:center; height:120px; border:2px dashed rgba(255,255,255,0.18); border-radius:12px; cursor:pointer; color:rgba(255,255,255,0.6); font-size:14px; transition:all .2s; }
      .menu-img-drop:hover { border-color:#E8927C; color:#fff; }
      .menu-img-preview { position:relative; width:120px; height:120px; }
      .menu-img-preview img { width:100%; height:100%; object-fit:cover; border-radius:12px; }
      .menu-img-preview button { position:absolute; top:6px; right:6px; width:26px; height:26px; border-radius:50%; border:none; background:rgba(0,0,0,0.6); color:#fff; cursor:pointer; }
      .menu-sel { padding:11px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); color:#fff; font-size:14px; }
      .menu-sel option { background:#12171e; }
      .menu-likes-badge { display:inline-block; padding:2px 8px; border-radius:999px; background:rgba(232,146,124,0.15); color:#E8927C; font-size:12px; font-weight:700; white-space:nowrap; }
      .pdf-preview-list { display:flex; flex-direction:column; gap:8px; max-height:50vh; overflow-y:auto; margin:8px 0; }
      .pdf-preview-row { display:flex; gap:8px; align-items:center; }
      .pdf-prev-cat { width:110px; flex-shrink:0; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#fff; font-size:12px; }
      .pdf-prev-name { flex:1; min-width:0; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#fff; font-size:13px; }
      .pdf-prev-price { width:80px; flex-shrink:0; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#fff; font-size:12px; }
      /* ── Ordini QR filtr + kod ── */
      .ord-filter { display:flex; gap:4px; background:rgba(255,255,255,0.04); border-radius:999px; padding:3px; }
      .ord-filter button { padding:7px 14px; border-radius:999px; border:none; background:none; color:rgba(255,255,255,0.6); font-size:12px; cursor:pointer; transition:all .2s; }
      .ord-filter button.active { background:linear-gradient(135deg,#E8927C,#5BB8D4); color:#fff; font-weight:700; }
      .ord-code { display:inline-block; margin-top:4px; font-size:12px; color:#5BB8D4; letter-spacing:0.1em; }
      /* ── Drinki ranking ── */
      .drk-ranking { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
      .drk-rank { flex:1; min-width:200px; display:flex; align-items:center; gap:10px; padding:14px 16px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); }
      .drk-rank-1 { background:linear-gradient(135deg,rgba(241,196,15,0.2),rgba(255,255,255,0.04)); border-color:rgba(241,196,15,0.4); }
      .drk-rank-pos { font-size:24px; }
      .drk-rank-name { font-weight:800; color:#fff; }
      .drk-rank-by { font-size:12px; opacity:0.6; }
      .drk-rank-score { margin-left:auto; font-size:13px; color:#E8927C; font-weight:700; }
      .drk-email { font-size:12px; color:#5BB8D4; }
      .hours-rows { display:flex; flex-direction:column; gap:10px; }
      .hours-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .hours-day, .hours-time { flex:1; min-width:140px; padding:11px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); color:#fff; font-size:14px; }
      .hours-closed { display:flex; align-items:center; gap:6px; font-size:13px; color:rgba(255,255,255,0.7); white-space:nowrap; }
      .hours-slots { width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); color:#fff; font-size:14px; font-family:inherit; }
      .hours-quick { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .hours-auto-note { margin-top:14px; font-size:13px; color:rgba(255,255,255,0.6); line-height:1.5; }
      .admin-theme-light .hours-auto-note { color:rgba(0,0,0,0.55); }
      .hours-quick-btn { padding:11px 18px; border-radius:12px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); color:#fff; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; }
      .hours-quick-btn:hover { background:rgba(255,255,255,0.1); }
      .hours-quick-btn.is-closed { background:rgba(231,76,60,0.2); border-color:rgba(231,76,60,0.5); color:#ff9d92; }
      .hours-date-input { padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.05); color:#fff; font-size:14px; color-scheme:dark; }
      .hours-closed-list { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
      .hours-closed-chip { display:inline-flex; align-items:center; gap:8px; padding:6px 8px 6px 14px; border-radius:999px; background:rgba(231,76,60,0.15); border:1px solid rgba(231,76,60,0.35); color:#ff9d92; font-size:13px; font-weight:600; }
      .hours-closed-chip button { width:22px; height:22px; border-radius:50%; border:none; background:rgba(0,0,0,0.3); color:#fff; cursor:pointer; font-size:12px; }
      .stats-range { display:flex; gap:6px; flex-wrap:wrap; }
      .stats-range button { padding:8px 14px; border-radius:999px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.7); font-size:12px; cursor:pointer; transition:all .2s; }
      .stats-range button:hover { background:rgba(232,146,124,0.15); color:#fff; }
      .stats-range button.active { background:linear-gradient(135deg,#E8927C,#5BB8D4); color:#fff; border-color:transparent; font-weight:700; }
      .stats-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:28px; }
      .stats-kpi { background:linear-gradient(135deg,rgba(232,146,124,0.12),rgba(91,184,212,0.08)); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:4px; }
      .stats-kpi-val { font-size:30px; font-weight:800; color:#fff; }
      .stats-kpi-online { border-color:rgba(46,204,113,0.4); background:linear-gradient(135deg,rgba(46,204,113,0.18),rgba(91,184,212,0.08)); }
      .stats-online-dot { display:inline-block; width:11px; height:11px; border-radius:50%; background:#2ecc71; margin-right:8px; vertical-align:middle; box-shadow:0 0 0 0 rgba(46,204,113,0.6); animation:onlinePulse 1.8s infinite; }
      @keyframes onlinePulse { 0%{ box-shadow:0 0 0 0 rgba(46,204,113,0.55);} 70%{ box-shadow:0 0 0 9px rgba(46,204,113,0);} 100%{ box-shadow:0 0 0 0 rgba(46,204,113,0);} }
      .stats-kpi-lbl { font-size:12px; color:rgba(255,255,255,0.6); }
      .stats-section { margin-bottom:28px; }
      .stats-section h3 { font-size:16px; margin:0 0 14px; color:#fff; }
      .stats-countries { display:flex; flex-direction:column; gap:8px; }
      .stats-geo { display:flex; gap:24px; align-items:flex-start; }
      .stats-geo .stats-countries { flex:1; }
      .stats-globe { flex:0 0 320px; max-width:320px; }
      .stats-globe-svg { width:100%; height:auto; display:block; filter:drop-shadow(0 10px 30px rgba(0,0,0,0.4)); }
      .stats-globe-loading { width:100%; aspect-ratio:1/1; max-width:320px; margin:0 auto; display:grid; place-items:center; font-size:48px; opacity:0.4; animation:globeSpin 3s linear infinite; }
      @keyframes globeSpin { to { transform:rotate(360deg); } }
      @media (max-width:768px) { .stats-geo { flex-direction:column; align-items:center; } .stats-globe { flex:0 0 auto; width:260px; } .stats-geo .stats-countries { width:100%; } }
      .stats-country { display:flex; align-items:center; gap:12px; padding:8px 12px; border-radius:12px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); cursor:pointer; transition:all .2s; width:100%; text-align:left; color:#fff; }
      .stats-country:hover { background:rgba(232,146,124,0.1); border-color:rgba(232,146,124,0.3); }
      .stats-country-flag { font-size:22px; flex-shrink:0; }
      .stats-country-name { font-size:14px; min-width:90px; flex-shrink:0; }
      .stats-country-bar-wrap { flex:1; height:14px; background:rgba(255,255,255,0.05); border-radius:999px; overflow:hidden; }
      .stats-country-bar { display:block; height:100%; border-radius:999px; transition:width .5s cubic-bezier(.2,.8,.2,1); }
      .stats-country-count { font-weight:800; font-size:15px; min-width:36px; text-align:right; flex-shrink:0; }
      .stats-pop-overlay { position:fixed; inset:0; z-index:300; background:rgba(8,12,18,0.6); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px; }
      .stats-pop { position:relative; width:min(420px,92vw); background:#11202c; border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:28px; box-shadow:0 30px 80px rgba(0,0,0,0.5); }
      .stats-pop-close { position:absolute; top:14px; right:14px; width:34px; height:34px; border-radius:50%; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.3); color:#fff; font-size:20px; cursor:pointer; }
      .stats-pop-head { display:flex; align-items:center; gap:14px; margin-bottom:20px; }
      .stats-pop-head h2 { margin:0; font-size:24px; color:#fff; }
      .stats-pop-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
      .stats-pop-grid > div { background:rgba(255,255,255,0.04); border-radius:12px; padding:14px; text-align:center; }
      .stats-pop-val { display:block; font-size:22px; font-weight:800; color:#E8927C; }
      .stats-pop-lbl { font-size:11px; color:rgba(255,255,255,0.55); }
      .stats-pop-seclbl { font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.5); display:block; margin-bottom:10px; }
      .stats-pop-secrow { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:14px; color:#fff; }

      .admin-table { overflow-x:auto; }
      .admin-table table { width:100%; border-collapse:collapse; }
      .admin-table th { text-align:left; padding:12px 16px; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.5); border-bottom:1px solid rgba(255,255,255,0.08); }
      .admin-table td { padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:14px; }
      .admin-table tr:hover { background:rgba(255,255,255,0.03); }

      .admin-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
      .admin-event-card { padding:20px; border-radius:16px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.14); border-left:4px solid; display:flex; flex-direction:column; gap:8px; }
      .admin-event-date { font-size:12px; opacity:0.5; } .admin-event-tag { font-size:11px; color:#E8927C; }
      .admin-event-actions { display:flex; gap:8px; margin-top:8px; }

      .admin-drink-card { padding:16px; border-radius:16px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); display:flex; flex-direction:column; gap:10px; }
      /* Swipe-to-delete (telefon): przesuń kartę w lewo → odsłania kosz */
      .admin-drink-swipe { position:relative; border-radius:16px; overflow:hidden; }
      .admin-drink-swipe .admin-drink-card { position:relative; z-index:2; }
      .admin-drink-trash { position:absolute; top:0; right:0; bottom:0; width:84px; border:none; background:linear-gradient(90deg,#b91c1c,#dc2626); color:#fff; font-size:26px; cursor:pointer; z-index:1; display:flex; align-items:center; justify-content:center; }
      .admin-drink-ingr { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
      .admin-drink-ingr-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.16); font-size:11px; font-weight:600; color:#fff; }
      .admin-drink-ingr-pill > span { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
      .admin-theme-light .admin-drink-ingr-pill { background:rgba(0,0,0,0.06); border-color:rgba(0,0,0,0.12); color:#15202b; }
      .admin-drink-card.is-month { border-color:rgba(241,196,15,0.6); background:rgba(241,196,15,0.12); }
      .admin-drink-photo { width:100%; height:120px; object-fit:cover; border-radius:10px; }
      .admin-drink-info h4 { margin:0; font-size:16px; } .admin-drink-info span { font-size:12px; opacity:0.6; display:block; }
      .admin-drink-actions { display:flex; gap:8px; flex-wrap:wrap; }

      .admin-orders { display:flex; flex-direction:column; gap:10px; }
      .admin-order { padding:13px 16px; border-radius:14px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.14); display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
      .admin-order.done { opacity:0.5; }
      .admin-order-info h4 { margin:0; font-size:15px; } .admin-order-info span { font-size:12px; opacity:0.6; display:block; }
      .admin-order-time { font-size:11px; opacity:0.4; }
      .admin-order-ingr { display:flex; gap:4px; flex-wrap:wrap; flex:1; }
      .admin-pill { padding:4px 8px; border-radius:999px; font-size:10px; font-weight:600; }
      .admin-done-badge { color:#27ae60; font-size:13px; font-weight:600; }

      .admin-modal-overlay { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; padding:24px; }
      .admin-modal { width:min(520px,92vw); max-height:85vh; overflow-y:auto; background:#14181e; border-radius:20px; padding:32px; border:1px solid rgba(255,255,255,0.1); }
      .admin-modal-wide { width:min(640px,94vw); }
      /* Stepper 3-krokowy (eventy) */
      .ev-stepper { display:flex; align-items:center; justify-content:center; gap:0; margin:0 0 22px; }
      .ev-step { display:flex; flex-direction:column; align-items:center; gap:6px; cursor:default; }
      .ev-step-num { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; font-weight:800; font-size:14px; background:rgba(255,255,255,0.08); border:2px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.6); transition:all .25s; }
      .ev-step.active .ev-step-num { background:#E8927C; border-color:#E8927C; color:#fff; transform:scale(1.1); }
      .ev-step.done .ev-step-num { background:rgba(39,174,96,0.25); border-color:#27ae60; color:#27ae60; cursor:pointer; }
      .ev-step-label { font-size:11px; letter-spacing:0.05em; opacity:0.7; }
      .ev-step.active .ev-step-label { opacity:1; color:#E8927C; font-weight:700; }
      .ev-step-line { flex:1; max-width:80px; height:2px; background:rgba(255,255,255,0.15); margin:0 8px; margin-bottom:18px; }
      .ev-step-line.done { background:#27ae60; }
      .admin-theme-light .ev-step-num { background:rgba(0,0,0,0.05); border-color:rgba(0,0,0,0.15); color:rgba(0,0,0,0.5); }
      .admin-theme-light .ev-step-line { background:rgba(0,0,0,0.12); }
      /* Siatka szablonów — 4 w rzędzie (desktop), 2x2 (telefon) */
      .ev-tpl-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:8px 0 4px; }
      @media (max-width:600px) { .ev-tpl-grid { grid-template-columns:repeat(2,1fr); } }
      .ev-tpl-card { position:relative; aspect-ratio:1/1.1; border-radius:16px; border:2px solid rgba(255,255,255,0.12); cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#fff; padding:10px; transition:all .2s; }
      .ev-tpl-card:hover { transform:translateY(-3px); }
      .ev-tpl-card.active { border-color:#fff; box-shadow:0 8px 28px rgba(0,0,0,0.4); }
      .ev-tpl-dot { width:30px; height:30px; border-radius:50%; }
      .ev-tpl-label { font-size:12px; font-weight:700; text-align:center; line-height:1.2; }
      .ev-tpl-check { position:absolute; top:8px; right:10px; font-size:18px; font-weight:900; }
      .ev-social-note { font-size:12px; line-height:1.5; padding:10px 12px; border-radius:10px; background:rgba(91,184,212,0.12); border:1px solid rgba(91,184,212,0.3); margin-top:6px; opacity:0.9; }
      /* Anteprima evento */
      .ev-preview-switch { display:flex; gap:8px; margin:0 0 18px; }
      .ev-preview-switch button { flex:1; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); color:#fff; font-size:13px; cursor:pointer; }
      .ev-preview-switch button.active { background:rgba(232,146,124,0.2); border-color:#E8927C; }
      .ev-preview-stage { display:flex; justify-content:center; padding:18px; background:repeating-linear-gradient(45deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02) 10px,transparent 10px,transparent 20px); border-radius:16px; }
      .ev-preview-stage.mobile .ev-preview-card { width:280px; }
      .ev-preview-stage.desktop .ev-preview-card { width:100%; max-width:560px; }
      .ev-preview-card { border-radius:18px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.4); position:relative; }
      .ev-preview-img { width:100%; height:160px; object-fit:cover; opacity:0.8; display:block; }
      .ev-preview-content { padding:20px; color:#fff; }
      .ev-preview-tag { font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; }
      .ev-preview-title { font-size:22px; margin:8px 0; }
      .ev-preview-date { font-size:13px; opacity:0.7; text-transform:capitalize; }
      .ev-preview-desc { font-size:13px; opacity:0.85; line-height:1.5; margin:12px 0; }
      .ev-preview-btn { margin-top:8px; padding:9px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.4); background:rgba(255,255,255,0.1); color:#fff; font-size:13px; cursor:default; }
      .ev-preview-note { text-align:center; font-size:12px; opacity:0.5; margin:14px 0 0; }
      .admin-modal h3 { margin:0 0 24px; font-size:22px; }
      .admin-form { display:flex; flex-direction:column; gap:14px; }
      .admin-form label { font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.5); }
      .admin-form input, .admin-form textarea, .admin-form select { width:100%; padding:12px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#fff; font-size:14px; }
      .admin-form textarea { min-height:80px; resize:vertical; }
      .admin-form-row { display:flex; align-items:center; gap:8px; }
      .admin-modal-actions { display:flex; gap:12px; margin-top:24px; position:sticky; bottom:-32px; background:linear-gradient(to top, #14181e 70%, rgba(20,24,30,0)); padding:16px 0 4px; margin-bottom:-8px; z-index:5; }
      .admin-modal-actions .admin-btn { flex:1; }
      .admin-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
      .admin-field > span { font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.5); }
      .admin-field input, .admin-field textarea { width:100%; padding:12px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#fff; font-size:14px; font-family:inherit; resize:vertical; }
      .admin-theme-light .admin-field > span { color:rgba(0,0,0,0.55); }
      .admin-theme-light .admin-field input, .admin-theme-light .admin-field textarea { background:#f4f6f9; color:#15202b; border-color:rgba(0,0,0,0.15); }
      .admin-templates { display:flex; gap:8px; flex-wrap:wrap; }
      .admin-tpl { padding:10px 16px; border-radius:10px; border:2px solid; font-size:13px; cursor:pointer; transition:all .2s; color:#fff; }
      .admin-tpl.active { transform:scale(1.05); box-shadow:0 4px 20px rgba(0,0,0,0.4); }

      /* ═══════════════════════════════════════════════════════════════════
       * 🎨 REDESIGN LAYER (Novara/Stellar) — czysto, miękko, smooth.
       * Dodane na końcu → nadpisuje wygląd, zachowuje nazwy klas/struktury.
       * ═══════════════════════════════════════════════════════════════════ */
      .admin, .admin-login {
        font-family:'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
        letter-spacing:-0.01em;
      }
      /* Tło — głębsze, z subtelnym blaskiem zamiast płaskiego koloru */
      .admin-theme-dark.admin { background:radial-gradient(1200px 600px at 18% -10%, #15293a 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #1a2030 0%, transparent 50%), #080c12 !important; }
      .admin-theme-light.admin { background:radial-gradient(1000px 500px at 15% -10%, #ffffff 0%, transparent 60%), #eef1f6 !important; }

      /* Sidebar — szklisty, czysty */
      .admin-nav { backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); padding:28px 18px; gap:26px; }
      .admin-theme-dark .admin-nav { background:rgba(255,255,255,0.035) !important; border-right:1px solid rgba(255,255,255,0.07) !important; }
      .admin-theme-light .admin-nav { background:rgba(255,255,255,0.85) !important; border-right:1px solid rgba(0,0,0,0.06) !important; box-shadow:1px 0 30px rgba(0,0,0,0.04); }
      .admin-logo h2 { font-weight:800; letter-spacing:-0.02em; }
      .admin-logo span { opacity:0.5; }

      /* Nawigacja — pełniejsze pigułki, miękkie aktywne */
      .admin-nav nav button { border-radius:14px; padding:12px 15px; font-weight:600; border:1px solid transparent; transition:all .28s cubic-bezier(.2,.8,.2,1); }
      .admin-theme-dark .admin-nav nav button { background:transparent; color:rgba(255,255,255,0.66); }
      .admin-theme-dark .admin-nav nav button:hover { background:rgba(255,255,255,0.06); color:#fff; transform:none; }
      .admin-theme-dark .admin-nav nav button.active { background:linear-gradient(135deg,rgba(232,146,124,0.9),rgba(232,146,124,0.65)) !important; color:#15202b !important; border-color:transparent !important; font-weight:800; box-shadow:0 10px 26px rgba(232,146,124,0.28); }
      .admin-theme-light .admin-nav nav button { background:transparent !important; color:#5a6b7b !important; }
      .admin-theme-light .admin-nav nav button:hover { background:rgba(0,0,0,0.04) !important; color:#15202b !important; transform:none; }
      .admin-theme-light .admin-nav nav button.active { background:#15202b !important; color:#fff !important; font-weight:800; box-shadow:0 10px 26px rgba(21,32,43,0.18); }
      .admin-nav-ico { font-size:17px; opacity:0.95; }

      /* Nagłówki paneli — większe, ciaśniejsze */
      .admin-panel-head { margin-bottom:28px; }
      .admin-panel-head h1 { font-size:clamp(26px,3vw,38px); font-weight:800; letter-spacing:-0.03em; }
      .admin-main { padding:38px 44px; }

      /* Karty — większy promień, miękki cień, subtelny hover-lift */
      .admin-table, .admin-order, .admin-event-card, .admin-drink-card, .stats-kpi, .amsg-list, .amsg-conv, .stats-country, .admin-login-card {
        border-radius:20px !important;
        transition:transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s, background .25s !important;
      }
      .admin-theme-dark .admin-table, .admin-theme-dark .admin-order, .admin-theme-dark .admin-event-card, .admin-theme-dark .admin-drink-card, .admin-theme-dark .stats-kpi, .admin-theme-dark .amsg-list, .admin-theme-dark .amsg-conv {
        background:rgba(255,255,255,0.04) !important; border:1px solid rgba(255,255,255,0.08) !important; box-shadow:0 10px 30px rgba(0,0,0,0.25) !important;
      }
      .admin-theme-light .admin-table, .admin-theme-light .admin-order, .admin-theme-light .admin-event-card, .admin-theme-light .admin-drink-card, .admin-theme-light .stats-kpi, .admin-theme-light .amsg-list, .admin-theme-light .amsg-conv {
        background:#ffffff !important; border:1px solid rgba(0,0,0,0.05) !important; box-shadow:0 8px 30px rgba(17,34,51,0.06) !important;
      }
      .admin-order:hover, .admin-event-card:hover, .admin-drink-card:hover, .stats-kpi:hover { transform:translateY(-3px); }
      .admin-theme-dark .admin-order:hover, .admin-theme-dark .admin-event-card:hover, .admin-theme-dark .admin-drink-card:hover, .admin-theme-dark .stats-kpi:hover { box-shadow:0 18px 44px rgba(0,0,0,0.34) !important; }
      .admin-theme-light .admin-order:hover, .admin-theme-light .admin-event-card:hover, .admin-theme-light .admin-drink-card:hover, .admin-theme-light .stats-kpi:hover { box-shadow:0 18px 44px rgba(17,34,51,0.1) !important; }

      /* Przyciski — pigułki, smooth */
      .admin-btn, .admin-btn-ghost { border-radius:999px !important; font-weight:700 !important; padding:11px 22px !important; transition:all .25s cubic-bezier(.2,.8,.2,1) !important; }
      .admin-btn { background:linear-gradient(135deg,#E8927C,#e07a60) !important; box-shadow:0 8px 22px rgba(232,146,124,0.3) !important; }
      .admin-btn:hover { transform:translateY(-2px) !important; box-shadow:0 12px 30px rgba(232,146,124,0.42) !important; }
      .admin-btn-sm { border-radius:999px !important; transition:all .2s !important; }
      .admin-subtabs button { border-radius:999px !important; }

      /* Pola formularzy — czyste, z focus-ringiem */
      .admin-form input, .admin-form textarea, .admin-form select, .admin-login-card input, .amsg-input textarea {
        border-radius:14px !important; transition:border-color .2s, box-shadow .2s !important;
      }
      .admin-form input:focus, .admin-form textarea:focus, .admin-form select:focus, .amsg-input textarea:focus, .admin-login-card input:focus {
        border-color:#E8927C !important; box-shadow:0 0 0 4px rgba(232,146,124,0.15) !important; outline:none !important;
      }

      /* KPI — wyrazistsze liczby */
      .stats-kpi { padding:20px !important; }
      .stats-kpi-val { letter-spacing:-0.02em; }

      /* Login — bardziej premium */
      .admin-theme-dark .admin-login { background:radial-gradient(900px 500px at 50% -10%, #15293a, #080c12) !important; }
      .admin-login-card { border-radius:26px !important; box-shadow:0 30px 80px rgba(0,0,0,0.4) !important; }

      /* ═══════════════════════════════════════════════════════════════════
       * ✨ POLISH + MOTION LAYER — płynne wejścia jak iPhone Weather, spring,
       * wyrównanie, momentum scroll. Profesjonalnie i elastycznie.
       * ═══════════════════════════════════════════════════════════════════ */
      :root { --spring: cubic-bezier(.22,1,.36,1); }
      .admin-main { scroll-behavior:smooth; -webkit-overflow-scrolling:touch; }

      /* Wejście całego panelu po zmianie zakładki (remount → re-run) */
      .admin-main > * { animation:adminPanelIn .55s var(--spring) both; }
      @keyframes adminPanelIn { from { opacity:0; transform:translateY(18px) scale(.985); } to { opacity:1; transform:none; } }

      /* Stagger kart/wierszy — kolejne wjeżdżają z lekkim opóźnieniem (jak Weather) */
      .admin-grid > *, .admin-orders > *, .stats-kpis > *, .ev-tpl-grid > * { animation:adminCardIn .5s var(--spring) both; }
      @keyframes adminCardIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
      .admin-grid > *:nth-child(1),.admin-orders > *:nth-child(1),.stats-kpis > *:nth-child(1){animation-delay:.03s}
      .admin-grid > *:nth-child(2),.admin-orders > *:nth-child(2),.stats-kpis > *:nth-child(2){animation-delay:.07s}
      .admin-grid > *:nth-child(3),.admin-orders > *:nth-child(3),.stats-kpis > *:nth-child(3){animation-delay:.11s}
      .admin-grid > *:nth-child(4),.admin-orders > *:nth-child(4),.stats-kpis > *:nth-child(4){animation-delay:.15s}
      .admin-grid > *:nth-child(5),.admin-orders > *:nth-child(5){animation-delay:.19s}
      .admin-grid > *:nth-child(6),.admin-orders > *:nth-child(6){animation-delay:.23s}
      .admin-grid > *:nth-child(7),.admin-orders > *:nth-child(7){animation-delay:.27s}
      .admin-grid > *:nth-child(8),.admin-orders > *:nth-child(8){animation-delay:.31s}

      /* Aktywne karty/przyciski reagują sprężyście */
      .admin-nav nav button, .admin-subtabs button, .admin-btn, .admin-btn-sm, .admin-order, .admin-drink-card, .admin-event-card, .stats-kpi, .amsg-thread {
        transition:transform .35s var(--spring), box-shadow .35s var(--spring), background .25s ease, color .25s ease, border-color .25s ease !important;
      }
      .admin-nav nav button:active, .admin-subtabs button:active, .admin-btn:active, .admin-btn-sm:active { transform:scale(.96) !important; }

      /* WYRÓWNANIE — spójne nagłówki, odstępy, brak „rozjazdów" */
      .admin-panel-head { gap:16px; flex-wrap:wrap; align-items:center; }
      .admin-panel-head > div { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .admin-subtabs { align-items:center; }
      .admin-grid { gap:18px; }
      .admin-orders { display:flex; flex-direction:column; gap:14px; }
      .admin-order { align-items:center; }

      /* Pod-zakładki — przesuwalne poziomo na telefonie ze snap (jak swipe) */
      .admin-subtabs { overflow-x:auto; scrollbar-width:none; scroll-snap-type:x proximity; -webkit-overflow-scrolling:touch; flex-wrap:nowrap; }
      .admin-subtabs::-webkit-scrollbar { display:none; }
      .admin-subtabs button { scroll-snap-align:start; flex:0 0 auto; }

      /* Nawigacja boczna — momentum scroll i brak skoków */
      .admin-nav nav { gap:6px; }

      /* Szanuj „mniej ruchu" */
      @media (prefers-reduced-motion: reduce) {
        .admin-main > *, .admin-grid > *, .admin-orders > *, .stats-kpis > *, .ev-tpl-grid > * { animation:none !important; }
      }

      /* Telefon — pod-zakładki przewijane, panele pełna szerokość, smooth */
      @media (max-width:768px) {
        .admin-subtabs { margin-bottom:14px; padding-bottom:4px; }
        .admin-subtabs button { flex:0 0 auto; padding:10px 16px; }
        .admin-main { padding:64px 14px 24px; }
        .admin-panel-head h1 { font-size:24px; }
      }

      /* ── Czat: szukajka + kolumna listy + panel info o osobie ── */
      .amsg-listcol { display:flex; flex-direction:column; gap:10px; min-height:0; }
      .amsg-search { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:14px; flex-shrink:0;
        background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); transition:border-color .2s, box-shadow .2s; }
      .amsg-search:focus-within { border-color:#E8927C; box-shadow:0 0 0 4px rgba(232,146,124,0.15); }
      .amsg-search-ico { font-size:14px; opacity:0.6; }
      .amsg-search input { flex:1; background:none; border:none; outline:none; color:inherit; font-size:14px; font-family:inherit; }
      .amsg-search-clear { background:none; border:none; color:inherit; opacity:0.5; cursor:pointer; font-size:13px; }
      .amsg-search-clear:hover { opacity:1; }
      .admin-theme-light .amsg-search { background:#f4f6f9; border-color:rgba(0,0,0,0.1); }
      .amsg-person { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .amsg-badge { font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px;
        background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:inherit; }
      .amsg-badge-coral { background:rgba(232,146,124,0.18); border-color:rgba(232,146,124,0.4); color:#E8927C; }
      .amsg-badge-sky { background:rgba(91,184,212,0.18); border-color:rgba(91,184,212,0.4); color:#5BB8D4; }
      .amsg-badge-gold { background:rgba(241,196,15,0.18); border-color:rgba(241,196,15,0.4); color:#f1c40f; }
      .admin-theme-light .amsg-badge { background:rgba(0,0,0,0.05); border-color:rgba(0,0,0,0.1); }

      /* ── Wykresy statystyk (Chart.js) ── */
      .stats-charts { display:grid; grid-template-columns:1.6fr 1fr; gap:18px; margin-bottom:28px; }
      .stats-chart-card { border-radius:20px; padding:20px; }
      .admin-theme-dark .stats-chart-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 30px rgba(0,0,0,0.25); }
      .admin-theme-light .stats-chart-card { background:#fff; border:1px solid rgba(0,0,0,0.05); box-shadow:0 8px 30px rgba(17,34,51,0.06); }
      .stats-chart-card h3 { margin:0 0 14px; font-size:15px; font-weight:700; }
      .stats-chart-canvas { position:relative; height:240px; }
      @media (max-width:768px) { .stats-charts { grid-template-columns:1fr; } .stats-chart-canvas { height:220px; } }

      /* ═══ LIQUID GLASS + DZWONEK + BADGE'E ═══ */
      /* Liquid glass na sidebarze i kartach */
      .admin-theme-dark .admin-nav { background:linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)) !important; backdrop-filter:blur(22px) saturate(1.4); -webkit-backdrop-filter:blur(22px) saturate(1.4); }
      .admin-theme-light .admin-nav { background:linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.7)) !important; backdrop-filter:blur(22px) saturate(1.4); -webkit-backdrop-filter:blur(22px) saturate(1.4); }
      .admin-nav nav button { position:relative; }
      /* Badge licznika przy zakładce */
      .admin-nav-badge { margin-left:auto; min-width:20px; height:20px; padding:0 6px; border-radius:999px; background:#E8927C; color:#1a1a1a;
        font-size:11px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(232,146,124,0.5); }
      /* Dzwonek */
      .admin-bell-wrap { position:fixed; top:16px; right:18px; z-index:240; }
      .admin-bell { position:relative; width:46px; height:46px; border-radius:16px; border:1px solid rgba(255,255,255,0.14); cursor:pointer; font-size:20px;
        background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
        box-shadow:0 8px 24px rgba(0,0,0,0.25); transition:transform .25s var(--spring,cubic-bezier(.22,1,.36,1)); }
      .admin-bell:hover { transform:scale(1.06); }
      .admin-bell:active { transform:scale(.94); }
      .admin-theme-light .admin-bell { background:rgba(255,255,255,0.8); border-color:rgba(0,0,0,0.08); }
      .admin-bell-badge { position:absolute; top:-4px; right:-4px; min-width:20px; height:20px; padding:0 5px; border-radius:999px; background:#C8102E; color:#fff;
        font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; border:2px solid #0a0e14; }
      .admin-theme-light .admin-bell-badge { border-color:#eef1f6; }
      .admin-bell-backdrop { position:fixed; inset:0; z-index:241; }
      .admin-bell-pop { position:absolute; top:56px; right:0; z-index:242; width:280px; border-radius:18px; overflow:hidden; padding:8px;
        background:linear-gradient(180deg, rgba(28,40,54,0.96), rgba(16,26,38,0.96)); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
        border:1px solid rgba(255,255,255,0.12); box-shadow:0 24px 70px rgba(0,0,0,0.5); animation:adminPanelIn .3s var(--spring,ease) both; }
      .admin-theme-light .admin-bell-pop { background:rgba(255,255,255,0.98); border-color:rgba(0,0,0,0.08); }
      .admin-bell-head { font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; opacity:0.6; padding:8px 10px 6px; }
      .admin-bell-empty { padding:18px 12px; text-align:center; opacity:0.55; font-size:14px; }
      .admin-bell-item { display:flex; align-items:center; gap:10px; width:100%; padding:11px 12px; border-radius:12px; border:none; cursor:pointer;
        background:transparent; color:inherit; font-size:14px; text-align:left; transition:background .2s; }
      .admin-bell-item:hover { background:rgba(232,146,124,0.14); }
      .admin-bell-item strong { color:#E8927C; }
      @media (max-width:768px) { .admin-bell-wrap { top:14px; right:14px; } .admin-bell { width:42px; height:42px; } }

      /* ═══ PREMIUM: logo/profil, scrim, mobilny close, mikro-interakcje ═══ */
      /* Blok logo jako profil (jak w referencji) */
      .admin-logo { display:flex; align-items:center; gap:12px; }
      .admin-logo-mark { width:42px; height:42px; flex-shrink:0; border-radius:14px; display:grid; place-items:center;
        font-weight:800; font-size:15px; letter-spacing:-0.02em; color:#fff;
        background:linear-gradient(135deg,#E8927C,#5BB8D4); box-shadow:0 6px 18px rgba(232,146,124,0.35); }
      .admin-logo-txt { display:flex; flex-direction:column; min-width:0; }
      .admin-logo-txt h2 { font-size:19px; margin:0; line-height:1.1; }
      .admin-nav-close { display:none; }

      /* Mikro-interakcje nav — przesunięcie ikonki + płynne tło aktywne */
      .admin-nav nav button { gap:13px; }
      .admin-nav-ico { transition:transform .3s var(--spring,cubic-bezier(.22,1,.36,1)); }
      .admin-nav nav button:hover .admin-nav-ico { transform:scale(1.18) rotate(-4deg); }
      .admin-nav nav button.active .admin-nav-ico { transform:scale(1.12); }
      .admin-nav nav button { will-change:transform; }
      .admin-nav nav button:active { transform:scale(.97); }

      /* Przyciski — subtelny „shine" przy hover */
      .admin-btn { position:relative; overflow:hidden; }
      .admin-btn::after { content:""; position:absolute; inset:0; background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,0.25) 50%,transparent 70%);
        transform:translateX(-120%); transition:transform .6s ease; }
      .admin-btn:hover::after { transform:translateX(120%); }

      /* Karty — kursor + lekkie uniesienie ikon/elementów na hover */
      .stats-kpi, .admin-order, .admin-event-card, .admin-drink-card { cursor:default; }

      /* Scrim pod wysuwanym menu (telefon) */
      .admin-nav-scrim { display:none; }
      @media (max-width:768px) {
        .admin-nav-scrim { display:block; position:fixed; inset:0; z-index:190; background:rgba(4,8,14,0.55);
          backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); animation:adminPanelIn .25s ease both; }
        /* Wyraźny przycisk zamykania w nagłówku menu */
        .admin-nav-close { display:grid; place-items:center; margin-left:auto; width:38px; height:38px; flex-shrink:0;
          border-radius:12px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06);
          color:inherit; font-size:16px; cursor:pointer; transition:transform .2s, background .2s; }
        .admin-nav-close:active { transform:scale(.9); }
        .admin-theme-light .admin-nav-close { background:rgba(0,0,0,0.05); border-color:rgba(0,0,0,0.1); }
        /* Hamburger chowamy gdy menu otwarte (jest close w środku) */
        .admin-nav.is-open ~ .admin-nav-toggle { opacity:0; pointer-events:none; }
      }

      /* ═══ FINISHING POLISH — modale, suwaki, tabele, scrollbary, inputy ═══ */
      /* Scrollbary premium */
      .admin-main::-webkit-scrollbar, .amsg-list::-webkit-scrollbar, .amsg-bubbles::-webkit-scrollbar, .admin-modal::-webkit-scrollbar { width:8px; height:8px; }
      .admin-main::-webkit-scrollbar-thumb, .amsg-list::-webkit-scrollbar-thumb, .amsg-bubbles::-webkit-scrollbar-thumb, .admin-modal::-webkit-scrollbar-thumb { background:rgba(232,146,124,0.35); border-radius:99px; }
      .admin-main::-webkit-scrollbar-thumb:hover { background:rgba(232,146,124,0.6); }
      .admin-main { scrollbar-width:thin; scrollbar-color:rgba(232,146,124,0.4) transparent; }

      /* Modale — szklane, większy promień, miękkie wejście */
      .admin-modal-overlay { backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); background:rgba(4,8,14,0.5) !important; }
      .admin-modal { border-radius:24px !important; animation:adminPanelIn .4s var(--spring,cubic-bezier(.22,1,.36,1)) both; }
      .admin-theme-dark .admin-modal { background:linear-gradient(180deg,#16222e,#0f1b26) !important; border:1px solid rgba(255,255,255,0.1) !important; box-shadow:0 40px 100px rgba(0,0,0,0.55) !important; }
      .admin-theme-light .admin-modal { box-shadow:0 40px 100px rgba(17,34,51,0.18) !important; }
      .admin-modal h3 { font-weight:800; letter-spacing:-0.02em; }

      /* Suwaki zakresu statystyk — pigułki */
      .stats-range button { border-radius:999px !important; transition:all .25s var(--spring,ease) !important; }
      .stats-range button:active { transform:scale(.95); }

      /* Tabele — czytelniejsze nagłówki, miększe wiersze */
      .admin-table table { border-collapse:separate; border-spacing:0; }
      .admin-table th { font-size:11px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; }
      .admin-table tbody tr { transition:background .2s; }
      .admin-theme-dark .admin-table tbody tr:hover { background:rgba(255,255,255,0.04); }
      .admin-theme-light .admin-table tbody tr:hover { background:rgba(232,146,124,0.06); }
      .menu-thumb { border-radius:12px !important; }

      /* Inputy/selecty/textarea — spójne, zaokrąglone */
      .admin-form input, .admin-form textarea, .admin-form select, .menu-sel, .amsg-input textarea, .admin-login-card input {
        border-radius:14px !important;
      }
      .admin-form input, .admin-form textarea, .admin-form select { padding:12px 14px !important; }

      /* Awatar czatu/Ospiti — delikatny cień */
      .amsg-avatar { box-shadow:0 4px 14px rgba(232,146,124,0.3); }

      /* Pigułki składników/badge — spójne */
      .cx-cc-pill, .amsg-badge { border-radius:999px; }

      /* Empty state — ładniejszy */
      .admin-empty { opacity:0.5; font-size:15px; }

      /* Skeleton — delikatniejszy promień */
      .admin-skel-box { border-radius:12px; }

      /* Karty drink/event — obrazek zaokrąglony */
      .admin-drink-photo { border-radius:14px !important; }

      /* Bell badge puls przy nowych */
      @keyframes bellPulse { 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.15);} }
      .admin-bell-badge { animation:bellPulse 2s ease-in-out infinite; }

      /* ── Skaner QR (kamera) ── */
      .admin-qrcam { position:relative; width:100%; aspect-ratio:1; max-height:300px; border-radius:16px; overflow:hidden; background:#000; margin-bottom:14px; }
      .admin-qrcam video { width:100%; height:100%; object-fit:cover; display:block; }
      .admin-qrcam-frame { position:absolute; inset:18%; border:3px solid rgba(255,255,255,0.85); border-radius:18px; box-shadow:0 0 0 100vmax rgba(0,0,0,0.35); }

      /* ── Swipe-w-prawo → usuń (listy admina) ── */
      .admin-swipe { position:relative; border-radius:14px; overflow:hidden; }
      .admin-swipe.removing { transition:opacity .3s ease, transform .3s ease; opacity:0; transform:scale(0.96); }
      .admin-swipe-trash { position:absolute; inset:0; display:flex; align-items:center; padding-left:22px; border-radius:14px;
        background:linear-gradient(90deg,#dc2626,#b91c1c); color:#fff; font-weight:800; letter-spacing:0.02em; }
      .admin-swipe-fg { position:relative; z-index:2; touch-action:pan-y; }

      /* ── Drink Clienti: notka auto-ogłoszenia, guzik usuwania w rogu, popout statystyk ── */
      .drk-auto-note { margin:-6px 0 18px; font-size:12.5px; color:rgba(255,255,255,0.6); }
      .admin-theme-light .drk-auto-note { color:rgba(0,0,0,0.55); }
      .admin-drink-card { position:relative; cursor:pointer; }
      .admin-drink-x { position:absolute; top:8px; right:8px; z-index:4; width:26px; height:26px; border-radius:50%;
        border:1px solid rgba(255,255,255,0.25); background:rgba(0,0,0,0.45); color:#fff; font-size:16px; line-height:1; cursor:pointer;
        display:grid; place-items:center; opacity:0.85; transition:all .2s; }
      .admin-drink-x:hover { background:#dc2626; opacity:1; }
      .drk-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:14px 0 18px; }
      .drk-stat { display:flex; flex-direction:column; align-items:center; gap:2px; padding:14px 8px; border-radius:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); }
      .admin-theme-light .drk-stat { background:rgba(0,0,0,0.04); border-color:rgba(0,0,0,0.08); }
      .drk-stat-ico { font-size:20px; } .drk-stat strong { font-size:22px; font-weight:800; } .drk-stat span:last-child { font-size:11px; opacity:0.6; }
      .drk-stats-cmts { display:flex; flex-direction:column; gap:10px; max-height:40vh; overflow-y:auto; }
      .admin-field-lbl { font-size:12px; letter-spacing:0.06em; text-transform:uppercase; opacity:0.55; }
      .drk-cmt-row { display:flex; gap:10px; align-items:flex-start; font-size:13px; }
      @media (max-width:600px) { .drk-stats-grid { grid-template-columns:repeat(2,1fr); } }

      /* ── DEFINITYWNA reguła mobilna popoutów admina (menu/eventy/skaner) — bottom-sheet ── */
      @media (max-width:768px) {
        .admin-modal-overlay { align-items:flex-end !important; justify-content:center !important; padding:0 !important; z-index:2000 !important; }
        .admin-modal, .admin-modal-wide { width:100vw !important; max-width:100vw !important; max-height:90vh !important;
          overflow-y:auto !important; border-radius:22px 22px 0 0 !important; padding:22px 18px calc(22px + env(safe-area-inset-bottom)) !important; -webkit-overflow-scrolling:touch; }
        .admin-modal-actions { position:sticky !important; bottom:0 !important; }
      }

      /* ── Telefon: tabela Menu → karty (zero przewijania w bok) ── */
      @media (max-width:768px) {
        .admin-table { overflow:visible !important; }
        .admin-table table, .admin-table thead, .admin-table tbody, .admin-table tr, .admin-table td { display:block !important; min-width:0 !important; width:auto !important; }
        .admin-table thead { display:none !important; }
        .admin-table tr { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:10px 14px; margin-bottom:10px; }
        .admin-table td { border:none !important; padding:5px 0 !important; display:flex !important; justify-content:space-between; gap:12px; align-items:center; text-align:right; }
        .admin-table td::before { content:attr(data-label); font-size:11px; opacity:0.55; font-weight:700; text-transform:uppercase; text-align:left; }
        .admin-table td.menu-row-actions { justify-content:flex-end; padding-top:8px !important; }
        .admin-table td.menu-row-actions::before { display:none; }
        .admin-theme-light .admin-table tr { background:#fff; border-color:rgba(0,0,0,0.08); }
      }
    `}</style>










  );
}
