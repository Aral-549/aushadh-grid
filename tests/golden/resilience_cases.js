// Golden cases for contracts/resilience.md, run inside the real built page by tests/run_golden.py (mode=resilience).
(() => {
  if ((new URLSearchParams(location.search).get("mode") || "") !== "resilience") return;
  const $ = q => document.querySelector(q);
  const R = {};
  const check = (id, ok, detail) => { R[id] = [!!ok, detail === undefined ? "" : String(detail)]; };
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  const run = () => {
    const T = window.__AG_TEST, P = id => T.PHC_BY_ID[id], M = id => T.MED_BY_ID[id];
    const STRESS = ["dengue", "diarrhoea", "heat"];

    // R1: one shelf, lost sales
    const r1 = T.serve(10, [], new Array(14).fill(5));
    check("R1-one-line", near(r1.met, 10) && near(r1.dem, 70), `${r1.met}/${r1.dem}`);
    // R2: surge ramp over 3 days (paracetamol: dengue x3.2, not driven by diarrhoea)
    const p1 = P("PHC-001"), sd = T.surgeDemand(p1, M("PCM"), "dengue"), flat = T.surgeDemand(p1, M("PCM"), "diarrhoea");
    const ratios = [0, 1, 2, 5].map(k => sd[k] / flat[k]);
    check("R2-surge-ramp", sd.length === 14 && near(ratios[0], 1 + 2.2 / 3) && near(ratios[1], 1 + 2.2 * 2 / 3) && near(ratios[2], 3.2) && near(ratios[3], 3.2), ratios.map(x => x.toFixed(4)).join(","));
    // S1: pooling two shelves
    const d5 = new Array(14).fill(5), a = T.serve(0, [], d5), b = T.serve(140, [], d5), pooled = T.serve(140, [], new Array(14).fill(10));
    check("S1-pooling", near((a.met + b.met) / (a.dem + b.dem), 0.5) && near(pooled.met / pooled.dem, 1), `${(a.met + b.met) / (a.dem + b.dem)} ${pooled.met / pooled.dem}`);
    // critical medicines: vital or driven by the scenario
    const crit = T.critical("heat").map(m => m.id);
    check("def-critical-meds", T.critical("dengue").some(m => m.id === "PCM") && !crit.includes("MET") && crit.includes("ORS"), crit.join(","));

    const RS = T.RESIL;
    // S3 + range: every layer adds, values are shares
    const badLayer = RS.pairs.filter(x => !(x.today <= x.prepos + 1e-9 && x.prepos <= x.shared + 1e-9 && x.shared <= x.buffered + 1e-9) || [x.today, x.prepos, x.shared, x.buffered].some(v => !(v >= 0 && v <= 1)));
    check("S3-layers-only-add", RS.pairs.length === 36 && !badLayer.length, badLayer.slice(0, 3).map(x => `${x.d}/${x.s} ${x.today} ${x.prepos} ${x.shared} ${x.buffered}`).join(" | "));
    // H3: the budget reaches its target everywhere
    const low = RS.pairs.filter(x => x.buffered < 0.9 - 1e-6);
    check("H3-buffer-reaches-90", !low.length, low.map(x => `${x.d}/${x.s} ${x.buffered}`).join(","));
    // H1/H2: buffer per hub medicine = max over scenarios of ceil(max(0, 0.9 x demand - met)) on the shared shelf
    const bufErr = [];
    Object.keys(T.DIST_BY_ID).forEach(d => {
      const want = new Map();
      STRESS.forEach(sc => T.resilienceOf(d, sc, RS.startNow, true).byMed.forEach(x => want.set(x.m, Math.max(want.get(x.m) || 0, Math.ceil(Math.max(0, 0.9 * x.dem - x.met) - 1e-9)))));
      const got = RS.bufOf.get(d);
      want.forEach((q, m) => { if ((got.get(m) || 0) !== q) bufErr.push(`${d}/${m.id} ${got.get(m)} vs ${q}`); });
      const c = RS.clusters.find(x => x.d === d);
      if (c.items.some(x => x.qty <= 0)) bufErr.push(`${d} zero item listed`);
    });
    check("H1-H2-buffer-formula", !bufErr.length, bufErr.slice(0, 4).join(" | "));
    check("H-budget-sums", near(RS.budget, RS.clusters.reduce((a, c) => a + c.value, 0), 1e-3) && RS.budget > 0, RS.budget);

    // P1: no line anywhere loses met demand in any scenario because of pre-positioning
    const worse = [];
    T.PHCS.forEach(p => T.MEDS.forEach(m => STRESS.forEach(sc => {
      const dm = T.surgeDemand(p, m, sc), b0 = RS.startBase(p, m), n0 = RS.startNow(p, m);
      const before = T.serve(b0.stock, b0.inflow, dm), after = T.serve(n0.stock, n0.inflow, dm);
      if (after.met < before.met - 1e-6) worse.push(`${p.id}/${m.id}/${sc}`);
    })));
    check("P1-no-line-worse", !worse.length, worse.slice(0, 5).join(","));
    // P2: each move respects distance, cold chain and minimum size; P3: donors within their spare
    const p2 = RS.moves.filter(x => !(x.km <= 150 + 1e-9 && x.qty >= Math.max(1, T.surgeDemand(x.to, x.m, x.s)[0]) - 1e-9 && (!x.m.cold || (x.from.ilrOk && x.to.ilrOk)) && x.from !== x.to && x.after >= x.before - 1e-9));
    check("P2-move-rules", RS.moves.length > 0 && RS.moves.length <= 40 && !p2.length, p2.slice(0, 3).map(x => `${x.from.id}->${x.to.id} ${x.m.id} ${x.km}`).join(" | "));
    const giv = new Map(); RS.moves.forEach(x => giv.set(x.from.id + x.m.id, (giv.get(x.from.id + x.m.id) || 0) + x.qty));
    const over = [...giv].filter(([k, q]) => q > RS.spare0.get(k) + 1e-9);
    check("P3-donor-within-spare", !over.length, over.slice(0, 3).join(" | "));
    // S2: square-root law bounds for 4 PHCs: indep/2 <= pooled <= indep
    const ss = RS.clusters.filter(c => !(c.ssPooled <= c.ssIndep + 1e-9 && c.ssPooled >= c.ssIndep / 2 - 1e-6));
    check("S2-sqrt-law-bounds", RS.clusters.length === 12 && !ss.length, ss.map(c => c.d).join(","));
    check("edge-hub-has-fridge-when-possible", RS.clusters.every(c => c.hub.ilrOk || [c.hub, ...c.spokes].every(p => !p.ilrOk)));

    // P4/P5: read-only and deterministic
    const snap = JSON.stringify({ t: T.TRANSFERS.length, i: T.IMPACT.plan });
    const again = T.stressTest();
    check("P5-deterministic", JSON.stringify(again.state) === JSON.stringify(RS.state) && again.moves.length === RS.moves.length && again.budget === RS.budget);
    check("P4-read-only", JSON.stringify({ t: T.TRANSFERS.length, i: T.IMPACT.plan }) === snap);

    // rendering: matrix, colours follow the numbers, lede grammar
    $('.tab[data-view="resilience"]').click();
    const rows = document.querySelectorAll("#rs-body tr");
    const cells = [...document.querySelectorAll("#rs-body .rs-cell")];
    const colourBad = cells.filter(c => { const v = parseFloat(c.textContent) / 100; const want = v < 0.6 ? "crit" : v < 0.85 ? "warn" : "ok"; return !c.classList.contains(want) && Math.abs(v - 0.6) > 0.006 && Math.abs(v - 0.85) > 0.006; });
    check("ui-matrix-and-colours", rows.length === 12 && cells.length === 12 * 7 && !colourBad.length, `${rows.length} rows, ${cells.length} cells, ${colourBad.length} off`);
    const lede = $("#rs-lede").textContent;
    check("ui-lede-article", !/\ba [aeiou]/i.test(lede) && lede.includes("%"), lede.slice(0, 60));

    // an SMS stock report in the weakest district changes the stress test
    const w = RS.weakest, target = T.PHCS.find(p => p.district === w.d);
    const before = T.RESIL.pairs.find(x => x.d === w.d && x.s === w.s).today;
    $("#sms").value = `${target.id} STOCK ORS 900 IVF 400`; $("#ingest").click();
    const held = document.querySelector("#accept-held"); if (held) held.click();
    const after = T.RESIL.pairs.find(x => x.d === w.d && x.s === w.s).today;
    check("edge-import-recomputes", after > before, `${before} -> ${after}`);

    // BUGLOG 2026-09-29: a template placeholder leaked into static HTML; no view may show raw template syntax
    const leaks = ["overview", "resilience", "surveillance", "stock", "expiry", "redistribute", "dispatch", "capacity", "quality", "federated", "brief"].filter(v => { $(`.tab[data-view="${v}"]`).click(); return /\$\{|undefined|NaN/.test(document.querySelector("main").innerText); });
    check("regression-no-template-leaks", !leaks.length, leaks.join(","));
    const L = window.__AG_LOG || [];
    check("log-resilience-stage", L.some(r => r.stage === "resilience" && r.input && r.output && r.output.state));
    check("no-js-errors", !(window.__errs || []).length, (window.__errs || []).join(" | "));
  };
  setTimeout(() => {
    try { run(); } catch (e) { check("harness-exception", false, e.stack || e); }
    const p = document.createElement("pre"); p.id = "GOLDEN"; p.textContent = JSON.stringify(R); document.body.appendChild(p);
  }, 1500);
})();
