# Bug Log

Every entry here must result in a permanent case added to `tests/golden/`
before it's marked resolved. A patched bug without a regression case is not
resolved — it's just hidden until the next rewrite.

---

## 2026-09-29 — Tour skips its first view when opened on a deep link
- **Symptom:** First visit to `index.html#stock`: the tour card shows step 1 ("The network at a glance", which describes the map) while the Stock view is on screen. Pressing Next jumps to step 2 (Outbreak signals), so the map step is never shown.
- **Root cause:** `tour-next` always advanced to `tourAt + 1`; it never checked whether the current view matched the step being shown. The auto-open keeps the deep-linked view by design (contract case 6).
- **Stage/module:** Presentation layer, guided tour (`src/app.html`, tour wiring)
- **Regression case added:** `tests/golden/ui_cases.js` — cases `c06b-regression-next-shows-step-view`, `c06c-then-advances` (mode `deeplink`)
- **Status:** fixed

## 2026-09-29 — Transfers table clipped by a few pixels when the page scrollbar is visible
- **Symptom:** At a 1440 px window with a classic (space-taking) scrollbar, the Transfers table is 1237 px wide in a 1233 px box, so it scrolls sideways and the Status column is partly hidden. Screenshots taken with hidden scrollbars did not show it.
- **Root cause:** Every cell was `white-space: nowrap`, so the table could not shrink below the sum of its longest cell contents; the scrollbar's 15 px was enough to tip it over.
- **Stage/module:** Presentation layer, table styles (`src/app.html` CSS)
- **Regression case added:** `tests/golden/ui_cases.js` — case `c11-transfers-fit-1440` (mode `default`, run with a visible scrollbar)
- **Status:** fixed

## 2026-09-29 — Backtest cards implied the model won when it lost
- **Symptom:** The Stock view showed the model's error (22.0%) in green and the 28-day average's (21.3%) in red with a strike-through, although the average had the lower error.
- **Root cause:** Colours were hard-coded per card (model = good, naive = bad) instead of following the numbers.
- **Stage/module:** Presentation layer, `renderBacktest` (`src/app.html`)
- **Regression case added:** `tests/golden/impact_cases.js` — cases `D5-colour-follows-winner`, `D3-honest-verdict`
- **Status:** fixed

## 2026-09-29 — Cross-district transfers made 15-hour vehicle runs
- **Symptom:** 11 of 42 runs exceeded an 8-hour day (longest 15.2 h) because every transfer rode on the donor district's vehicle, even when the receiver's district vehicle was much closer.
- **Root cause:** `planRuns` grouped by `t.from.district` only.
- **Stage/module:** Dispatch planner, `planRuns` / `carrier` (`src/app.html`)
- **Regression case added:** `tests/golden/impact_cases.js` — invariant `B7-cheaper-*` inside `A5-A6-B-C-invariants-all-scenarios`
- **Status:** fixed (11 runs still need an overnight stop: they carry single hauls of up to 250 km that the transfer planner allows; flagged in the UI as "overnight")

## 2026-09-29 — Stock-count threshold not covered by any test
- **Symptom:** Mutation testing: changing the stale-report threshold from 3 to 4 days in `workOrders` left the whole suite green.
- **Root cause:** No PHC with a transfer has a report exactly 3 days old in the synthetic data, so the invariant never exercised the boundary.
- **Stage/module:** Test suite gap for PHC work orders
- **Regression case added:** `tests/golden/impact_cases.js` — case `C3-boundary-3-days`
- **Status:** fixed (mutant now fails the suite)

## 2026-09-29 — Forecast is less accurate than a 28-day average
- **Symptom:** 14-day holdout backtest: model WAPE 22.0% vs 21.3% for a plain 28-day mean; on lines with recent stock-outs 25.1% vs 24.3%.
- **Root cause:** The Holt trend term (beta 0.08, damped after 21 days) extrapolates noise. Scratch experiment with no trend: 19.9% (alpha 0.3) to 19.0% (alpha 0.1), and 20.0% vs 24.3% on stock-out lines.
- **Stage/module:** Forecast engine, `baseForecast` (`src/app.html`)
- **Regression case added:** `tests/golden/forecast_cases.js` — cases `F1-chosen-on-selection-window`, `F2-holdout-honest`, `F3-constant-no-drift`, `edge-beta0-flat`; `tests/golden/engine_baseline.json` regenerated after review (previous values kept in the file)
- **Fix:** alpha 0.05, beta 0, chosen by `tools/tune_forecast.py` on days 92-105. Untouched holdout: 18.86% vs 21.31% for the 28-day average; lines with recent stock-outs 19.7% vs 24.3%.
- **Status:** fixed

## 2026-09-29 — Template placeholder shown in the cluster table header
- **Symptom:** The Resilience tab's cluster table header read "Hub buffer for ${TARGET_TXT} in any emergency".
- **Root cause:** A JavaScript template expression was written into static HTML markup, where it is never evaluated.
- **Stage/module:** Presentation layer, Resilience markup (`src/app.html`)
- **Regression case added:** `tests/golden/resilience_cases.js` — case `regression-no-template-leaks` (no view may show `${`, `undefined` or `NaN`)
- **Status:** fixed

## 2026-09-29 — "If a acute diarrhoeal outbreak" in the resilience summary
- **Symptom:** The stress-test summary used "a" before scenario names that start with a vowel.
- **Root cause:** Hard-coded article in the sentence template.
- **Stage/module:** Presentation layer, `renderResilience`
- **Regression case added:** `tests/golden/resilience_cases.js` — case `ui-lede-article`
- **Status:** fixed
