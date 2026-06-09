"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

type Tab = "menu" | "events" | "drinks" | "orders" | "messages" | "reviews" | "stats" | "hours";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("menu");
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Prosty PIN do admina (w produkcji zastąpić Supabase Auth)
  const checkPin = () => {
    if (pin === "shistoria2026") { setAuthed(true); setPinErr(false); }
    else { setPinErr(true); setPin(""); }
  };

  if (!authed) {
    return (
      <div className="admin-login">
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
    <div className="admin">
      <aside className={`admin-nav ${navOpen ? "is-open" : ""}`}>
        <div className="admin-logo">
          <h2>S'Historia</h2>
          <span>Admin Panel</span>
        </div>
        <nav>
          {([
            { id: "menu", label: "Menu", ico: "🍽" },
            { id: "events", label: "Eventi", ico: "🎭" },
            { id: "drinks", label: "Drink Clienti", ico: "🍸" },
            { id: "orders", label: "Ordini QR", ico: "📱" },
            { id: "messages", label: "Messaggi", ico: "💬" },
            { id: "reviews", label: "Recensioni", ico: "⭐" },
            { id: "hours", label: "Orari", ico: "🕐" },
            { id: "stats", label: "Statistiche", ico: "📊" },
          ] as { id: Tab; label: string; ico: string }[]).map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => { setTab(t.id); setNavOpen(false); }}
            >
              <span className="admin-nav-ico">{t.ico}</span>
              <span className="admin-nav-label">{t.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <button className="admin-nav-toggle" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">{navOpen ? "✕" : "☰"}</button>
      <main className="admin-main">
        {tab === "menu" && <MenuPanel />}
        {tab === "events" && <EventsPanel />}
        {tab === "drinks" && <DrinksPanel />}
        {tab === "orders" && <OrdersPanel />}
        {tab === "messages" && <MessagesPanel />}
        {tab === "reviews" && <ReviewsPanel />}
        {tab === "hours" && <HoursPanel />}
        {tab === "stats" && <StatsPanel />}
      </main>
      <AdminStyles />
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
    if (item.id) {
      await supabase.from("menu_items").update(item).eq("id", item.id);
    } else {
      await supabase.from("menu_items").insert(item);
    }
    setEditItem(null);
    load();
  };

  const remove = async (id: string) => {
    if (confirm("Eliminare questo piatto?")) {
      await supabase.from("menu_items").delete().eq("id", id);
      load();
    }
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
          <button className="admin-btn-ghost" onClick={() => importMenu(false)}>🔄 Reimporta dal sito</button>
          <button className="admin-btn" onClick={() => setEditItem({ section: "ristorante", category: "", name: "", price: "", description: "" })}>
            + Aggiungi piatto
          </button>
        </div>
      </header>

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
              <button className="admin-btn" onClick={() => save(editItem)}>Salva</button>
              <button className="admin-btn-ghost" onClick={() => setEditItem(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-table">
          <table>
            <thead><tr><th>Foto</th><th>Categoria</th><th>Nome</th><th>Prezzo</th><th>❤️</th><th>Allergeni</th><th></th></tr></thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td>{it.image_url ? <img src={it.image_url} alt="" className="menu-thumb" /> : <span className="menu-thumb menu-thumb-ph">🍽</span>}</td>
                  <td>{it.category}</td>
                  <td><strong>{it.name}</strong>{it.is_featured && <span className="admin-badge">★</span>}</td>
                  <td>{it.price}</td>
                  <td>{(it.likes || 0) > 0 ? <span className="menu-likes-badge">❤️ {it.likes}</span> : "—"}</td>
                  <td>{it.allergens || "—"}</td>
                  <td>
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
function EventsPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEvt, setEditEvt] = useState<any>(null);

  const TEMPLATES = [
    { id: "jazz", label: "🎵 Jazz Night", colors: { bg: "#1a1040", accent: "#9b59b6" } },
    { id: "degustazione", label: "🍷 Degustazione", colors: { bg: "#2d1b0e", accent: "#c0392b" } },
    { id: "cena", label: "🍽 Cena Speciale", colors: { bg: "#0d2818", accent: "#27ae60" } },
    { id: "aperitivo", label: "🌅 Aperitivo", colors: { bg: "#1a2a3a", accent: "#f39c12" } },
  ];

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("event_date");
    setEvents(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (evt: any) => {
    const payload = { ...evt, is_published: true };
    if (evt.id) {
      await supabase.from("events").update(payload).eq("id", evt.id);
    } else {
      await supabase.from("events").insert(payload);
    }
    setEditEvt(null);
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
        <button className="admin-btn" onClick={() => setEditEvt({ title: "", description: "", event_date: "", tag: "", template: "jazz" })}>
          + Nuovo evento
        </button>
      </header>

      {editEvt && (
        <div className="admin-modal-overlay" onClick={() => setEditEvt(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editEvt.id ? "Modifica evento" : "Nuovo evento"}</h3>
            <div className="admin-form">
              <label>Template</label>
              <div className="admin-templates">
                {TEMPLATES.map((t) => (
                  <button key={t.id} className={`admin-tpl ${editEvt.template === t.id ? "active" : ""}`}
                    style={{ background: t.colors.bg, borderColor: t.colors.accent }}
                    onClick={() => setEditEvt({ ...editEvt, template: t.id, custom_colors: t.colors })}>
                    {t.label}
                  </button>
                ))}
              </div>
              <label>Titolo</label>
              <input value={editEvt.title} onChange={(e) => setEditEvt({ ...editEvt, title: e.target.value })} placeholder="Nome dell'evento" />
              <label>Data</label>
              <input type="date" value={editEvt.event_date} onChange={(e) => setEditEvt({ ...editEvt, event_date: e.target.value })} />
              <label>Tag</label>
              <input value={editEvt.tag || ""} onChange={(e) => setEditEvt({ ...editEvt, tag: e.target.value })} placeholder="es. Live Music, Degustazione..." />
              <label>Descrizione (italiano — si traduce automaticamente)</label>
              <textarea value={editEvt.description || ""} onChange={(e) => setEditEvt({ ...editEvt, description: e.target.value })} placeholder="Descrivi l'evento..." />
              <label>Condividi sui social</label>
              <div className="admin-form-row" style={{ gap: 16 }}>
                <label><input type="checkbox" checked={editEvt.shareInstagram || false} onChange={(e) => setEditEvt({ ...editEvt, shareInstagram: e.target.checked })} /> 📸 Instagram</label>
                <label><input type="checkbox" checked={editEvt.shareFacebook || false} onChange={(e) => setEditEvt({ ...editEvt, shareFacebook: e.target.checked })} /> 📘 Facebook</label>
              </div>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={() => save(editEvt)}>Pubblica</button>
              <button className="admin-btn-ghost" onClick={() => setEditEvt(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-grid">
          {events.map((evt) => (
            <div key={evt.id} className="admin-event-card" style={{ borderLeftColor: evt.custom_colors?.accent || "#E8927C" }}>
              <span className="admin-event-date">{evt.event_date}</span>
              <h4>{evt.title}</h4>
              <span className="admin-event-tag">{evt.tag}</span>
              <div className="admin-event-actions">
                <button className="admin-btn-sm" onClick={() => setEditEvt(evt)}>✎</button>
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
function DrinksPanel() {
  const [drinks, setDrinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month">("month");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("community_drinks").select("*").order("created_at", { ascending: false });
    setDrinks(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel("drinks_rt").on("postgres_changes", { event: "*", schema: "public", table: "community_drinks" }, () => load()).subscribe();
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
    if (ranked.length === 0) { alert("Brak drinków."); return; }
    const winner = ranked[0];
    const label = period === "week" ? "Drink della Settimana" : "Drink del Mese";
    if (!confirm(`Ogłosić "${winner.name}" jako ${label} i wysłać e-mail do wszystkich twórców?`)) return;
    await supabase.from("community_drinks").update({ is_drink_of_month: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("community_drinks").update({ is_drink_of_month: true }).eq("id", winner.id);
    const recipients = drinks
      .filter((d) => d.author_email && d.id !== winner.id)
      .map((d) => ({ email: d.author_email, name: d.author_name || "Anonimo", lang: d.language || "it" }))
      .filter((r, i, arr) => arr.findIndex((x) => x.email === r.email) === i);
    try {
      const { announceWinner } = await import("../../lib/make-webhooks");
      await announceWinner({ winner_drink: winner.name, winner_author: winner.author_name, winner_email: winner.author_email, recipients, period });
      alert(`Ogłoszono "${winner.name}"! E-mail wysłany do ${recipients.length} twórców (+ zwycięzca osobno).`);
    } catch (e) { console.error(e); alert("Drink oznaczony, ale e-mail nie wyszedł (sprawdź make.com)."); }
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
          <button className="admin-btn" onClick={announceWinner_}>👑 Ogłoś {period === "week" ? "Drink Settimana" : "Drink Mese"}</button>
        </div>
      </header>

      {loading ? <p className="admin-loading">Caricamento...</p> : (
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
            {ranked.map((d, i) => (
              <div key={d.id} className={`admin-drink-card ${d.is_drink_of_month ? "is-month" : ""}`}>
                {d.photo_url && <img src={d.photo_url} alt={d.name} className="admin-drink-photo" />}
                <div className="admin-drink-info">
                  <h4>#{i+1} {d.name}{d.is_drink_of_month && <span className="admin-badge">👑</span>}</h4>
                  <span>di {d.author_name} · {d.total_ml}ml · {d.strength_label}</span>
                  <span>♥ {d.likes||0} · 💬 {d.comments||0} · 🍸 {d.claimed_count||0} ritiri</span>
                  {d.author_email && <span className="drk-email">✉️ {d.author_email}</span>}
                </div>
                <div className="admin-drink-actions">
                  <button className={`admin-btn-sm ${d.is_drink_of_month ? "admin-btn-gold" : ""}`} onClick={async () => { await supabase.from("community_drinks").update({ is_drink_of_month: !d.is_drink_of_month }).eq("id", d.id); load(); }}>
                    {d.is_drink_of_month ? "★ Vincitore" : "☆ Nomina"}
                  </button>
                  <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(d.id)}>✕</button>
                </div>
              </div>
            ))}
            {drinks.length === 0 && <p className="admin-empty">Nessun drink pubblicato ancora.</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Orders Panel ─────────────────────────────────────────────────────────────
function OrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [scanOpen, setScanOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [scanMsg, setScanMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("drink_orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // Realtime — nowe zamówienia QR na żywo
  useEffect(() => {
    const ch = supabase.channel("orders_rt").on("postgres_changes", { event: "*", schema: "public", table: "drink_orders" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const markDone = async (id: string) => {
    await supabase.from("drink_orders").update({ status: "completed", scanned_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  // Odbiór przez 4-znakowy kod (ważny 15 min — sprawdzane po created_at)
  const redeemByCode = async () => {
    const code = codeInput.trim().toUpperCase();
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
    setTimeout(() => { setScanOpen(false); setScanMsg(""); }, 1800);
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
          <button className="admin-btn" onClick={() => { setScanOpen(true); setScanMsg(""); }}>📷 Scansiona / Codice</button>
        </div>
      </header>

      {scanOpen && (
        <div className="admin-modal-overlay" onClick={() => setScanOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ritira drink</h3>
            <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 16 }}>Scansiona il QR del cliente con la fotocamera, oppure inserisci il codice di 4 caratteri (valido 15 min).</p>
            <a className="admin-btn" href="https://www.google.com/search?q=scanner+qr+online" target="_blank" rel="noopener" style={{ display: "block", textAlign: "center", marginBottom: 14 }}>📷 Apri fotocamera per QR</a>
            <div className="admin-form">
              <label>Codice ritiro (4 caratteri)</label>
              <input value={codeInput} maxLength={6} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setScanMsg(""); }} placeholder="es. A7K2" style={{ textTransform: "uppercase", letterSpacing: "0.3em", fontSize: 22, textAlign: "center" }} onKeyDown={(e) => e.key === "Enter" && redeemByCode()} />
            </div>
            {scanMsg && <p style={{ textAlign: "center", fontWeight: 700, margin: "12px 0" }}>{scanMsg}</p>}
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={redeemByCode}>Conferma ritiro</button>
              <button className="admin-btn-ghost" onClick={() => setScanOpen(false)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-orders">
          {filtered.map((o) => (
            <div key={o.id} className={`admin-order ${o.status === "completed" ? "done" : ""}`}>
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

function MessagesPanel() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [trMap, setTrMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Realtime — nowe/zmienione wiadomości pojawiają się BEZ odświeżania strony
  useEffect(() => {
    const ch = supabase
      .channel("contact_messages_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, () => { load(); })
      .subscribe();
    // fallback polling co 15s (gdyby realtime nie był włączony w Supabase)
    const poll = setInterval(load, 15000);
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
      .map(([email, msgs]) => ({ email, msgs, last: msgs[msgs.length - 1], name: msgs[msgs.length - 1]?.name || email, unread: msgs.some((x) => !x.is_read) }))
      .sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
  }, [messages]);

  const activeThread = threads.find((t) => t.email === activeEmail) || threads[0] || null;

  // Tłumacz KAŻDĄ wiadomość klienta na włoski (auto-wykrywanie języka źródłowego)
  useEffect(() => {
    if (!activeThread) return;
    activeThread.msgs.forEach(async (m: any) => {
      if (m.message && !trMap[m.id]) {
        const it = await toItalian(m.message);
        if (it && it !== m.message) setTrMap((prev) => ({ ...prev, [m.id]: it }));
      }
    });
  }, [activeThread, trMap]);

  const markThreadRead = async (email: string) => {
    await supabase.from("contact_messages").update({ is_read: true }).eq("email", email);
    load();
  };

  const sendReply = async () => {
    if (!draft.trim() || !activeThread) return;
    setSending(true);
    const target = activeThread.last;
    // Zapisz odpowiedź admina + oznacz przeczytane
    await supabase.from("contact_messages").update({ admin_reply: draft.trim(), is_read: true }).eq("id", target.id);
    // Webhook make.com → wyśle e-mail do klienta w jego języku (tłumaczenie po stronie make/template)
    try {
      const url = process.env.NEXT_PUBLIC_MAKE_REPLY_WEBHOOK || process.env.NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK;
      if (url) {
        await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "admin_reply", email: activeThread.email, name: target.name, lang: target.language || "it", reply_it: draft.trim() }),
        });
      }
    } catch (e) { console.error(e); }
    setDraft("");
    setSending(false);
    load();
  };

  const removeThread = async (email: string) => {
    if (confirm("Eliminare tutta la conversazione?")) {
      await supabase.from("contact_messages").delete().eq("email", email);
      setActiveEmail(null);
      load();
    }
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Messaggi</h1>
        <span className="admin-count">{threads.filter((t) => t.unread).length} non letti</span>
      </header>

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="amsg-chat">
          {/* Lewa kolumna: lista konwersacji */}
          <div className="amsg-list">
            {threads.map((t) => (
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
            {threads.length === 0 && <p className="admin-empty">Nessun messaggio.</p>}
          </div>

          {/* Prawa kolumna: czat */}
          <div className="amsg-conv">
            {activeThread ? (
              <>
                <div className="amsg-conv-head">
                  <div>
                    <strong>{activeThread.name}</strong>
                    <span className="amsg-conv-meta">{activeThread.email} · 🌐 {activeThread.last.language}</span>
                  </div>
                  <button className="admin-btn-sm admin-btn-danger" onClick={() => removeThread(activeThread.email)}>🗑</button>
                </div>
                <div className="amsg-bubbles">
                  {activeThread.msgs.map((m: any) => (
                    <React.Fragment key={m.id}>
                      {/* Wiadomość klienta — po lewej */}
                      {m.message && (
                        <div className="amsg-bubble amsg-in">
                          <p>{m.message}</p>
                          {trMap[m.id] && (
                            <p className="amsg-tr">🇮🇹 {trMap[m.id]}</p>
                          )}
                          <span className="amsg-time">{new Date(m.created_at).toLocaleString("it-IT")}</span>
                        </div>
                      )}
                      {/* Odpowiedź admina — po prawej */}
                      {m.admin_reply && (
                        <div className="amsg-bubble amsg-out">
                          <p>{m.admin_reply}</p>
                          <span className="amsg-time">Tu · inviato</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="amsg-input">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Scrivi in italiano — verrà tradotto nella lingua del cliente..." rows={2}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                  <button className="admin-btn" onClick={sendReply} disabled={sending || !draft.trim()}>{sending ? "..." : "Invia →"}</button>
                </div>
              </>
            ) : <p className="admin-empty">Seleziona una conversazione.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reviews Panel (zarządzanie recenzjami lokalnymi) ─────────────────────────
function ReviewsPanel() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
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

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Recensioni Locali</h1>
        <span className="admin-count">{reviews.filter(r => !r.is_approved).length} in attesa</span>
      </header>
      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-orders">
          {reviews.map((r) => (
            <div key={r.id} className={`admin-order ${r.is_approved ? "" : ""}`}>
              <div className="admin-order-info">
                <h4>{r.name} <span style={{ color: "#f1c40f" }}>{"★".repeat(r.stars)}</span></h4>
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
          {reviews.length === 0 && <p className="admin-empty">Nessuna recensione locale.</p>}
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
  const [slotsText, setSlotsText] = useState("");
  const [closedDates, setClosedDates] = useState<string[]>([]); // YYYY-MM-DD chiusure straordinarie
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("opening_hours").select("*").eq("id", 1).single();
    setRows(data?.hours || [{ day: "Lun — Dom", time: "12:00 — 14:30 · 19:00 — 23:00", closed: false }, { day: "Martedì", time: "chiuso", closed: true }]);
    const sl = data?.time_slots || ["12:00","12:30","13:00","13:30","14:00","14:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00"];
    setSlots(sl); setSlotsText(sl.join(", "));
    setClosedDates(data?.closed_dates || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const time_slots = slotsText.split(",").map((s) => s.trim()).filter(Boolean);
    await supabase.from("opening_hours").upsert({ id: 1, hours: rows, time_slots, closed_dates: closedDates, updated_at: new Date().toISOString() });
    setSlots(time_slots);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  // Chiusura straordinaria — zamknij dany dzień jednym klikiem (zapis natychmiast → realtime na stronie)
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const toggleClosedDate = async (dateStr: string) => {
    const next = closedDates.includes(dateStr) ? closedDates.filter((d) => d !== dateStr) : [...closedDates, dateStr].sort();
    setClosedDates(next);
    const time_slots = slotsText.split(",").map((s) => s.trim()).filter(Boolean);
    await supabase.from("opening_hours").upsert({ id: 1, hours: rows, time_slots, closed_dates: next, updated_at: new Date().toISOString() });
  };

  const updRow = (i: number, k: string, v: any) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const addRow = () => setRows((r) => [...r, { day: "", time: "", closed: false }]);
  const delRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  if (loading) return <div className="admin-panel"><p className="admin-loading">Caricamento...</p></div>;

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

      <div style={{ marginTop: 28 }}>
        <label style={{ display: "block", fontSize: 13, opacity: 0.6, marginBottom: 8 }}>Orari prenotabili (separati da virgola — usati nel form di prenotazione)</label>
        <textarea className="hours-slots" rows={2} value={slotsText} onChange={(e) => setSlotsText(e.target.value)} placeholder="12:00, 12:30, 19:00, ..." />
      </div>

      {/* Chiusura straordinaria — zamknij konkretny dzień jednym klikiem */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Chiusura straordinaria</h2>
        <p style={{ opacity: 0.6, fontSize: 13, margin: "0 0 14px" }}>Chiudi un giorno specifico con un clic. Appare subito sul sito (in tempo reale).</p>
        <div className="hours-quick">
          {(() => {
            const today = new Date();
            const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
            const tToday = fmtDate(today), tTom = fmtDate(tomorrow);
            return (
              <>
                <button className={`hours-quick-btn ${closedDates.includes(tToday) ? "is-closed" : ""}`} onClick={() => toggleClosedDate(tToday)}>
                  {closedDates.includes(tToday) ? "✓ Oggi chiuso" : "Chiudi oggi"}
                </button>
                <button className={`hours-quick-btn ${closedDates.includes(tTom) ? "is-closed" : ""}`} onClick={() => toggleClosedDate(tTom)}>
                  {closedDates.includes(tTom) ? "✓ Domani chiuso" : "Chiudi domani"}
                </button>
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

function StatsPanel() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"today" | "week" | "month" | "prevmonth" | "all">("month");
  const [counts, setCounts] = useState({ orders: 0, drinks: 0, messages: 0, reviews: 0 });
  const [visits, setVisits] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [popCountry, setPopCountry] = useState<string | null>(null);

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
      const e = (map[code] ||= { code, name: v.country_name || code, count: 0, durations: [], sections: {}, conversions: 0 });
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
  const flag = (code: string) => code && code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "🌍";
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

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <>
          {/* KPI ogólne */}
          <div className="stats-kpis">
            <div className="stats-kpi"><span className="stats-kpi-val">{totalVisits}</span><span className="stats-kpi-lbl">Visite</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{conversions}</span><span className="stats-kpi-lbl">Conversioni ({convRate}%)</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{emailVisits}</span><span className="stats-kpi-lbl">Da email</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{fmtDur(avgDuration)}</span><span className="stats-kpi-lbl">Tempo medio</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{counts.orders}</span><span className="stats-kpi-lbl">Ordini QR</span></div>
            <div className="stats-kpi"><span className="stats-kpi-val">{counts.messages}</span><span className="stats-kpi-lbl">Messaggi</span></div>
          </div>

          {/* Kraje — interaktywne słupki z intensywnością */}
          <div className="stats-section">
            <h3>Da dove arrivano i visitatori</h3>
            {byCountry.length === 0 ? <p className="admin-empty">Nessun dato per questo periodo.</p> : (
              <div className="stats-countries">
                {byCountry.map((c) => (
                  <button key={c.code} className="stats-country" onClick={() => setPopCountry(c.code)}>
                    <span className="stats-country-flag">{flag(c.code)}</span>
                    <span className="stats-country-name">{c.name}</span>
                    <span className="stats-country-bar-wrap">
                      <span className="stats-country-bar" style={{ width: `${(c.count / maxCount) * 100}%`, background: intensity(c.count) }} />
                    </span>
                    <span className="stats-country-count">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popout kraju */}
          {popData && (
            <div className="stats-pop-overlay" onClick={() => setPopCountry(null)}>
              <div className="stats-pop" onClick={(e) => e.stopPropagation()}>
                <button className="stats-pop-close" onClick={() => setPopCountry(null)}>×</button>
                <div className="stats-pop-head"><span style={{ fontSize: 40 }}>{flag(popData.code)}</span><h2>{popData.name}</h2></div>
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
      @media (max-width:768px) { .amsg-chat { grid-template-columns:1fr; height:auto; } .amsg-list { flex-direction:row; overflow-x:auto; border-right:none; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; } .amsg-thread { flex-direction:column; min-width:80px; } .amsg-thread-preview { display:none; } .amsg-conv { height:60vh; } }
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
      .stats-kpi-lbl { font-size:12px; color:rgba(255,255,255,0.6); }
      .stats-section { margin-bottom:28px; }
      .stats-section h3 { font-size:16px; margin:0 0 14px; color:#fff; }
      .stats-countries { display:flex; flex-direction:column; gap:8px; }
      .stats-country { display:flex; align-items:center; gap:12px; padding:8px 12px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); cursor:pointer; transition:all .2s; width:100%; text-align:left; color:#fff; }
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
      .admin-event-card { padding:20px; border-radius:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-left:4px solid; display:flex; flex-direction:column; gap:8px; }
      .admin-event-date { font-size:12px; opacity:0.5; } .admin-event-tag { font-size:11px; color:#E8927C; }
      .admin-event-actions { display:flex; gap:8px; margin-top:8px; }

      .admin-drink-card { padding:16px; border-radius:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:10px; }
      .admin-drink-card.is-month { border-color:rgba(241,196,15,0.5); background:rgba(241,196,15,0.05); }
      .admin-drink-photo { width:100%; height:120px; object-fit:cover; border-radius:10px; }
      .admin-drink-info h4 { margin:0; font-size:16px; } .admin-drink-info span { font-size:12px; opacity:0.6; display:block; }
      .admin-drink-actions { display:flex; gap:8px; flex-wrap:wrap; }

      .admin-orders { display:flex; flex-direction:column; gap:12px; }
      .admin-order { padding:20px; border-radius:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
      .admin-order.done { opacity:0.5; }
      .admin-order-info h4 { margin:0; font-size:15px; } .admin-order-info span { font-size:12px; opacity:0.6; display:block; }
      .admin-order-time { font-size:11px; opacity:0.4; }
      .admin-order-ingr { display:flex; gap:4px; flex-wrap:wrap; flex:1; }
      .admin-pill { padding:4px 8px; border-radius:999px; font-size:10px; font-weight:600; }
      .admin-done-badge { color:#27ae60; font-size:13px; font-weight:600; }

      .admin-modal-overlay { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; padding:24px; }
      .admin-modal { width:min(520px,92vw); max-height:85vh; overflow-y:auto; background:#14181e; border-radius:20px; padding:32px; border:1px solid rgba(255,255,255,0.1); }
      .admin-modal h3 { margin:0 0 24px; font-size:22px; }
      .admin-form { display:flex; flex-direction:column; gap:14px; }
      .admin-form label { font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.5); }
      .admin-form input, .admin-form textarea, .admin-form select { width:100%; padding:12px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#fff; font-size:14px; }
      .admin-form textarea { min-height:80px; resize:vertical; }
      .admin-form-row { display:flex; align-items:center; gap:8px; }
      .admin-modal-actions { display:flex; gap:12px; margin-top:24px; position:sticky; bottom:-32px; background:linear-gradient(to top, #14181e 70%, rgba(20,24,30,0)); padding:16px 0 4px; margin-bottom:-8px; z-index:5; }
      .admin-modal-actions .admin-btn { flex:1; }
      .admin-templates { display:flex; gap:8px; flex-wrap:wrap; }
      .admin-tpl { padding:10px 16px; border-radius:10px; border:2px solid; font-size:13px; cursor:pointer; transition:all .2s; color:#fff; }
      .admin-tpl.active { transform:scale(1.05); box-shadow:0 4px 20px rgba(0,0,0,0.4); }
    `}</style>
  );
}
