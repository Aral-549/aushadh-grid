// Golden cases for contracts/impact-and-dispatch.md, run inside the real built page by tests/run_golden.py (mode=impact).
// Unit cases call the planning stages through window.__AG_TEST; invariants run on the full synthetic network in every scenario.
(() => {
  if ((new URLSearchParams(location.search).get("mode") || "") !== "impact") return;
  const $ = q => document.querySelector(q);
  const R = {};
  const check = (id, ok, detail) => { R[id] = [!!ok, detail === undefined ? "" : String(detail)]; };
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const setScenario = s => { $("#scenario").value = s; $("#scenario").dispatchEvent(new Event("change")); };
  const run = () => {
    const T = window.__AG_TEST;
    check("hook-present", !!T);
    if (!T) return;
    const med = { id: "TST", lead: 7, ven: "V", cold: false };
    const line = (stock, daily) => ({ stock, m: med, f: new Array(60).fill(daily) });

    // A1-A4: one line, hand-computed
    const a1 = T.lineOut(line(10, 5), [], 0);
    check("A1-no-action", near(a1.days, 5) && near(a1.unmet, 25), `${a1.days} ${a1.unmet}`);
    const a2 = T.lineOut(line(10, 5), [{ day: Math.ceil(20 / 24), qty: 30 }], 0);
    check("A2-transfer-day1-covers", near(a2.days, 0), a2.days);
    const a3 = T.lineOut(line(10, 5), [{ day: Math.ceil(30 / 24), qty: 10 }], 0);
    check("A3-transfer-day2-partial", near(a3.days, 3), a3.days);
    const a4 = T.lineOut(line(200, 5), [], 30);
    check("A4-donor-keeps-cover", near(a4.days, 0), a4.days);
    const z = T.lineOut(line(0, 0), [], 0);
    check("edge-zero-forecast", z.days === 0 && z.unmet === 0 && Number.isFinite(z.days), `${z.days} ${z.unmet}`);
    const half = T.lineOut({ stock: 0, m: { ...med, lead: 1 }, f: [4] }, [{ day: 0, qty: 2 }], 0);
    check("edge-fractional-day", near(half.days, 0.5) && near(half.unmet, 2), `${half.days}`);
    const late = T.lineOut(line(10, 5), [{ day: 7, qty: 100 }], 0);
    check("edge-arrival-after-window-ignored", near(late.days, 5), late.days);

    // C1-C4: SMS work orders
    const P = id => T.PHC_BY_ID[id], M = id => T.MED_BY_ID[id];
    const fresh = { ...P("PHC-033"), lastReport: 0 };
    const c1 = T.smsFor({ phc: fresh, verify: false, send: [{ m: M("OXY"), qty: 29, to: P("PHC-047") }], receive: [{ m: M("INS"), qty: 22, from: P("PHC-034") }], indent: [] });
    check("C1-sms-text", c1.length === 1 && c1[0] === "AG PHC-033: SEND OXY 29 to PHC-047. RECV INS 22 from PHC-034. Reply OK or NO.", JSON.stringify(c1));
    const many = Array.from({ length: 25 }, (_, i) => ({ m: M("ORS"), qty: 100 + i, to: P("PHC-0" + String(10 + i)) }));
    const c2 = T.smsFor({ phc: fresh, verify: false, send: many, receive: [], indent: [] });
    const counters = c2.every((m, i) => m.startsWith(`${i + 1}/${c2.length} AG PHC-033: `));
    const allSends = many.every(t => c2.some(m => m.includes(`SEND ORS ${t.qty} to ${t.to.id}.`)));
    check("C2-split-under-160", c2.length > 1 && c2.every(m => m.length <= 160) && counters && allSends, c2.map(m => m.length).join(","));
    const stale = { ...P("PHC-033"), lastReport: 5 };
    const c3 = T.smsFor({ phc: stale, verify: true, send: [{ m: M("OXY"), qty: 29, to: P("PHC-047") }], receive: [], indent: [] });
    check("C3-verify-first", /^(1\/\d+ )?AG PHC-033: COUNT STOCK/.test(c3[0]), c3[0]);

    // B1, B2, B3, B5: routing on real PHCs
    const t = (from, to, m, qty) => ({ from: P(from), to: P(to), m: M(m), qty, km: 0, type: "stockout" });
    const hq = T.DIST_BY_ID[P("PHC-001").district];
    const b1 = T.route(hq, [t("PHC-001", "PHC-002", "ORS", 5), t("PHC-001", "PHC-003", "PCM", 9)]);
    check("B1-one-pickup-stop", b1.stops.filter(s => s.pickups.length).length === 1 && b1.stops.find(s => s.pickups.length).pickups.length === 2, JSON.stringify(b1.stops.map(s => [s.phc.id, s.pickups.length, s.drops.length])));
    const b2 = T.route(hq, [t("PHC-001", "PHC-003", "ORS", 5), t("PHC-002", "PHC-003", "PCM", 9)]);
    const firstDrop = b2.stops.findIndex(s => s.drops.length);
    check("B2-pickups-before-drop", b2.stops.length === 3 && firstDrop === 2 && b2.stops.slice(0, 2).every(s => s.pickups.length), JSON.stringify(b2.stops.map(s => s.phc.id)));
    const b3 = T.route(hq, []);
    check("B3-empty-route", b3.stops.length === 0 && near(b3.km, 0), b3.km);

    // invariants on the full network, every scenario
    const bad = {};
    for (const sc of ["normal", "dengue", "diarrhoea", "heat"]) {
      setScenario(sc);
      const I = T.IMPACT, TR = T.TRANSFERS, RU = T.RUNS, OR = T.ORDERS;
      const donors = new Set(TR.map(x => x.donor.p.id + x.donor.m.id));
      const worse = [...donors].filter(k => I.lines.get(k).plan.days > I.lines.get(k).none.days + 1e-9);
      if (worse.length) bad[`A5-${sc}`] = worse.slice(0, 3).join(",");
      if (!(I.plan.outDays <= I.none.outDays + 1e-9 && I.none.vitalOutDays <= I.none.outDays + 1e-9 && I.plan.vitalOutDays <= I.plan.outDays + 1e-9)) bad[`A6-${sc}`] = `${I.none.outDays} ${I.plan.outDays}`;
      const seen = new Map(); RU.forEach(r => r.transfers.forEach(x => seen.set(x, (seen.get(x) || 0) + 1)));
      if (seen.size !== TR.length || [...seen.values()].some(v => v !== 1)) bad[`B6-once-${sc}`] = `${seen.size}/${TR.length}`;
      const runKm = RU.reduce((a, r) => a + r.km, 0), dKm = T.directKm(TR);
      if (runKm > dKm + 1e-6) bad[`B6-km-${sc}`] = `${runKm} > ${dKm}`;
      RU.forEach(r => {
        const idx = (phc, kind) => r.stops.findIndex(s => s.phc === phc && s[kind].length);
        r.transfers.forEach(x => { if (!(idx(x.from, "pickups") >= 0 && idx(x.from, "pickups") < idx(x.to, "drops"))) bad[`B2-order-${sc}`] = r.id; });
        if (r.hours > 8 + 1e-9 && r.transfers.length > 1) bad[`B4-${sc}`] = `${r.id} ${r.hours.toFixed(1)}h with ${r.transfers.length}`;
        if (r.over !== (r.hours > 8 + 1e-9)) bad[`B4-flag-${sc}`] = r.id;
        if (r.cold !== r.transfers.some(x => x.m.cold)) bad[`B5-${sc}`] = r.id;
        if (![r.transfers[0].from.district, r.transfers[0].to.district].includes(r.district)) bad[`B7-${sc}`] = r.id;
      });
      TR.forEach(x => {
        if (x.from.district === x.to.district) return;
        const d = T.carrier(x), other = d === x.from.district ? x.to.district : x.from.district;
        if (T.route(T.DIST_BY_ID[d], [x]).km > T.route(T.DIST_BY_ID[other], [x]).km + 1e-9) bad[`B7-cheaper-${sc}`] = `${x.from.id}->${x.to.id}`;
      });
      if (OR.some(o => o.sms.some(m => m.length > 160))) bad[`C2-${sc}`] = "sms over 160";
      if (OR.some(o => o.verify !== (o.phc.lastReport >= 3) || (o.verify && !/COUNT STOCK/.test(o.sms[0])))) bad[`C3-${sc}`] = "verify";
      const acting = new Set([...TR.flatMap(x => [x.from, x.to]), ...T.INDENTS.map(i => i.p)]);
      if (OR.length !== acting.size || OR.some(o => !acting.has(o.phc))) bad[`C4-${sc}`] = `${OR.length} orders vs ${acting.size} acting PHCs`;
    }
    check("A5-A6-B-C-invariants-all-scenarios", !Object.keys(bad).length, JSON.stringify(bad));

    // C3 boundary: a report exactly 3 days old must trigger the stock count, 2 days must not
    setScenario("normal");
    const actor = T.TRANSFERS[0].from, oldAge = actor.lastReport;
    actor.lastReport = 3; setScenario("normal");
    const at3 = T.ORDERS.find(o => o.phc === actor);
    actor.lastReport = 2; setScenario("normal");
    const at2 = T.ORDERS.find(o => o.phc === actor);
    actor.lastReport = oldAge; setScenario("normal");
    check("C3-boundary-3-days", at3 && at3.verify && /COUNT STOCK/.test(at3.sms[0]) && at2 && !at2.verify, `${actor.id} at3=${at3 && at3.verify} at2=${at2 && at2.verify}`);

    // approval is a status, not stock
    setScenario("normal");
    const before = JSON.stringify(T.IMPACT.plan);
    $("#approve-all").click();
    $('.tab[data-view="overview"]').click();
    check("edge-approve-keeps-impact", JSON.stringify(T.IMPACT.plan) === before);

    // district filter: impact is the district's own; dispatch keeps cross-district partners
    $("#district").value = "SKL"; $("#district").dispatchEvent(new Event("change"));
    const own = T.IMPACT.byDistrict.SKL.none.outDays;
    const shown = $("#impact").textContent;
    check("edge-district-impact", shown.includes(Math.round(own).toLocaleString("en-IN")), `${own} in "${shown.slice(0, 80)}"`);
    $('.tab[data-view="dispatch"]').click();
    const rows = [...document.querySelectorAll("#run-body tr")].length;
    const expect = T.RUNS.filter(r => r.transfers.some(x => x.from.district === "SKL" || x.to.district === "SKL")).length;
    check("edge-district-runs", rows === expect && expect > 0, `${rows} rows, ${expect} runs touch SKL`);
    $("#district").value = "all"; $("#district").dispatchEvent(new Event("change"));

    // an SMS import changes the plan inputs: impact must recompute
    $('.tab[data-view="overview"]').click();
    const k = "PHC-039IVF", pre = T.IMPACT.lines.get(k).none.days;
    $("#sms").value = "PHC-039 STOCK IVF 60"; $("#ingest").click();
    const post = T.IMPACT.lines.get(k).none.days;
    check("edge-import-recomputes", pre > 0 && post < pre, `${pre} -> ${post}`);

    // D1-D5: backtest
    const b = T.backtest();
    check("D1-holdout-scored", b.lines === 528 && b.days + b.skippedDays === 528 * 14, `${b.days} + ${b.skippedDays}`);
    check("D2-skips-counted", b.skippedDays >= 0 && Number.isFinite(b.wapeModel) && Number.isFinite(b.wapeNaive));
    check("D4-stockout-group", b.withStockouts.lines > 0 && Number.isFinite(b.withStockouts.wapeModel), JSON.stringify(b.withStockouts));
    $('.tab[data-view="stock"]').click();
    const card = $("#bt-tiles .imp .v"), spans = card ? card.querySelectorAll("span") : [];
    const modelWins = b.wapeModel <= b.wapeNaive;
    const colourOk = spans.length === 2 && spans[0].style.color.includes(modelWins ? "--ok" : "--crit") && spans[1].style.color.includes(modelWins ? "--crit" : "--ok");
    check("D5-colour-follows-winner", colourOk, `${modelWins} ${[...spans].map(x => x.style.color).join("|")}`);
    const words = $("#bt-tiles").textContent;
    check("D3-honest-verdict", modelWins ? /less error than|About the same/.test(words) : /more error than|About the same/.test(words), words.slice(0, 120));

    // stage log boundaries
    const L = window.__AG_LOG || [];
    check("log-stage-boundaries", ["plan", "impact", "runs", "orders", "backtest"].every(st => L.some(r => r.stage === st && r.input && r.output)), L.map(r => r.stage).slice(-6).join(","));
    check("no-js-errors", !(window.__errs || []).length, (window.__errs || []).join(" | "));
  };
  setTimeout(() => {
    try { run(); } catch (e) { check("harness-exception", false, e.stack || e); }
    const p = document.createElement("pre"); p.id = "GOLDEN"; p.textContent = JSON.stringify(R); document.body.appendChild(p);
  }, 1500);
})();
