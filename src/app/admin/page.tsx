"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

type Tab = "menu" | "events" | "drinks" | "orders" | "messages" | "reviews" | "stats";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("menu");
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");

  // Prosty PIN do admina (w produkcji zastąpić Supabase Auth)
  const checkPin = () => {
    if (pin === "shistoria2026") setAuthed(true);
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
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkPin()}
          />
          <button onClick={checkPin}>Entra →</button>
        </div>
        <AdminStyles />
      </div>
    );
  }

  return (
    <div className="admin">
      <aside className="admin-nav">
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
            { id: "stats", label: "Statistiche", ico: "📊" },
          ] as { id: Tab; label: string; ico: string }[]).map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <span className="admin-nav-ico">{t.ico}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="admin-main">
        {tab === "menu" && <MenuPanel />}
        {tab === "events" && <EventsPanel />}
        {tab === "drinks" && <DrinksPanel />}
        {tab === "orders" && <OrdersPanel />}
        {tab === "messages" && <MessagesPanel />}
        {tab === "reviews" && <ReviewsPanel />}
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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("menu_items").select("*").order("sort_order");
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Import menu attuale dalla pagina
  const importMenu = async () => {
    if (!confirm("Importare il menu attuale nella base dati? Questo sovrascriverà i dati esistenti.")) return;
    setLoading(true);
    // Cancella tutto
    await supabase.from("menu_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
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
    load();
  };

  const filtered = section === "all" ? items : items.filter((it) => {
    if (section === "bar") return ["cocktails", "analcolici", "spina", "bottiglia", "vodka", "grappe", "bianchi", "rossi", "bollicine"].includes(it.category?.toLowerCase());
    return !["cocktails", "analcolici", "spina", "bottiglia", "vodka", "grappe", "bianchi", "rossi", "bollicine"].includes(it.category?.toLowerCase());
  });

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
          {items.length === 0 && <button className="admin-btn" onClick={importMenu}>📥 Importa menu attuale</button>}
          <button className="admin-btn" onClick={() => setEditItem({ category: "", name: "", price: "", description: "" })}>
            + Aggiungi piatto
          </button>
        </div>
      </header>

      {editItem && (
        <div className="admin-modal-overlay" onClick={() => setEditItem(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editItem.id ? "Modifica" : "Nuovo piatto"}</h3>
            <div className="admin-form">
              <label>Categoria</label>
              <input value={editItem.category} onChange={(e) => setEditItem({ ...editItem, category: e.target.value })} placeholder="es. Antipasti, Primi..." />
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
            <thead><tr><th>Categoria</th><th>Nome</th><th>Prezzo</th><th>Allergeni</th><th></th></tr></thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td>{it.category}</td>
                  <td><strong>{it.name}</strong>{it.is_featured && <span className="admin-badge">★</span>}</td>
                  <td>{it.price}</td>
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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("community_drinks").select("*").order("created_at", { ascending: false });
    setDrinks(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleMonth = async (id: string, current: boolean) => {
    await supabase.from("community_drinks").update({ is_drink_of_month: !current }).eq("id", id);
    load();
  };

  // Ogłoś Drink del Mese — wybiera drink z najwięcej polubień (śr. likes+claimed)
  // i wysyła e-mail do WSZYSTKICH twórców (każdy w swoim języku przez make.com).
  const announceWinnerOfMonth = async () => {
    if (drinks.length === 0) { alert("Brak drinków."); return; }
    // Wybierz zwycięzcę: najwyższy score = likes + claimed_count
    const winner = [...drinks].sort((a, b) => ((b.likes || 0) + (b.claimed_count || 0)) - ((a.likes || 0) + (a.claimed_count || 0)))[0];
    if (!confirm(`Ogłosić "${winner.name}" jako Drink del Mese i wysłać e-mail do wszystkich twórców?`)) return;
    // Oznacz zwycięzcę
    await supabase.from("community_drinks").update({ is_drink_of_month: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("community_drinks").update({ is_drink_of_month: true }).eq("id", winner.id);
    // Zbierz unikalne emaile twórców
    const recipients = drinks
      .filter((d) => d.author_email)
      .map((d) => ({ email: d.author_email, name: d.author_name || "Anonimo", lang: d.language || "it" }))
      .filter((r, i, arr) => arr.findIndex((x) => x.email === r.email) === i);
    try {
      const { announceWinner } = await import("../../lib/make-webhooks");
      await announceWinner({
        winner_drink: winner.name,
        winner_author: winner.author_name,
        winner_email: winner.author_email,
        recipients,
        period: "month",
      });
      alert(`Ogłoszono "${winner.name}"! E-mail wysłany do ${recipients.length} twórców.`);
    } catch (e) {
      console.error(e);
      alert("Drink oznaczony, ale e-mail nie wyszedł (sprawdź konfigurację make.com).");
    }
    load();
  };

  const remove = async (id: string) => {
    if (confirm("Eliminare questo drink?")) {
      await supabase.from("community_drinks").delete().eq("id", id);
      load();
    }
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Drink dei Clienti</h1>
        <button className="admin-btn" onClick={announceWinnerOfMonth}>👑 Ogłoś Drink del Mese</button>
        <span className="admin-count">{drinks.length} creazioni</span>
      </header>

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-grid">
          {drinks.map((d) => (
            <div key={d.id} className={`admin-drink-card ${d.is_drink_of_month ? "is-month" : ""}`}>
              {d.photo_url && <img src={d.photo_url} alt={d.name} className="admin-drink-photo" />}
              <div className="admin-drink-info">
                <h4>{d.name}</h4>
                <span>di {d.author_name} · {d.total_ml}ml · {d.strength_label}</span>
                <span>♥ {d.likes}</span>
              </div>
              <div className="admin-drink-actions">
                <button className={`admin-btn-sm ${d.is_drink_of_month ? "admin-btn-gold" : ""}`} onClick={() => toggleMonth(d.id, d.is_drink_of_month)}>
                  {d.is_drink_of_month ? "★ Drink del Mese" : "☆ Nomina"}
                </button>
                <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(d.id)}>✕</button>
              </div>
            </div>
          ))}
          {drinks.length === 0 && <p className="admin-empty">Nessun drink pubblicato ancora.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Orders Panel ─────────────────────────────────────────────────────────────
function OrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("drink_orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markDone = async (id: string) => {
    await supabase.from("drink_orders").update({ status: "completed", scanned_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Ordini QR</h1>
        <span className="admin-count">{orders.filter((o) => o.status === "pending").length} in attesa</span>
      </header>

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-orders">
          {orders.map((o) => (
            <div key={o.id} className={`admin-order ${o.status === "completed" ? "done" : ""}`}>
              <div className="admin-order-info">
                <h4>{o.drink_name}</h4>
                <span>di {o.author_name} · {o.total_ml}ml · {o.strength_label}</span>
                <span className="admin-order-time">{new Date(o.created_at).toLocaleString("it-IT")}</span>
              </div>
              <div className="admin-order-ingr">
                {(o.ingredients || []).slice(0, 5).map((ing: any, i: number) => (
                  <span key={i} className="admin-pill" style={{ background: ing.color + "33", color: ing.color }}>{ing.name}</span>
                ))}
              </div>
              {o.status === "pending" && (
                <button className="admin-btn" onClick={() => markDone(o.id)}>✓ Fatto</button>
              )}
              {o.status === "completed" && <span className="admin-done-badge">✓ Completato</span>}
            </div>
          ))}
          {orders.length === 0 && <p className="admin-empty">Nessun ordine QR ricevuto.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Messages Panel (formularz kontaktowy — iMessage style) ───────────────────
function MessagesPanel() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    setMessages(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await supabase.from("contact_messages").update({ is_read: true }).eq("id", id);
    load();
  };

  const sendReply = async () => {
    if (!reply) return;
    await supabase.from("contact_messages").update({ admin_reply: reply.text, is_read: true }).eq("id", reply.id);
    setReply(null);
    load();
  };

  const remove = async (id: string) => {
    if (confirm("Eliminare questo messaggio?")) {
      await supabase.from("contact_messages").delete().eq("id", id);
      load();
    }
  };

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Messaggi</h1>
        <span className="admin-count">{messages.filter(m => !m.is_read).length} non letti</span>
      </header>

      {reply && (
        <div className="admin-modal-overlay" onClick={() => setReply(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rispondi</h3>
            <div className="admin-form">
              <label>Risposta (in italiano — verrà tradotta automaticamente)</label>
              <textarea value={reply.text} onChange={(e) => setReply({ ...reply, text: e.target.value })} placeholder="Scrivi la risposta..." />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={sendReply}>Invia risposta</button>
              <button className="admin-btn-ghost" onClick={() => setReply(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-orders">
          {messages.map((m) => (
            <div key={m.id} className={`admin-order ${m.is_read ? "done" : ""}`}>
              <div className="admin-order-info">
                <h4>{m.name}</h4>
                <span>{m.email} · {m.phone || "—"} · {m.people} pers. · {m.date || "—"}</span>
                <span className="admin-order-time">{new Date(m.created_at).toLocaleString("it-IT")}</span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>🌐 {m.language}</span>
              </div>
              <div style={{ flex: 1, fontSize: 13, opacity: 0.8 }}>
                {m.message || <em style={{ opacity: 0.4 }}>Nessun messaggio</em>}
                {m.admin_reply && <p style={{ marginTop: 8, color: "#27ae60", fontWeight: 600 }}>↳ {m.admin_reply}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!m.is_read && <button className="admin-btn-sm" onClick={() => markRead(m.id)}>✓</button>}
                <button className="admin-btn-sm" onClick={() => setReply({ id: m.id, text: "" })}>↩</button>
                <button className="admin-btn-sm admin-btn-danger" onClick={() => remove(m.id)}>✕</button>
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="admin-empty">Nessun messaggio ricevuto.</p>}
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
function StatsPanel() {
  const [stats, setStats] = useState<{ orders: number; drinks: number; messages: number; reviews: number }>({ orders: 0, drinks: 0, messages: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [o, d, m, r] = await Promise.all([
        supabase.from("drink_orders").select("id", { count: "exact", head: true }),
        supabase.from("community_drinks").select("id", { count: "exact", head: true }),
        supabase.from("contact_messages").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        orders: o.count || 0,
        drinks: d.count || 0,
        messages: m.count || 0,
        reviews: r.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Statistiche</h1>
      </header>
      {loading ? <p className="admin-loading">Caricamento...</p> : (
        <div className="admin-grid">
          <div className="admin-event-card" style={{ borderLeftColor: "#E8927C" }}>
            <span style={{ fontSize: 36, fontWeight: 800 }}>{stats.orders}</span>
            <h4>Ordini QR</h4>
            <span className="admin-event-tag">drink ordinati via QR</span>
          </div>
          <div className="admin-event-card" style={{ borderLeftColor: "#5BB8D4" }}>
            <span style={{ fontSize: 36, fontWeight: 800 }}>{stats.drinks}</span>
            <h4>Drink pubblicati</h4>
            <span className="admin-event-tag">nella community</span>
          </div>
          <div className="admin-event-card" style={{ borderLeftColor: "#27ae60" }}>
            <span style={{ fontSize: 36, fontWeight: 800 }}>{stats.messages}</span>
            <h4>Messaggi</h4>
            <span className="admin-event-tag">formularz kontaktowy</span>
          </div>
          <div className="admin-event-card" style={{ borderLeftColor: "#f1c40f" }}>
            <span style={{ fontSize: 36, fontWeight: 800 }}>{stats.reviews}</span>
            <h4>Recensioni</h4>
            <span className="admin-event-tag">komentarze lokalne</span>
          </div>
        </div>
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

      .admin { display:grid; grid-template-columns:260px 1fr; min-height:100vh; background:#0a0e14; color:#fff; font-family:system-ui; }
      @media (max-width:768px) {
        .admin { grid-template-columns:1fr; }
        .admin-nav { padding:16px; border-right:none; border-bottom:1px solid rgba(255,255,255,0.08); }
        .admin-nav nav { flex-direction:row; flex-wrap:wrap; gap:4px; }
        .admin-nav nav button { padding:8px 12px; font-size:12px; }
        .admin-main { padding:16px; max-height:none; }
        .admin-panel-head { flex-direction:column; align-items:flex-start; gap:12px; }
        .admin-panel-head h1 { font-size:22px; }
        .admin-table { font-size:12px; }
        .admin-grid { grid-template-columns:1fr !important; }
        .admin-order { flex-direction:column; gap:12px; }
      }
      .admin-nav { padding:32px 20px; background:rgba(255,255,255,0.02); border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:32px; }
      .admin-logo h2 { font-size:24px; margin:0; } .admin-logo span { font-size:11px; opacity:0.5; letter-spacing:0.15em; text-transform:uppercase; }
      .admin-nav nav { display:flex; flex-direction:column; gap:4px; }
      .admin-nav nav button { display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; background:none; border:none; color:rgba(255,255,255,0.7); font-size:14px; cursor:pointer; transition:all .2s; text-align:left; width:100%; }
      .admin-nav nav button:hover { background:rgba(255,255,255,0.06); color:#fff; }
      .admin-nav nav button.active { background:rgba(232,146,124,0.15); color:#E8927C; font-weight:600; }
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
      .admin-badge { display:inline-block; margin-left:8px; color:#f1c40f; }

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
      .admin-modal-actions { display:flex; gap:12px; margin-top:24px; }
      .admin-templates { display:flex; gap:8px; flex-wrap:wrap; }
      .admin-tpl { padding:10px 16px; border-radius:10px; border:2px solid; font-size:13px; cursor:pointer; transition:all .2s; color:#fff; }
      .admin-tpl.active { transform:scale(1.05); box-shadow:0 4px 20px rgba(0,0,0,0.4); }
    `}</style>
  );
}
