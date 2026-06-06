import React from 'react';
// Cocktail Builder v2 — 100vh fit, power meter, mL HUD, accordions, pour animation
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC, useMemo: useMemoC } = React;

// Power levels by alcohol %
const POWER_LEVELS = [
  { min: 0, max: 0.001, label: "Senza alcol", dots: 0 },
  { min: 0.001, max: 0.20, label: "Lieve", dots: 1 },
  { min: 0.20, max: 0.40, label: "Morbida", dots: 2 },
  { min: 0.40, max: 0.60, label: "Bilanciata", dots: 3 },
  { min: 0.60, max: 0.80, label: "Forte", dots: 4 },
  { min: 0.80, max: 0.9999, label: "Tosta", dots: 5 },
];

function CocktailBuilder() {
  const [pours, setPours] = useStateC({}); // id -> count
  const [stage, setStage] = useStateC("build"); // build | shaking | result | match | published
  const [drinkName, setDrinkName] = useStateC("");
  const [publishedList, setPublishedList] = useStateC(window.COMMUNITY_COCKTAILS);
  const [pourAnim, setPourAnim] = useStateC(null);
  const [openLeft, setOpenLeft] = useStateC("Bollicine");
  const [openRight, setOpenRight] = useStateC("Distillati");

  const shakerRef = useRefC(null);
  const sectionRef = useRefC(null);

  const ingredients = window.COCKTAIL_INGREDIENTS;
  const ingById = useMemoC(() => Object.fromEntries(ingredients.map((i) => [i.id, i])), [ingredients]);

  const leftGroups = useMemoC(() => {
    const g = {};
    for (const i of ingredients) if (i.side === "left") (g[i.group] ||= []).push(i);
    return g;
  }, [ingredients]);

  const rightGroups = useMemoC(() => {
    const g = {};
    for (const i of ingredients) if (i.side === "right") (g[i.group] ||= []).push(i);
    return g;
  }, [ingredients]);

  // Compute pour totals
  const stats = useMemoC(() => {
    let total = 0, alcoholMl = 0, mixerMl = 0;
    const items = [];
    let r = 0, g = 0, b = 0; // weighted color
    for (const [id, count] of Object.entries(pours)) {
      const ing = ingById[id];
      if (!ing || count <= 0) continue;
      const ml = ing.volume * count;
      total += ml;
      if (ing.isAlcohol) alcoholMl += ml;
      else mixerMl += ml;
      items.push({ id, count, ml, ing });
      const hex = ing.color.replace("#", "");
      r += parseInt(hex.slice(0, 2), 16) * ml;
      g += parseInt(hex.slice(2, 4), 16) * ml;
      b += parseInt(hex.slice(4, 6), 16) * ml;
    }
    const strength = total > 0 ? alcoholMl / total : 0;
    const extreme = total > 0 && mixerMl === 0 && alcoholMl > 0;
    const power = extreme
      ? { label: "EXTREME", dots: 5, extreme: true }
      : POWER_LEVELS.find((l) => strength >= l.min && strength < l.max) || POWER_LEVELS[0];
    const color = total > 0
      ? `rgb(${Math.round(r/total)},${Math.round(g/total)},${Math.round(b/total)})`
      : "#444";
    return { total, alcoholMl, mixerMl, items, strength, power, color, extreme };
  }, [pours, ingById]);

  const selectedCount = Object.values(pours).reduce((a, b) => a + b, 0);

  // Background tint based on power
  useEffectC(() => {
    if (!sectionRef.current) return;
    const sec = sectionRef.current;
    if (stats.extreme) {
      sec.style.setProperty("--ckb-bg-a", "#3a1612");
      sec.style.setProperty("--ckb-bg-b", "#5a1a08");
      sec.style.setProperty("--ckb-bg-c", "#7a2206");
    } else {
      // strength 0→1 maps deeper blue → richer dark
      const s = stats.strength;
      const lerp = (a, b, t) => Math.round(a + (b - a) * t);
      const a = `rgb(${lerp(14, 6, s)},${lerp(34, 18, s)},${lerp(48, 28, s)})`;
      const b = `rgb(${lerp(26, 10, s)},${lerp(61, 32, s)},${lerp(82, 50, s)})`;
      const c = `rgb(${lerp(20, 5, s)},${lerp(48, 22, s)},${lerp(64, 36, s)})`;
      sec.style.setProperty("--ckb-bg-a", a);
      sec.style.setProperty("--ckb-bg-b", b);
      sec.style.setProperty("--ckb-bg-c", c);
    }
  }, [stats.strength, stats.extreme]);

  // Match detection (by ingredient IDs, ignoring multiplicity)
  const match = useMemoC(() => {
    const ids = stats.items.map((it) => it.id);
    if (ids.length < 2) return null;
    const sorted = [...ids].sort().join("|");
    return window.KNOWN_COCKTAILS.find((k) => [...k.ingr].sort().join("|") === sorted);
  }, [stats.items]);

  const pourIngredient = (id, fromEl) => {
    if (stage !== "build") return;
    if (selectedCount >= 12) return;
    const ing = ingById[id];
    if (!ing) return;
    // Animation: bottle floats from row → top of shaker → returns
    if (fromEl && shakerRef.current) {
      const fromRect = fromEl.getBoundingClientRect();
      const shakerRect = shakerRef.current.getBoundingClientRect();
      setPourAnim({
        id,
        color: ing.color,
        label: ing.label,
        fromX: fromRect.left + fromRect.width / 2,
        fromY: fromRect.top + fromRect.height / 2,
        toX: shakerRect.left + shakerRect.width / 2,
        toY: shakerRect.top + 40,
        ts: Date.now(),
      });
      setTimeout(() => setPourAnim(null), 1100);
    }
    setPours((p) => ({ ...p, [id]: (p[id] || 0) + 1 }));
  };

  const reduceIngredient = (id) => {
    if (stage !== "build") return;
    setPours((p) => {
      const next = { ...p };
      if ((next[id] || 0) <= 1) delete next[id];
      else next[id] = next[id] - 1;
      return next;
    });
  };

  const removeIngredient = (id) => {
    if (stage !== "build") return;
    setPours((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  };

  const reset = () => {
    setStage("build");
    setPours({});
    setDrinkName("");
  };

  const shake = () => {
    if (selectedCount < 2 || stage !== "build") return;
    setStage("shaking");
    setTimeout(() => {
      if (match) setStage("match");
      else setStage("result");
    }, 2600);
  };

  const publish = () => {
    if (!drinkName.trim()) return;
    setPublishedList((list) => [
      { name: drinkName.trim(), by: "Tu", ingr: stats.items.map((it) => it.id), likes: 1, comments: 0, comment: "Appena pubblicato 🎉 chiedi al barman con il QR." },
      ...list,
    ]);
    setStage("published");
  };

  return (
    <section className={`ckb2 ${stats.extreme ? "extreme" : ""}`} id="cocktail-builder" ref={sectionRef}>
      <div className="ckb2-bg" />
      <div className="ckb2-bg-glow ckb2-bg-glow-l" />
      <div className="ckb2-bg-glow ckb2-bg-glow-r" />

      {/* Header (above the 100vh lab) */}
      <div className="ckb2-prehead container">
        <header className="ckb2-head reveal">
          <span className="kicker">— Laboratorio · 05 BIS</span>
          <h2 className="ckb2-h2">Crea il tuo cocktail</h2>
          <p className="ckb2-intro">
            Versa dai due lati. Lo shaker mostra <em>moc, proporcje, mililitry</em>. Se la
            combinazione esiste già, te lo diciamo. Ricevi un QR e ordinalo al barman.
          </p>
        </header>
      </div>

      {/* THE LAB — 100vh */}
      <div className="ckb2-lab-wrap">
        <div className="container ckb2-lab-container">

          {/* Power meter strip on top */}
          <div className="ckb2-power">
            <div className="ckb2-power-side">
              <span className="kicker">Forza</span>
              <span className="ckb2-power-label">{stats.power.label}</span>
            </div>
            <div className="ckb2-power-dots">
              {[1,2,3,4,5].map((n) => (
                <span key={n} className={`pdot ${n <= stats.power.dots ? "on" : ""}`} />
              ))}
              {stats.extreme && <span className="pdot extreme">🔥</span>}
            </div>
            <div className="ckb2-power-side ckb2-power-vol">
              <span className="kicker">Volume</span>
              <span className="ckb2-power-label">{stats.total} ml</span>
            </div>
          </div>

          {/* 3-column body */}
          <div className="ckb2-grid">
            {/* LEFT accordions */}
            <aside className="ckb2-side ckb2-side-l">
              <div className="ckb2-side-head">
                <span className="kicker">← Riempitivi</span>
              </div>
              {Object.entries(leftGroups).map(([name, items]) => (
                <Accordion
                  key={name}
                  name={name}
                  items={items}
                  open={openLeft === name}
                  onToggle={() => setOpenLeft((o) => o === name ? null : name)}
                  pours={pours}
                  onPour={pourIngredient}
                  side="left"
                />
              ))}
            </aside>

            {/* CENTER stage */}
            <div className="ckb2-center">
              <div className="ckb2-shaker-frame" ref={shakerRef}>
                {stage === "result" || stage === "match" || stage === "published" ? (
                  <ResultGlass color={stats.color} />
                ) : (
                  <ShakerSVG
                    color={stats.color}
                    fill={Math.min(0.85, stats.total / 320)}
                    extreme={stats.extreme}
                    shaking={stage === "shaking"}
                  />
                )}
              </div>

              {/* HUD */}
              <div className="ckb2-hud">
                {stage === "build" && stats.items.length === 0 && (
                  <p className="ckb2-hud-empty serif-quote">
                    Clicca un ingrediente per iniziare.
                  </p>
                )}
                {stage === "build" && stats.items.length > 0 && (
                  <div className="ckb2-hud-list">
                    {stats.items.map((it) => {
                      const pct = (it.ml / stats.total * 100).toFixed(0);
                      return (
                        <div key={it.id} className="ckb2-hud-row">
                          <span className="ckb2-hud-dot" style={{ background: it.ing.color }} />
                          <span className="ckb2-hud-name">{it.ing.label}{it.count > 1 ? <em> ×{it.count}</em> : null}</span>
                          <span className="ckb2-hud-bar"><span style={{ width: `${pct}%`, background: it.ing.color }} /></span>
                          <span className="ckb2-hud-ml">{it.ml}ml</span>
                          <span className="ckb2-hud-pct">{pct}%</span>
                          <button className="ckb2-hud-x" onClick={() => removeIngredient(it.id)}>×</button>
                        </div>
                      );
                    })}
                    {match && (
                      <div className="ckb2-prematch">
                        <span className="kicker" style={{ color: "var(--c-coral)" }}>🍸 Esiste già</span>
                        <span className="ckb2-prematch-name">{match.name}</span>
                      </div>
                    )}
                  </div>
                )}
                {stage === "shaking" && (
                  <div className="ckb2-loading">
                    <div className="ckb2-loading-bars"><span/><span/><span/><span/><span/></div>
                    <p>Il barman sta shakerando<br/><em>— mio cugino al lavoro</em></p>
                  </div>
                )}
                {stage === "result" && <ResultPanel pours={pours} stats={stats} drinkName={drinkName} setDrinkName={setDrinkName} onPublish={publish} ingredients={ingredients} />}
                {stage === "match" && <MatchPanel match={match} ingredients={ingredients} />}
                {stage === "published" && <PublishedPanel drinkName={drinkName} stats={stats} ingredients={ingredients} />}
              </div>
            </div>

            {/* RIGHT accordions */}
            <aside className="ckb2-side ckb2-side-r">
              <div className="ckb2-side-head">
                <span className="kicker">Distillati →</span>
              </div>
              {Object.entries(rightGroups).map(([name, items]) => (
                <Accordion
                  key={name}
                  name={name}
                  items={items}
                  open={openRight === name}
                  onToggle={() => setOpenRight((o) => o === name ? null : name)}
                  pours={pours}
                  onPour={pourIngredient}
                  side="right"
                />
              ))}
            </aside>
          </div>

          {/* Bottom CTA row */}
          <div className="ckb2-footrow">
            <span className="ckb2-foot-howto">
              <strong>1)</strong> Scegli — <strong>2)</strong> Shakera — <strong>3)</strong> Nome — <strong>4)</strong> QR al barman
            </span>
            <div className="ckb2-cta-wrap">
              {stage === "build" && selectedCount > 0 && (
                <button className="ckb2-reset-btn" onClick={() => setPours({})}>svuota</button>
              )}
              <button
                className="ckb2-shake-btn"
                onClick={stage === "build" ? shake : reset}
                disabled={stage === "build" && selectedCount < 2}
              >
                {stage === "build" ? (
                  <>
                    <span className="ckb2-shake-icon">∿</span>
                    <span>SHAKERA!</span>
                    <span className="ckb2-shake-arrow">→</span>
                  </>
                ) : stage === "shaking" ? (
                  <span>...</span>
                ) : (
                  <span>↺ RICOMINCIA</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Pour animation overlay */}
        {pourAnim && <PourAnimation anim={pourAnim} />}
      </div>

      {/* Community wall (separate section, below 100vh) */}
      <div className="container ckb2-community">
        <header className="ckb2-community-head reveal">
          <div>
            <span className="kicker" style={{ color: "var(--c-coral)" }}>— Community</span>
            <h3 className="ckb2-community-title">I cocktail dei clienti</h3>
          </div>
          <span className="ckb2-community-count">{publishedList.length} creazioni</span>
        </header>
        <div className="ckb2-community-grid">
          {publishedList.map((c, i) => (
            <CommunityCard key={i} c={c} ingredients={ingredients} index={i} />
          ))}
        </div>
      </div>

      <style>{`
        .ckb2 { color: #fff; position: relative; overflow: hidden; min-height: 100vh; border-top-left-radius: 40px; border-top-right-radius: 40px; --ckb-bg-a: #0E2230; --ckb-bg-b: #1A3D52; --ckb-bg-c: #15303F; }
        .ckb2-bg { position: absolute; inset: 0; background: linear-gradient(180deg, var(--ckb-bg-a) 0%, var(--ckb-bg-b) 50%, var(--ckb-bg-c) 100%); transition: background 0.8s ease; }
        .ckb2-bg-glow { position: absolute; width: 50vw; height: 50vw; border-radius: 50%; filter: blur(140px); pointer-events: none; opacity: 0.35; transition: opacity 0.6s, background 0.6s; }
        .ckb2-bg-glow-l { background: var(--c-sky); top: 15%; left: -15%; }
        .ckb2-bg-glow-r { background: var(--c-coral); bottom: 5%; right: -15%; }
        .ckb2.extreme .ckb2-bg-glow-l { background: #FF6B35; opacity: 0.5; }
        .ckb2.extreme .ckb2-bg-glow-r { background: #FF3030; opacity: 0.6; }

        .ckb2-prehead { padding: 120px 0 60px; position: relative; z-index: 2; }
        .ckb2-head { text-align: center; max-width: 900px; margin: 0 auto; }
        .ckb2-head .kicker { color: var(--c-coral); display: block; margin-bottom: 24px; }
        .ckb2-h2 { font-family: var(--f-display); font-weight: 800; font-size: clamp(40px, 7vw, 88px); line-height: 0.95; letter-spacing: -0.04em; color: #fff; white-space: normal; text-wrap: balance; max-width: 100%; text-align: center; width: 100%; margin-inline: auto; }
        @media (max-width: 600px) { .ckb2-h2 { font-size: clamp(36px, 11vw, 72px); } }
        .ckb2-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(16px, 1.5vw, 22px); line-height: 1.5; margin-top: 20px; max-width: 580px; margin-left: auto; margin-right: auto; color: rgba(255,255,255,0.78); }
        .ckb2-intro em { color: var(--c-coral); }

        /* The 100vh lab */
        .ckb2-lab-wrap { position: relative; z-index: 2; min-height: 100vh; display: flex; align-items: stretch; padding: 24px 0; }
        @media (max-width: 1023px) { .ckb2-lab-wrap { min-height: auto; padding: 40px 0; } }
        .ckb2-lab-container { display: flex; flex-direction: column; gap: 20px; flex: 1; max-height: calc(100vh - 48px); }
        @media (max-width: 1023px) { .ckb2-lab-container { max-height: none; } }

        /* Power meter */
        .ckb2-power { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center; padding: 12px 24px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; backdrop-filter: blur(20px); flex-shrink: 0; }
        .ckb2-power-side { display: flex; align-items: baseline; gap: 8px; }
        .ckb2-power-vol { justify-content: flex-end; text-align: right; }
        .ckb2-power-side .kicker { color: rgba(255,255,255,0.55); font-size: 10px; }
        .ckb2-power-label { font-family: var(--f-display); font-weight: 800; font-size: 16px; letter-spacing: -0.01em; }
        .ckb2.extreme .ckb2-power-label { color: #FFCB47; animation: extremeGlow 0.8s ease-in-out infinite alternate; }
        @keyframes extremeGlow { from { text-shadow: 0 0 8px rgba(255,107,53,0.5); } to { text-shadow: 0 0 20px rgba(255,107,53,1); } }
        .ckb2-power-dots { display: flex; gap: 8px; align-items: center; }
        .pdot { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15); transition: all 0.3s; }
        .pdot.on { background: var(--c-coral); border-color: var(--c-coral); box-shadow: 0 0 12px rgba(232,146,124,0.6); }
        .pdot.extreme { width: auto; height: auto; padding: 0; border: 0; background: transparent; font-size: 16px; box-shadow: none; animation: flame 0.5s ease-in-out infinite alternate; }
        @keyframes flame { from { transform: scale(0.9) rotate(-3deg); } to { transform: scale(1.1) rotate(3deg); } }

        /* Body grid */
        .ckb2-grid { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 20px; flex: 1; min-height: 0; }
        @media (max-width: 1023px) {
          .ckb2-grid { grid-template-columns: 1fr; gap: 16px; }
        }

        /* Side accordions */
        .ckb2-side { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
        .ckb2-side-head { padding: 0 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .ckb2-side-head .kicker { color: var(--c-sky); }

        /* CENTER stage */
        .ckb2-center { display: flex; flex-direction: column; align-items: center; gap: 12px; min-height: 0; padding: 0 8px; }
        .ckb2-shaker-frame { flex: 0 0 auto; width: 180px; height: 280px; position: relative; }
        @media (max-width: 1023px) { .ckb2-shaker-frame { width: 200px; height: 300px; } }
        .ckb2-hud { flex: 1; width: 100%; max-width: 460px; overflow-y: auto; padding: 0 4px; }
        .ckb2-hud::-webkit-scrollbar { width: 4px; }
        .ckb2-hud::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

        .ckb2-hud-empty { font-size: 15px; opacity: 0.45; text-align: center; padding: 24px 0; }
        .ckb2-hud-list { display: flex; flex-direction: column; gap: 6px; }
        .ckb2-hud-row { display: grid; grid-template-columns: 12px 1.2fr 80px 50px 36px 22px; gap: 8px; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; font-size: 12px; transition: background 0.2s; }
        .ckb2-hud-row:hover { background: rgba(255,255,255,0.08); }
        .ckb2-hud-dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.4); }
        .ckb2-hud-name { font-family: var(--f-body); font-weight: 500; }
        .ckb2-hud-name em { font-family: var(--f-display); font-style: normal; font-weight: 800; color: var(--c-coral); margin-left: 4px; font-size: 11px; }
        .ckb2-hud-bar { background: rgba(255,255,255,0.08); height: 4px; border-radius: 2px; overflow: hidden; position: relative; }
        .ckb2-hud-bar span { position: absolute; left: 0; top: 0; bottom: 0; transition: width 0.4s var(--ease-out); border-radius: 2px; }
        .ckb2-hud-ml { font-family: var(--f-display); font-weight: 700; color: var(--c-sky); text-align: right; font-size: 12px; }
        .ckb2-hud-pct { font-family: var(--f-serif); font-style: italic; font-size: 11px; opacity: 0.7; text-align: right; }
        .ckb2-hud-x { width: 20px; height: 20px; border-radius: 50%; color: rgba(255,255,255,0.4); font-size: 16px; line-height: 1; transition: all 0.2s; }
        .ckb2-hud-x:hover { background: var(--c-coral); color: #fff; }
        .ckb2-prematch { display: flex; align-items: baseline; gap: 8px; padding: 10px 14px; background: rgba(232,146,124,0.15); border: 1px solid rgba(232,146,124,0.35); border-radius: 10px; margin-top: 6px; }
        .ckb2-prematch .kicker { display: inline; }
        .ckb2-prematch-name { font-family: var(--f-display); font-weight: 700; font-size: 15px; }

        /* Loading state */
        .ckb2-loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; text-align: center; }
        .ckb2-loading-bars { display: flex; gap: 4px; }
        .ckb2-loading-bars span { display: block; width: 4px; height: 28px; background: var(--c-coral); border-radius: 2px; animation: bars 1.2s ease-in-out infinite; }
        .ckb2-loading-bars span:nth-child(1) { animation-delay: 0s; }
        .ckb2-loading-bars span:nth-child(2) { animation-delay: 0.1s; }
        .ckb2-loading-bars span:nth-child(3) { animation-delay: 0.2s; }
        .ckb2-loading-bars span:nth-child(4) { animation-delay: 0.3s; }
        .ckb2-loading-bars span:nth-child(5) { animation-delay: 0.4s; }
        @keyframes bars { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        .ckb2-loading p { font-family: var(--f-display); font-weight: 700; font-size: 14px; line-height: 1.4; }
        .ckb2-loading p em { display: block; font-family: var(--f-serif); font-weight: 400; font-size: 12px; opacity: 0.6; margin-top: 4px; }

        /* Bottom CTA row */
        .ckb2-footrow { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; flex-shrink: 0; backdrop-filter: blur(20px); }
        .ckb2-foot-howto { font-size: 12px; color: rgba(255,255,255,0.65); }
        .ckb2-foot-howto strong { color: var(--c-sky); font-weight: 700; }
        @media (max-width: 768px) { .ckb2-foot-howto { display: none; } }
        .ckb2-cta-wrap { display: flex; align-items: center; gap: 12px; }
        .ckb2-reset-btn { padding: 8px 14px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 999px; }
        .ckb2-reset-btn:hover { color: var(--c-coral); border-color: var(--c-coral); }
        .ckb2-shake-btn { display: inline-flex; align-items: center; gap: 10px; padding: 14px 24px; background: var(--c-coral); color: #fff; border-radius: 999px; font-family: var(--f-display); font-weight: 800; font-size: 15px; letter-spacing: 0.08em; transition: all 0.3s var(--ease-out); box-shadow: 0 8px 32px rgba(232,146,124,0.45); }
        .ckb2-shake-btn:hover:not(:disabled) { background: var(--c-sky); transform: translateY(-2px); box-shadow: 0 12px 40px rgba(91,184,212,0.5); }
        .ckb2-shake-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; background: rgba(255,255,255,0.1); }
        .ckb2-shake-icon { font-size: 18px; }

        /* Community */
        .ckb2-community { padding: 80px 0 120px; position: relative; z-index: 2; }
        .ckb2-community-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; padding-bottom: 32px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 48px; flex-wrap: wrap; }
        .ckb2-community-title { font-family: var(--f-display); font-weight: 800; font-size: clamp(36px, 4.5vw, 72px); letter-spacing: -0.025em; margin-top: 16px; line-height: 0.95; }
        .ckb2-community-count { font-family: var(--f-display); font-weight: 800; font-size: 14px; color: var(--c-coral); letter-spacing: 0.05em; }
        .ckb2-community-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 640px) { .ckb2-community-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .ckb2-community-grid { grid-template-columns: repeat(3, 1fr); gap: 24px; } }
      `}</style>
    </section>
  );
}

