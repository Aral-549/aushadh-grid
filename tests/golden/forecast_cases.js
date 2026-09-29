// Golden cases for contracts/forecast.md, run inside the real built page by tests/run_golden.py (mode=forecast).
(() => {
  if ((new URLSearchParams(location.search).get("mode") || "") !== "forecast") return;
  const $ = q => document.querySelector(q);
  const R = {};
  const check = (id, ok, detail) => { R[id] = [!!ok, detail === undefined ? "" : String(detail)]; };
  const run = () => {
    const T = window.__AG_TEST;
    const mean = a => a.reduce((x, v) => x + v, 0) / a.length;

    // F3: a constant series forecasts itself, with no drift
    const c = T.baseForecast(new Array(120).fill(5));
    check("F3-constant-no-drift", c.f.length === 60 && c.f.every(v => Math.abs(v - 5) < 1e-6), `${Math.min(...c.f)}..${Math.max(...c.f)}`);

    // F4: a recent stock-out (recorded zeros) does not drag the forecast down
    const s = new Array(120).fill(10); for (let t = 115; t < 120; t++) s[t] = 0;
    const f4 = mean(T.baseForecast(s).f.slice(0, 14));
    check("F4-stockout-zeros-cleaned", Math.abs(f4 - 10) <= 1, f4.toFixed(3));

    // edges: all-zero series, and beta = 0 means no trend at all
    const z = T.baseForecast(new Array(120).fill(0));
    check("edge-all-zero", z.f.every(v => v === 0 || (Number.isFinite(v) && Math.abs(v) < 1e-6)), z.f.slice(0, 3).join(","));
    const ramp = Array.from({ length: 120 }, (_, t) => 5 + t * 0.1);
    const r0 = T.baseForecast(ramp, 0.3, 0).f;
    check("edge-beta0-flat", T.BETA === 0 && Math.abs(r0[0] * 1 - r0[7]) < 1e-6 && Math.abs(r0[7] - r0[49]) < 1e-6, `${r0[0]} ${r0[7]} ${r0[49]}`);
    check("edge-params-fixed", T.ALPHA === 0.05 && T.BETA === 0, `${T.ALPHA} ${T.BETA}`);

    // F1: the chosen pair is the grid minimum on the selection window (days 92-105), never the reported holdout
    const score = (fitN, a, b) => {
      let em = 0, act = 0;
      T.PHCS.forEach(p => T.MEDS.forEach(m => {
        const raw = p.hist[m.id].slice(0, fitN + 14), cl = T.cleanSeries(raw);
        const bad = new Set([...cl.censored, ...cl.outliers].map(x => x.t));
        const fit = T.baseForecast(raw.slice(0, fitN), a, b);
        for (let k = 0; k < 14; k++) { if (bad.has(fitN + k)) continue; em += Math.abs(fit.f[k] - raw[fitN + k]); act += raw[fitN + k]; }
      }));
      return em / act;
    };
    const grid = [];
    for (const a of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4]) for (const b of [0, 0.02, 0.05, 0.08]) grid.push({ a, b, w: score(T.HIST - 28, a, b) });
    const best = grid.slice().sort((x, y) => x.w - y.w || x.b - y.b || y.a - x.a)[0];
    check("F1-chosen-on-selection-window", best.a === T.ALPHA && best.b === T.BETA, `best ${best.a}/${best.b} ${(best.w * 100).toFixed(2)}%`);

    // F2: holdout reported as measured; the model now has the lower error and the page says so
    const bt = T.backtest();
    $('.tab[data-view="stock"]').click();
    const txt = $("#bt-tiles").textContent;
    check("F2-holdout-honest", bt.wapeModel < bt.wapeNaive && /less error than/.test(txt) && txt.includes((bt.wapeModel * 100).toFixed(1)), `${(bt.wapeModel * 100).toFixed(2)} vs ${(bt.wapeNaive * 100).toFixed(2)}`);

    // F6: numbers that do not depend on the forecast
    $('.tab[data-view="overview"]').click();
    const tiles = $("#tiles").innerText.replace(/\s+/g, " ");
    check("F6-non-forecast-unchanged", /PHCS MONITORED 48 528 medicine lines/i.test(tiles) && /REPORTS OVERDUE 6/i.test(tiles) && /553 of 868 beds/.test(tiles), tiles.slice(0, 120));
    check("no-js-errors", !(window.__errs || []).length, (window.__errs || []).join(" | "));
  };
  setTimeout(() => {
    try { run(); } catch (e) { check("harness-exception", false, e.stack || e); }
    const p = document.createElement("pre"); p.id = "GOLDEN"; p.textContent = JSON.stringify(R); document.body.appendChild(p);
  }, 1500);
})();
