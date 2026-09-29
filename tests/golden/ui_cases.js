// Golden cases for contracts/frontend-ui.md, run inside the real built page by tests/run_golden.sh.
// Each case records [pass, detail]. The mode comes from ?mode= and is set up by the pre-script in run_golden.sh.
(() => {
  const $ = q => document.querySelector(q);
  const mode = new URLSearchParams(location.search).get("mode") || "default";
  const cur = () => $('.tab[aria-selected="true"]').dataset.view;
  const R = {};
  const check = (id, ok, detail) => { R[id] = [!!ok, detail === undefined ? "" : String(detail)]; };
  const run = () => {
    const tourOn = () => !$("#tour").hidden;
    const step = () => $("#tour-step").textContent;
    const TOUR = ["overview", "surveillance", "stock", "redistribute", "federated", "brief"];

    if (mode === "default") {
      check("c01-first-visit-tour", tourOn() && step() === "Step 1 of 6" && cur() === "overview", `${tourOn()} ${step()} ${cur()}`);
      $("#scenario").value = "dengue"; $("#scenario").dispatchEvent(new Event("change"));
      const seq = [cur()];
      for (let i = 0; i < 5; i++) { $("#tour-next").click(); seq.push(cur()); }
      check("c02-next-walks-views", seq.join(">") === TOUR.join(">"), seq.join(">"));
      check("edge-tour-keeps-scenario", $("#scenario").value === "dengue", $("#scenario").value);
      $("#tour-next").click();
      let stored = null; try { stored = localStorage.getItem("ag-tour-done"); } catch (e) {}
      check("c03-finish-closes-and-stores", !tourOn() && stored === "1" && cur() === "brief", `${tourOn()} ${stored} ${cur()}`);
      $("#tour-open").click(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      check("c03b-escape-closes", !tourOn());
      $("#scenario").value = "normal"; $("#scenario").dispatchEvent(new Event("change"));

      // c14: engine numbers unchanged in every scenario
      const got = {};
      for (const s of ["normal", "dengue", "diarrhoea", "heat"]) {
        $("#scenario").value = s; $("#scenario").dispatchEvent(new Event("change"));
        $('.tab[data-view="redistribute"]').click();
        const rd = $("#rd-tiles").innerText.replace(/\s+/g, " ");
        $('.tab[data-view="overview"]').click();
        const v = $("#tiles").innerText.replace(/\s+/g, " ") + " || " + rd;
        got[s] = (v.match(/[₹\d][\d,.]*%?( lakh| km)?/g) || []).join(" ");
      }
      const base = window.__GOLDEN_BASELINE || {};
      for (const s of Object.keys(got)) check(`c14-engine-${s}`, got[s] === base[s], got[s]);
      $("#scenario").value = "normal"; $("#scenario").dispatchEvent(new Event("change"));

      // c09 / c10: map tooltip and click
      $('.tab[data-view="overview"]').click();
      const dot = [...document.querySelectorAll("#map .dot")].find(d => d.dataset.phc === "PHC-001");
      const tip = dot && dot.querySelector("title").textContent;
      check("c09-dot-tooltip", tip && /PHC-001/.test(tip) && /Srikakulam/.test(tip) && /critical/.test(tip) && /last report/.test(tip), tip);
      check("c09b-dot-count", document.querySelectorAll("#map .dot").length === 48, document.querySelectorAll("#map .dot").length);
      $("#district").value = "KNL"; $("#district").dispatchEvent(new Event("change"));
      [...document.querySelectorAll("#map .dot")].find(d => d.dataset.phc === "PHC-001").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      check("c10-dot-click-opens-forecast", cur() === "stock" && /PHC-001/.test($("#detail-title").textContent) && $("#district").value === "all", `${cur()} ${$("#detail-title").textContent} ${$("#district").value}`);
      const before = $("#detail-title").textContent;
      $("#scenario").value = "heat"; $("#scenario").dispatchEvent(new Event("change"));
      check("edge-selection-survives-recompute", $("#detail-title").textContent === before, $("#detail-title").textContent);
      $('.tab[data-view="overview"]').click();
      const d2 = [...document.querySelectorAll("#map .dot")].find(d => d.dataset.phc === "PHC-040");
      d2.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      check("c10b-dot-enter-key", cur() === "stock" && /PHC-040/.test($("#detail-title").textContent), $("#detail-title").textContent);
      $("#scenario").value = "normal"; $("#scenario").dispatchEvent(new Event("change"));

      // c11: transfers table fits at desktop width
      $('.tab[data-view="redistribute"]').click();
      const w = $("#v-redistribute .tbl-wrap");
      check("c11-transfers-fit-1440", innerWidth < 1400 || w.scrollWidth <= w.clientWidth, `${w.scrollWidth}/${w.clientWidth} @${innerWidth}`);

      // c13: footer
      const f = $(".site-foot").textContent, a = $(".site-foot a");
      check("c13-footer", /Track 3/.test(f) && /synthetic/.test(f) && a && /github\.com\/Aral-549\/aushadh-grid/.test(a.href), f.slice(0, 80));

      // c07: theme toggle from the OS default
      const osDark = matchMedia("(prefers-color-scheme: dark)").matches;
      $("#theme-btn").click();
      let th = null; try { th = localStorage.getItem("ag-theme"); } catch (e) {}
      const want = osDark ? "light" : "dark";
      check("c07-theme-toggle", document.documentElement.dataset.theme === want && th === want, `${document.documentElement.dataset.theme} ${th}`);
      // hero only on overview
      check("edge-hero-only-overview", $("#hero").hidden === true);
      $('.tab[data-view="overview"]').click();
      check("edge-hero-on-overview", $("#hero").hidden === false);
    }

    if (mode === "done") {
      check("c04-no-tour-when-done", !tourOn());
      $('.tab[data-view="expiry"]').click();
      $("#tour-open").click();
      check("c04b-tour-button-reopens", tourOn() && step() === "Step 1 of 6" && cur() === "overview", `${step()} ${cur()}`);
    }

    if (mode === "blocked") {
      check("c05-tour-without-storage", tourOn() && step() === "Step 1 of 6");
      $("#tour-next").click();
      check("c05b-next-without-storage", cur() === "surveillance" && step() === "Step 2 of 6", `${cur()} ${step()}`);
      $("#theme-btn").click();
      check("c05c-theme-without-storage", !!document.documentElement.dataset.theme);
      $("#tour-skip").click();
      check("c05d-skip-without-storage", !tourOn());
    }

    if (mode === "deeplink") {
      check("c06-deeplink-kept", cur() === "stock" && tourOn() && step() === "Step 1 of 6" && $("#hero").hidden, `${cur()} ${step()}`);
      // BUGLOG 2026-09-29: step 1 describes the map; Next must first show step 1's own view, not skip to step 2
      $("#tour-next").click();
      check("c06b-regression-next-shows-step-view", cur() === "overview" && step() === "Step 1 of 6", `${cur()} ${step()}`);
      $("#tour-next").click();
      check("c06c-then-advances", cur() === "surveillance" && step() === "Step 2 of 6", `${cur()} ${step()}`);
    }

    if (mode === "badhash") check("edge-unknown-hash", cur() === "overview", cur());

    if (mode === "storedlight") {
      const osDark = matchMedia("(prefers-color-scheme: dark)").matches;
      check("c08-stored-light-wins", osDark && getComputedStyle(document.body).backgroundColor === "rgb(241, 244, 243)", `${osDark} ${getComputedStyle(document.body).backgroundColor}`);
    }

    if (mode === "narrow") {
      const views = ["overview", "surveillance", "stock", "expiry", "redistribute", "capacity", "quality", "federated", "brief"];
      const bad = [];
      for (const v of views) { $(`.tab[data-view="${v}"]`).click(); if (document.documentElement.scrollWidth > innerWidth) bad.push(`${v}:${document.documentElement.scrollWidth}`); }
      check("c12-no-page-scroll", !bad.length, `${innerWidth}px ${bad.join(" ")}`);
      const t = $("#tour").getBoundingClientRect(), tabs = $(".tabs").getBoundingClientRect();
      check("edge-tour-fits-phone", t.left >= 0 && t.right <= innerWidth && t.top > tabs.bottom && t.bottom <= innerHeight, `${Math.round(t.left)}-${Math.round(t.right)} top ${Math.round(t.top)}`);
    }

    check("no-js-errors", !(window.__errs || []).length, (window.__errs || []).join(" | "));
  };
  setTimeout(() => {
    try { run(); } catch (e) { check("harness-exception", false, e.stack || e); }
    const p = document.createElement("pre"); p.id = "GOLDEN"; p.textContent = JSON.stringify(R); document.body.appendChild(p);
  }, 1500);
})();
