"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

export default function OrderPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("drink_orders")
        .select("*")
        .eq("id", params.id)
        .single();
      setOrder(data);
      setLoading(false);
      if (data?.status === "completed") setDone(true);
    };
    load();
  }, [params.id]);

  const markDone = async () => {
    await supabase
      .from("drink_orders")
      .update({ status: "completed", scanned_at: new Date().toISOString() })
      .eq("id", params.id);
    // Jeśli zamówienie powiązane z drinkiem community → zwiększ licznik odebrań (claimed_count)
    if (order?.drink_id) {
      const { error: rpcErr } = await supabase.rpc("increment_claims", { drink_uuid: order.drink_id });
      if (rpcErr) {
        // fallback: ręczny inkrement gdy RPC nie istnieje
        const { data: cur } = await supabase
          .from("community_drinks")
          .select("claimed_count")
          .eq("id", order.drink_id)
          .single();
        if (cur) {
          await supabase
            .from("community_drinks")
            .update({ claimed_count: (cur.claimed_count || 0) + 1 })
            .eq("id", order.drink_id);
        }
      }
    }
    setDone(true);
  };

  if (loading) return <div style={styles.page}><p style={styles.loading}>Caricamento ordine...</p></div>;
  if (!order) return <div style={styles.page}><p style={styles.error}>Ordine non trovato.</p></div>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.kicker}>S'Historia · Ordine</span>
          <h1 style={styles.title}>{order.drink_name}</h1>
          <p style={styles.author}>di <strong>{order.author_name}</strong></p>
        </div>

        <div style={styles.stats}>
          <div style={styles.stat}><span style={styles.statValue}>{order.total_ml}</span><span style={styles.statLabel}>ml</span></div>
          <div style={styles.stat}><span style={styles.statValue}>{order.strength_label}</span><span style={styles.statLabel}>forza</span></div>
          <div style={styles.stat}><span style={styles.statValue}>{(order.ingredients || []).length}</span><span style={styles.statLabel}>ingredienti</span></div>
        </div>

        <div style={styles.ingredients}>
          <h3 style={styles.sectionTitle}>Ingredienti</h3>
          <div style={styles.pillsWrap}>
            {(order.ingredients || []).map((ing: any, i: number) => (
              <div key={i} style={{ ...styles.pill, background: (ing.color || "#888") + "22", borderColor: ing.color || "#888" }}>
                <span style={{ ...styles.pillDot, background: ing.color }} />
                <span>{ing.name}</span>
                <span style={styles.pillMl}>{ing.ml}ml</span>
              </div>
            ))}
          </div>
        </div>

        {!done ? (
          <button onClick={markDone} style={styles.btn}>
            ✓ Conferma
          </button>
        ) : (
          <div style={styles.doneBox}>
            <span style={styles.doneIco}>✓</span>
            <span>Confermato</span>
          </div>
        )}

        <p style={styles.footer}>{new Date(order.created_at).toLocaleString("it-IT")}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0e14", padding: 24, fontFamily: "system-ui" },
  card: { width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 32, color: "#fff" },
  header: { textAlign: "center", marginBottom: 24 },
  kicker: { fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "#E8927C" },
  title: { fontSize: 28, fontWeight: 800, margin: "8px 0 4px", letterSpacing: "-0.02em" },
  author: { fontSize: 14, opacity: 0.6 },
  stats: { display: "flex", justifyContent: "space-around", padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 },
  stat: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontWeight: 800 },
  statLabel: { fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" as const, opacity: 0.5 },
  ingredients: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase" as const, opacity: 0.5, marginBottom: 12 },
  pillsWrap: { display: "flex", flexDirection: "column" as const, gap: 8 },
  pill: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, border: "1px solid", fontSize: 14 },
  pillDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  pillMl: { marginLeft: "auto", fontSize: 12, opacity: 0.6 },
  btn: { width: "100%", padding: 16, borderRadius: 12, background: "#27ae60", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" },
  doneBox: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, background: "rgba(39,174,96,0.15)", color: "#27ae60", fontWeight: 700 },
  doneIco: { fontSize: 20 },
  footer: { textAlign: "center", fontSize: 11, opacity: 0.4, marginTop: 20 },
  loading: { color: "#fff", opacity: 0.5, fontStyle: "italic" },
  error: { color: "#e74c3c", fontWeight: 600 },
};