// ─── Accordion (each ingredient category) ────────────────────────────────────
function Accordion({ name, items, open, onToggle, pours, onPour, side }) {
  const containerRef = useRefC(null);
  return (
    <div className={`acc ${open ? "open" : ""}`}>
      <button className="acc-head" onClick={onToggle}>
        <span className="acc-title">{name}</span>
        <span className="acc-meta">
          <span className="acc-count">{items.length}</span>
          <span className="acc-caret">{open ? "−" : "+"}</span>
        </span>
      </button>
      <div className="acc-body" style={{ maxHeight: open ? 240 : 0 }}>
        <div className="acc-list" ref={containerRef}>
          {items.map((it) => {
            const count = pours[it.id] || 0;
            return (
              <button
                key={it.id}
                className={`acc-row ${count > 0 ? "active" : ""}`}
                onClick={(e) => onPour(it.id, e.currentTarget)}
              >
                <BottleSVG color={it.color} size={28} />
                <span className="acc-row-label">{it.label}</span>
                <span className="acc-row-vol">{it.volume}ml</span>
                {count > 0 && <span className="acc-row-count">×{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <style>{`
        .acc { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; transition: background 0.3s, border-color 0.3s; flex-shrink: 0; }
        .acc:hover { background: rgba(255,255,255,0.05); }
        .acc.open { border-color: rgba(91,184,212,0.4); }
        .acc-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; width: 100%; text-align: left; transition: background 0.2s; }
        .acc-head:hover { background: rgba(255,255,255,0.04); }
        .acc-title { font-family: var(--f-display); font-weight: 700; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; }
        .acc.open .acc-title { color: var(--c-sky); }
        .acc-meta { display: flex; align-items: center; gap: 10px; }
        .acc-count { font-size: 11px; opacity: 0.5; }
        .acc-caret { font-size: 18px; line-height: 1; opacity: 0.7; transition: transform 0.3s; }
        .acc.open .acc-caret { color: var(--c-sky); }
        .acc-body { overflow: hidden; transition: max-height 0.4s var(--ease-out); }
        .acc-list { padding: 4px 6px 8px; display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow-y: auto; }
        .acc-list::-webkit-scrollbar { width: 4px; }
        .acc-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 2px; }
        .acc-row { display: grid; grid-template-columns: 28px 1fr auto auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 8px; text-align: left; transition: all 0.2s; font-size: 13px; color: #fff; }
        .acc-row:hover { background: rgba(255,255,255,0.08); transform: translateX(2px); }
        .acc-row.active { background: rgba(232,146,124,0.15); border: 1px solid rgba(232,146,124,0.3); padding: 7px 9px; }
        .acc-row-label { font-family: var(--f-body); font-weight: 500; }
        .acc-row-vol { font-family: var(--f-display); font-weight: 700; font-size: 10px; color: rgba(255,255,255,0.5); letter-spacing: 0.05em; }
        .acc-row-count { font-family: var(--f-display); font-weight: 800; font-size: 12px; color: var(--c-coral); padding: 2px 6px; background: rgba(232,146,124,0.2); border-radius: 999px; min-width: 22px; text-align: center; }
      `}</style>
    </div>
  );
}

// ─── Bottle SVG (small illustration) ─────────────────────────────────────────
function BottleSVG({ color, size = 28, big = false }) {
  return (
    <svg viewBox="0 0 40 100" width={size} height={size * 2.5} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`bottle-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Cap */}
      <rect x="14" y="2" width="12" height="10" rx="1" fill="#3a3a3a" />
      <rect x="13" y="11" width="14" height="3" fill="#5a5a5a" />
      {/* Neck */}
      <rect x="16" y="14" width="8" height="14" fill={`url(#bottle-${color.replace(/[^a-z0-9]/gi, '')})`} stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
      {/* Body */}
      <path d="M 10 30 Q 8 36 8 44 L 8 92 Q 8 96 14 96 L 26 96 Q 32 96 32 92 L 32 44 Q 32 36 30 30 Z"
            fill={`url(#bottle-${color.replace(/[^a-z0-9]/gi, '')})`}
            stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
      {/* Label */}
      <rect x="12" y="50" width="16" height="28" fill="rgba(255,255,255,0.85)" />
      <line x1="14" y1="58" x2="26" y2="58" stroke={color} strokeWidth="2" />
      <line x1="14" y1="64" x2="22" y2="64" stroke="#888" strokeWidth="0.8" />
      <line x1="14" y1="68" x2="24" y2="68" stroke="#888" strokeWidth="0.6" />
      {/* Highlight */}
      <line x1="11" y1="34" x2="11" y2="86" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
    </svg>
  );
}

// ─── Pour Animation (overlay bottle that flies + pours + returns) ─────────────
function PourAnimation({ anim }) {
  return (
    <div className="pour-overlay" key={anim.ts}>
      <div
        className="pour-bottle"
        style={{
          left: anim.fromX,
          top: anim.fromY,
          "--tx": `${anim.toX - anim.fromX}px`,
          "--ty": `${anim.toY - anim.fromY}px`,
          "--color": anim.color,
        }}
      >
        <BottleSVG color={anim.color} size={36} />
        <div className="pour-stream" />
      </div>
      <style>{`
        .pour-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 50; }
        .pour-bottle { position: absolute; transform: translate(-50%, -50%); animation: pourFly 1.1s cubic-bezier(0.4,0,0.2,1) forwards; transform-origin: center; }
        @keyframes pourFly {
          0%   { transform: translate(-50%,-50%) rotate(0deg) scale(1); opacity: 0.7; }
          25%  { transform: translate(calc(-50% + var(--tx) * 0.6), calc(-50% + var(--ty) * 0.6)) rotate(-30deg) scale(1.2); opacity: 1; }
          50%  { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) rotate(170deg) scale(1.3); opacity: 1; }
          70%  { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty) - 8px)) rotate(170deg) scale(1.3); opacity: 1; }
          90%  { transform: translate(calc(-50% + var(--tx) * 0.4), calc(-50% + var(--ty) * 0.4)) rotate(45deg) scale(1.1); opacity: 0.8; }
          100% { transform: translate(-50%,-50%) rotate(0deg) scale(1); opacity: 0; }
        }
        .pour-stream { position: absolute; left: 50%; bottom: -28px; width: 4px; height: 36px; background: var(--color); border-radius: 2px; transform: translateX(-50%); opacity: 0; animation: pourStream 1.1s linear forwards; box-shadow: 0 0 8px var(--color); }
        @keyframes pourStream {
          0%, 40% { opacity: 0; height: 4px; }
          50%, 65% { opacity: 0.9; height: 36px; }
          80% { opacity: 0.6; height: 24px; }
          100% { opacity: 0; height: 4px; }
        }
      `}</style>
    </div>
  );
}

// ─── Shaker SVG (with liquid fill, realistic metal) ──────────────────────────
function ShakerSVG({ color, fill, extreme, shaking }) {
  const liquidH = Math.max(0, Math.min(0.85, fill || 0)) * 200;
  return (
    <svg viewBox="0 0 200 320" width="100%" height="100%" className={`shaker-svg ${shaking ? "shaking" : ""}`}>
      <defs>
        <linearGradient id="shakerBody3" x1="0" x2="1">
          <stop offset="0%" stopColor="#7a7e84" />
          <stop offset="20%" stopColor="#c5cdd1" />
          <stop offset="50%" stopColor="#e8eef2" />
          <stop offset="80%" stopColor="#a8b1b7" />
          <stop offset="100%" stopColor="#5a6065" />
        </linearGradient>
        <linearGradient id="shakerCap" x1="0" x2="1">
          <stop offset="0%" stopColor="#3a3f44" />
          <stop offset="50%" stopColor="#7a8084" />
          <stop offset="100%" stopColor="#3a3f44" />
        </linearGradient>
        <linearGradient id="liquidGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <clipPath id="shakerInner3">
          <path d="M 64 52 Q 60 70 64 100 L 64 256 Q 64 286 100 291 Q 136 286 136 256 L 136 100 Q 140 70 136 52 Z" />
        </clipPath>
        <filter id="shakerGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Cap */}
      <rect x="74" y="6" width="52" height="22" rx="4" fill="url(#shakerCap)" stroke="#3a3f44" strokeWidth="1.2" />
      <rect x="78" y="11" width="44" height="3" fill="rgba(255,255,255,0.4)" />
      <rect x="78" y="20" width="44" height="2" fill="rgba(0,0,0,0.3)" />
      {/* Neck */}
      <rect x="68" y="28" width="64" height="22" rx="3" fill="url(#shakerCap)" stroke="#3a3f44" strokeWidth="1" />
      <line x1="70" y1="35" x2="130" y2="35" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
      <line x1="70" y1="42" x2="130" y2="42" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />

      {/* Body */}
      <path d="M 60 50 Q 56 70 60 100 L 60 262 Q 60 292 100 297 Q 140 292 140 262 L 140 100 Q 144 70 140 50 Z"
            fill="url(#shakerBody3)" stroke="#4a4f54" strokeWidth="1.5" />

      {/* Liquid */}
      <g clipPath="url(#shakerInner3)">
        <rect x="60" y={297 - liquidH} width="80" height={liquidH + 4} fill="url(#liquidGrad)" />
        {liquidH > 0 && (
          <ellipse cx="100" cy={297 - liquidH} rx="38" ry="3" fill="rgba(255,255,255,0.5)" />
        )}
        {/* Subtle ripple */}
        {liquidH > 0 && (
          <path d={`M 60 ${297 - liquidH + 2} Q 80 ${297 - liquidH - 1} 100 ${297 - liquidH + 2} T 140 ${297 - liquidH + 2}`}
                fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        )}
      </g>

      {/* Highlights for realism */}
      <path d="M 66 54 Q 62 130 70 250" stroke="rgba(255,255,255,0.7)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 70 56 Q 66 130 74 250" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" />
      <path d="M 132 56 Q 138 130 130 250" stroke="rgba(0,0,0,0.3)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 128 60 Q 134 130 124 246" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" fill="none" />

      {/* S'H plaque */}
      <rect x="78" y="170" width="44" height="22" rx="2" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
      <text x="100" y="186" textAnchor="middle" fontFamily="Syne, serif" fontWeight="800" fontSize="11" fill="rgba(255,255,255,0.7)" letterSpacing="0.5">S'H</text>

      {/* Extreme glow */}
      {extreme && (
        <>
          <circle cx="100" cy="160" r="120" fill="rgba(255,107,53,0.18)" filter="url(#shakerGlow)" />
          <text x="100" y="318" textAnchor="middle" fontFamily="Syne, serif" fontWeight="800" fontSize="14" fill="#FFCB47">🔥</text>
        </>
      )}
    </svg>
  );
}

// ─── Result Glass ────────────────────────────────────────────────────────────
function ResultGlass({ color }) {
  return (
    <svg viewBox="0 0 200 320" width="100%" height="100%">
      <defs>
        <linearGradient id="glassFin" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M 30 60 L 170 60 L 110 160 L 110 270 L 90 270 L 90 160 Z"
            fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" />
      <path d="M 40 66 L 160 66 L 105 156 L 95 156 Z" fill="url(#glassFin)" />
      <ellipse cx="100" cy="66" rx="60" ry="4" fill="#fff" opacity="0.4" />
      <ellipse cx="100" cy="275" rx="35" ry="4" fill="rgba(255,255,255,0.3)" />
      <circle cx="160" cy="50" r="6" fill={color} stroke="#fff" strokeWidth="1" />
      <line x1="160" y1="50" x2="135" y2="68" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
    </svg>
  );
}

// ─── Result / Match / Published panels ───────────────────────────────────────
function ResultPanel({ pours, stats, drinkName, setDrinkName, onPublish, ingredients }) {
  return (
    <div className="ckb2-result">
      <div className="ckb2-result-badge" style={{ color: "var(--c-sky)" }}>✦ Drink pronto · {stats.total}ml</div>
      <input
        className="ckb2-name-input"
        placeholder="Dai un nome al drink..."
        value={drinkName}
        onChange={(e) => setDrinkName(e.target.value)}
        maxLength={32}
        autoFocus
      />
      <button className="ckb2-pub-btn" onClick={onPublish} disabled={!drinkName.trim()}>
        Pubblica & QR <span>→</span>
      </button>
      <style>{`
        .ckb2-result { display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 12px; background: rgba(91,184,212,0.08); border: 1px solid rgba(91,184,212,0.25); border-radius: 14px; animation: fadeUp 0.5s; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .ckb2-result-badge { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; }
        .ckb2-name-input { background: transparent; border: 0; border-bottom: 1.5px solid rgba(255,255,255,0.3); color: #fff; padding: 10px 0; font-family: var(--f-display); font-weight: 700; font-size: 22px; letter-spacing: -0.01em; outline: none; text-align: center; width: 100%; min-width: 240px; }
        .ckb2-name-input:focus { border-bottom-color: var(--c-coral); }
        .ckb2-name-input::placeholder { color: rgba(255,255,255,0.25); }
        .ckb2-pub-btn { padding: 10px 22px; background: var(--c-sky); color: #fff; border-radius: 999px; font-weight: 600; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; display: inline-flex; gap: 8px; align-items: center; }
        .ckb2-pub-btn:hover:not(:disabled) { background: var(--c-coral); }
        .ckb2-pub-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function MatchPanel({ match, ingredients }) {
  return (
    <div className="ckb2-result" style={{ background: "rgba(232,146,124,0.1)", borderColor: "rgba(232,146,124,0.35)" }}>
      <div className="ckb2-result-badge" style={{ color: "var(--c-coral)" }}>🍸 Esiste già</div>
      <h3 style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>{match.name}</h3>
      <p style={{ fontFamily: "var(--f-serif)", fontStyle: "italic", opacity: 0.65, fontSize: 13 }}>— {match.origin} · {match.price}</p>
      <p style={{ fontSize: 12, opacity: 0.7, textAlign: "center", maxWidth: 320 }}>
        Conoscevamo già questa combinazione. Vuoi ordinarlo o creare qualcosa di nuovo?
      </p>
    </div>
  );
}

function PublishedPanel({ drinkName, stats, ingredients }) {
  const code = (drinkName + stats.items.map((it) => it.id).join("")).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9999, 0).toString().padStart(4, "0");
  return (
    <div className="ckb2-result" style={{ background: "linear-gradient(135deg,rgba(232,146,124,0.12),rgba(91,184,212,0.08))" }}>
      <div className="ckb2-result-badge" style={{ color: "var(--c-coral)" }}>✦ Pubblicato</div>
      <h3 style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em" }}>{drinkName || "Drink"}</h3>
      <div className="ckb2-qr-block">
        <QRCodeSVG seed={drinkName + stats.items.map((i) => i.id).join(",")} />
        <div className="ckb2-qr-meta">
          <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--c-deep)" }}>Codice</span>
          <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 18, color: "var(--c-deep)" }}>SH-{code}</div>
        </div>
      </div>
      <p style={{ fontSize: 11, opacity: 0.65, textAlign: "center" }}>Mostra il QR al barman. Lascia un commento con foto.</p>
      <style>{`
        .ckb2-qr-block { display: flex; align-items: center; gap: 14px; padding: 12px; background: #fff; border-radius: 12px; }
        .ckb2-qr-meta { display: flex; flex-direction: column; gap: 2px; }
      `}</style>
    </div>
  );
}

// ─── Mock QR Code ────────────────────────────────────────────────────────────
function QRCodeSVG({ seed }) {
  const size = 21;
  const grid = useMemoC(() => {
    let h = 5381;
    for (const c of seed) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    const arr = [];
    for (let i = 0; i < size * size; i++) {
      h = ((h * 1103515245 + 12345) >>> 0) % 2147483648;
      arr.push((h >> 8) % 2 === 0);
    }
    const placeFinder = (gx, gy) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const idx = (gy + y) * size + (gx + x);
          const onBorder = x === 0 || x === 6 || y === 0 || y === 6;
          const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          arr[idx] = onBorder || inner;
        }
      }
    };
    placeFinder(0, 0); placeFinder(14, 0); placeFinder(0, 14);
    return arr;
  }, [seed]);
  const cellSize = 4;
  const px = size * cellSize;
  return (
    <svg viewBox={`0 0 ${px} ${px}`} width="90" height="90" style={{ flexShrink: 0 }}>
      <rect width={px} height={px} fill="#fff" />
      {grid.map((v, i) => v && (
        <rect key={i} x={(i % size) * cellSize} y={Math.floor(i / size) * cellSize} width={cellSize} height={cellSize} fill="#1A3D52" />
      ))}
    </svg>
  );
}

// ─── Community card ──────────────────────────────────────────────────────────
function CommunityCard({ c, ingredients, index }) {
  const [liked, setLiked] = useStateC(false);
  const baseColor = ingredients.find((x) => x.id === c.ingr[0])?.color || "#E8927C";
  const endColor = ingredients.find((x) => x.id === c.ingr[c.ingr.length - 1])?.color || baseColor;
  return (
    <article className="cc-card reveal" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="cc-glass-wrap">
        <div className="cc-glass" style={{ background: `linear-gradient(180deg, ${baseColor}, ${endColor})` }} />
        <div className="cc-card-tag">by {c.by}</div>
      </div>
      <div className="cc-body">
        <h4 className="cc-name">{c.name}</h4>
        <div className="cc-ingr">
          {c.ingr.slice(0, 4).map((id) => {
            const ing = ingredients.find((x) => x.id === id);
            return ing ? (
              <span key={id} className="cc-pill">
                <span className="cc-pill-dot" style={{ background: ing.color }} />
                {ing.label}
              </span>
            ) : null;
          })}
          {c.ingr.length > 4 && <span className="cc-pill cc-pill-more">+{c.ingr.length - 4}</span>}
        </div>
        <p className="cc-comment">"{c.comment}"</p>
        <div className="cc-meta">
          <button className={`cc-like ${liked ? "on" : ""}`} onClick={() => setLiked((v) => !v)}>
            <span>♥</span> {c.likes + (liked ? 1 : 0)}
          </button>
          <span className="cc-comments">💬 {c.comments}</span>
        </div>
      </div>
      <style>{`
        .cc-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.4s var(--ease-out), border-color 0.3s; }
        .cc-card:hover { transform: translateY(-4px); border-color: var(--c-coral); }
        .cc-glass-wrap { position: relative; height: 180px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); }
        .cc-glass { width: 90px; height: 130px; clip-path: polygon(0 5%, 100% 5%, 65% 55%, 65% 95%, 35% 95%, 35% 55%); position: relative; }
        .cc-glass::before { content: ''; position: absolute; left: 5%; top: 3%; width: 90%; height: 4%; background: rgba(255,255,255,0.4); border-radius: 50%; }
        .cc-card-tag { position: absolute; top: 12px; right: 12px; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.7); padding: 4px 8px; background: rgba(0,0,0,0.3); border-radius: 999px; backdrop-filter: blur(4px); }
        .cc-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
        .cc-name { font-family: var(--f-display); font-weight: 800; font-size: 22px; letter-spacing: -0.02em; line-height: 1.1; }
        .cc-ingr { display: flex; flex-wrap: wrap; gap: 4px; }
        .cc-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); font-size: 10px; letter-spacing: 0.04em; color: rgba(255,255,255,0.85); }
        .cc-pill-dot { width: 6px; height: 6px; border-radius: 50%; }
        .cc-pill-more { background: var(--c-coral); }
        .cc-comment { font-family: var(--f-serif); font-style: italic; font-size: 14px; opacity: 0.75; line-height: 1.5; }
        .cc-meta { display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); margin-top: auto; }
        .cc-like { color: rgba(255,255,255,0.7); font-size: 13px; display: inline-flex; align-items: center; gap: 4px; }
        .cc-like span { font-size: 14px; }
        .cc-like.on { color: var(--c-coral); }
        .cc-comments { color: rgba(255,255,255,0.5); font-size: 13px; }
      `}</style>
    </article>
  );
}

export { CocktailBuilder };
