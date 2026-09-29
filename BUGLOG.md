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
