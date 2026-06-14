"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

// PIN barmana (ten sam co admin/order). Urządzenie zapamiętane w localStorage.
const BARMAN_PIN = "shistoria2026";
const AUTH_KEY = "sh-barman-device";

export default function RewardPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code || "");
  const [reward, setReward] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    try { if (localStorage.getItem(AUTH_KEY) === "1") setAuthed(true); } catch {}
  }, []);

  useEffect(() => {
    if (tried.current) return; tried.current = true;
    (async () => {
      const { data } = await supabase.from("rewards").select("*").eq("code", code).maybeSingle();
      setReward(data || null);
      setLoading(false);
    })();
  }, [code]);

  const checkPin = () => {
    if (pin === BARMAN_PIN) { try { localStorage.setItem(AUTH_KEY, "1"); } catch {} setAuthed(true); setPinErr(false); }
    else { setPinErr(true); setPin(""); }
  };

  const redeem = async () => {
    if (!reward || reward.redeemed) return;
    setRedeeming(true);
    const { error } = await supabase.from("rewards").update({ redeemed: true, redeemed_at: new Date().toISOString() }).eq("code", code).eq("redeemed", false);
    if (!error) setReward({ ...reward, redeemed: true, redeemed_at: new Date().toISOString() });
    setRedeeming(false);
  };

  if (loading) return <div style={S.page}><p style={{ opacity: 0.7 }}>Caricamento…</p></div>;
  if (!reward) return <div style={S.page}><div style={S.card}><h1 style={S.title}>Codice non valido</h1><p style={S.sub}>Questo premio non esiste o è stato rimosso.</p></div></div>;

  // Ekran PIN barmana
  if (!authed) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <span style={S.kicker}>S'Historia · Barman</span>
          <h1 style={S.title}>Accesso barman</h1>
          <p style={S.sub}>Inserisci il PIN una volta — questo dispositivo verrà ricordato.</p>
          <input type="password" inputMode="text" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="PIN" value={pin} autoFocus
            onChange={(e) => { setPin(e.target.value); setPinErr(false); }}
            onKeyDown={(e) => e.key === "Enter" && checkPin()}
            style={{ ...S.pinInput, ...(pinErr ? { borderColor: "#e74c3c" } : {}) }} />
          {pinErr && <span style={S.pinErr}>⚠ PIN errato. Riprova.</span>}
          <button onClick={checkPin} style={S.btn}>Sblocca →</button>
        </div>
      </div>
    );
  }

  const periodLabel = reward.period === "week" ? "Drink della Settimana" : "Drink del Mese";

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: 52, textAlign: "center" }}>🏆</div>
        <span style={S.kicker}>{periodLabel} · Premio</span>
        <h1 style={S.title}>{reward.winner_name || "Cliente"} ha vinto!</h1>
        <p style={S.sub}>Drink vincitore: <strong style={{ color: "#E8927C" }}>{reward.drink_name || "—"}</strong></p>

        {reward.redeemed ? (
          <div style={S.usedBox}>
            <div style={{ fontSize: 30 }}>✅</div>
            <strong style={{ fontSize: 18 }}>Premio già utilizzato</strong>
            <span style={{ opacity: 0.7, fontSize: 13 }}>
              {reward.redeemed_at ? new Date(reward.redeemed_at).toLocaleString("it-IT") : ""}
            </span>
          </div>
        ) : (
          <>
            <div style={S.freeBox}>
              <div style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: "#F1C40F", fontWeight: 800 }}>🍸 1 Drink Gratuito</div>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.5 }}>
                Il cliente può scegliere <strong>qualsiasi drink</strong>, offerto dalla casa.
              </p>
            </div>
            <div style={S.codeBox}>Codice: <strong>{reward.code}</strong></div>
            <button onClick={redeem} disabled={redeeming} style={S.btn}>
              {redeeming ? "Attendere…" : "✓ Segna come ritirato"}
            </button>
            <p style={{ ...S.sub, fontSize: 12, marginTop: 10 }}>Una volta segnato, il premio non sarà più utilizzabile.</p>
          </>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a1822", color: "#eaf2f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif" },
  card: { width: "100%", maxWidth: 420, background: "linear-gradient(180deg,#16222e,#0f1b26)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: 30, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" },
  kicker: { display: "block", textAlign: "center", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#E8927C", fontWeight: 700, marginTop: 8 },
  title: { fontSize: 26, fontWeight: 800, margin: "10px 0 6px", letterSpacing: "-0.02em", textAlign: "center" },
  sub: { fontSize: 14, opacity: 0.7, textAlign: "center", margin: 0 },
  freeBox: { background: "rgba(241,196,15,0.1)", border: "1px solid rgba(241,196,15,0.4)", borderRadius: 16, padding: 20, margin: "20px 0 14px", textAlign: "center" },
  codeBox: { textAlign: "center", fontSize: 14, opacity: 0.8, marginBottom: 16, fontFamily: "monospace", letterSpacing: 2 },
  usedBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 24, marginTop: 18, background: "rgba(46,204,113,0.1)", border: "1px solid rgba(46,204,113,0.4)", borderRadius: 16, textAlign: "center" },
  btn: { width: "100%", padding: 15, borderRadius: 12, border: "none", background: "#E8927C", color: "#1a1014", fontWeight: 800, fontSize: 15, cursor: "pointer" },
  pinInput: { width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 18, textAlign: "center", letterSpacing: "0.3em", margin: "16px 0 12px", outline: "none" },
  pinErr: { display: "block", color: "#e74c3c", fontSize: 13, marginBottom: 12, textAlign: "center" },
};
