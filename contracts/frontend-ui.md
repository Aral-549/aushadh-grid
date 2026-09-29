# Contract: Frontend UI polish (submission build)

## Purpose
Make the dashboard understandable to a judge who opens the prototype link cold,
and fix visible layout defects. Presentation layer only (`src/app.html` markup,
CSS and view wiring, then `./build.sh` to regenerate `index.html`). It hands off
all numbers to the existing engine functions (`recompute`, `planTransfers`,
forecasting, EARS C2, FedAvg), which this change must not alter.

## Inputs
- `location.hash`: one of the 9 view ids, or empty / unknown
- `localStorage["ag-tour-done"]`: `"1"` or absent; storage may throw (private window, embedded preview)
- `localStorage["ag-theme"]`: `"light"` | `"dark"` | absent
- OS colour scheme (`prefers-color-scheme`)
- Viewport width: 360 px to 1920 px
- User clicks on: tour controls, theme toggle, map dots

## Outputs
- DOM state of the page (visible view, tour step, `data-theme` attribute, tooltips)
- No change to any engine-computed value (tile numbers, transfers, forecasts)

## Behavior cases (input -> expected output)
| # | Input | Expected output | Notes |
|---|-------|------------------|-------|
| 1 | First visit, no `ag-tour-done`, hash empty | Overview renders; a "Start here" tour card is visible at step 1 of 6 | Tour does not block reading the page behind it |
| 2 | Tour step N, click Next | Tab for step N+1 becomes selected, its section is shown, card text changes to step N+1 | Steps: Overview, Outbreak signals, Stock & forecast, Transfers & indents, BRICS federated model, AI situation brief |
| 3 | Tour step 6, click Finish (or Skip at any step, or Esc) | Card closes; `ag-tour-done="1"` stored; the current view stays shown | |
| 4 | Revisit with `ag-tour-done="1"` | No tour card; header "Tour" button is visible and reopens the tour at step 1 | |
| 5 | `localStorage` throws | Tour shows on load and all tour controls work; nothing is persisted; no console error | |
| 6 | Deep link `#stock` on first visit | Stock view shown; the tour card starts at step 1. The first Next shows step 1's own view (Overview) without advancing; the next Next goes to step 2 | The link target is respected until the user interacts (BUGLOG 2026-09-29) |
| 7 | Click theme toggle while the OS is light and nothing is stored | `data-theme="dark"`, colours and charts switch to dark, `ag-theme="dark"` stored | Existing MutationObserver re-renders charts |
| 8 | Reload with `ag-theme="light"` while the OS is dark | Page renders light | |
| 9 | Hover or focus a PHC dot on the map | Tooltip shows PHC id, name, district, count of critical lines, report age | SVG `<title>` is acceptable |
| 10 | Click a PHC dot | Switches to Stock & forecast with that PHC's highest-risk line selected in the detail chart | |
| 11 | Viewport 1440 px, Transfers view | Every column including Status is visible without scrolling the table sideways | Currently the Status column is clipped |
| 12 | Viewport 390 px, any view | No horizontal page scroll; header controls wrap; tables scroll inside their own box | |
| 13 | Any view | Footer shows: Track 3 label, "synthetic data" notice, link to the GitHub repo | |
| 14 | Before/after comparison of tile values in all 4 demand scenarios | Identical numbers | Guards against touching the engine |

## Edge cases that must be covered
- Unknown hash (`#foo`) falls back to Overview, as it does today
- Tour opened while a scenario other than Normal is selected: the scenario is not changed by the tour
- Tour card on a 360 px screen fits the viewport and does not cover the tab bar
- The theme toggle and the OS scheme change mid-session: the stored explicit choice wins
- Embedded preview (iframe): tour and theme work; storage failures are silent

## Explicitly out of scope
- Forecasting, surveillance, optimiser and federated maths (engine functions in the same file)
- Real map tiles or new data sources (the map stays an offline SVG)
- Deck PDF, demo video and screenshots in `docs/` (regenerated separately if the UI changes enough)
- Gemini prompt contents

## Status
- [x] Drafted
- [x] Reviewed by a human (approved 2026-09-29)
- [x] Implementation matches this contract
- [x] Golden tests exist for every behavior case above (`tests/golden/ui_cases.js`, run with `python3 tests/run_golden.py`)
