# Contract: Plan impact, vehicle runs, PHC work orders, forecast backtest

## Purpose
Turn the transfer plan from a list of recommendations into something a district
can check and carry out: (A) show how many stock-out days the plan prevents,
(B) group the transfers into vehicle runs a district can drive, (C) tell each PHC
pharmacist exactly what to send and receive, and (D) show how accurate the
forecast has been. These modules consume `EVALS`, `TRANSFERS`, `INDENTS` and
`BASE` as produced today and must not change any of them; the forecasting,
EARS C2 and transfer planner stay as they are (guarded by
`tests/golden/engine_baseline.json`).

## Inputs
- `EVALS`: per PHC x medicine: `stock` (units now), `f[k]` (forecast units on day k, k = 0..59), `m.lead` (resupply days), `m.ven`, `m.cold`, `p.lastReport` (days since report)
- `TRANSFERS`: `{type: "stockout"|"expiry", m, from, to, qty, km, eta (hours)}`
- `INDENTS`: `{m, p, qty, cost, note}`
- `BASE[p][m]`: fitted forecast state, plus raw history `p.hist[m]` (120 days)
- District filter and demand scenario, as selected in the header

## Outputs
- (A) `impact = { none, plan }`, each `{ outDays, vitalOutDays, unmetUnits, linesOut }`, plus the same split per district
- (B) `runs = [{ id, district, stops: [{ phc, pickups: [...], drops: [...] }], km, hours, cold }]`, `runKm` (total), `directKm` (sum of the km for driving every transfer as its own trip from the district HQ: HQ -> donor -> receiver -> HQ)
- (C) `orders = [{ phc, send: [...], receive: [...], indent: [...], verify, sms: [string, ...] }]`
- (D) `backtest = { maeModel, maeNaive, wapeModel, wapeNaive, biasModel, lines, days, skippedDays, withStockouts: { wapeModel, wapeNaive, lines } }` (WAPE = total absolute error / total actual use, so medicines of different volume are comparable)
- A structured record for each stage boundary (`plan -> impact -> runs -> orders`), kept in `window.__AG_LOG` and sent to `console.debug`

## Definitions
- Window: a line is judged over its resupply window, days `0 .. m.lead - 1`. After that, routine resupply arrives, so the plan cannot change the outcome.
- Stock-out day: a day in the window on which the day's forecast demand exceeds the stock on the shelf that day. Demand that cannot be met is lost (patients go without); it is not carried over. A day counts in proportion to the share of demand unmet, so half the demand unmet counts as 0.5 days.
- Arrival day of a transfer: `ceil(eta / 24)`. Donors lose the quantity on day 0.
- Warehouse indents arrive with routine resupply (day `m.lead`), so they cover demand after the window and are reported separately. They are not counted as preventing in-window stock-out days.

## Behavior cases (input -> expected output)
| # | Input | Expected output | Notes |
|---|-------|------------------|-------|
| A1 | Line: stock 10, forecast 5/day, lead 7, no transfers | `outDays` = 5 (days 2 to 6), `unmetUnits` = 25 | 10 units last 2 days |
| A2 | A1 plus a 30-unit transfer with eta 20 h (arrives day 1) | `plan.outDays` = 0 for this line | 40 units cover 8 days, which is past lead 7 |
| A3 | A1 plus a 10-unit transfer with eta 30 h (arrives day 2) | `plan.outDays` = 3 | 20 units last 4 days, so days 4 to 6 are out |
| A4 | Donor: stock 200, forecast 5/day, lead 7, sends 30 | Donor `plan.outDays` = 0 | The planner keeps lead + 14 days for donors |
| A5 | Full synthetic network, any scenario | For every donor line, `plan.outDays <= none.outDays` | Invariant: a transfer never creates a stock-out at the donor |
| A6 | Full network, any scenario | `plan.outDays <= none.outDays` overall, and `vitalOutDays <= outDays` | |
| B1 | Two transfers from the same donor PHC | One pickup stop that lists both items | |
| B2 | PHC-A to PHC-C and PHC-B to PHC-C, all in one district | One run: 2 pickups then 1 drop; every pickup comes before its drop | |
| B3 | No transfers | `runs` = [], `runKm` = 0, `directKm` = 0 | |
| B4 | A run longer than 8 h (drive at 35 km/h plus 15 min per stop) | Split into more runs, each 8 h or less, unless a single transfer alone takes longer (then 1 run, flagged) | |
| B5 | A run carrying any cold-chain item | `cold` = true, shown as "needs cold box" | |
| B7 | Transfer between districts | Carried by the vehicle of the donor's or the receiver's district, whichever makes the shorter separate trip; `directKm` uses the same choice | Avoids 15-hour runs for long cross-district hauls |
| B6 | Full network | `runKm <= directKm`, and every transfer appears in exactly one run | A transfer joins a run only if that costs no more km than a separate trip |
| C1 | PHC-033 sends 29 OXY to PHC-047 and receives 22 INS from PHC-034 | SMS "AG PHC-033: SEND OXY 29 to PHC-047. RECV INS 22 from PHC-034. Reply OK or NO." | Uses the same medicine codes as the inbound SMS format |
| C2 | Order text longer than 160 characters | Split into parts prefixed "1/2", "2/2", ...; every part is 160 characters or less | |
| C3 | PHC whose last report is 3 or more days old | `verify` = true, and the first SMS asks for a stock count before dispatch | Prevents moving stock based on stale numbers |
| C4 | PHC with no transfers or indents | No order for that PHC | |
| D1 | Every line with 120 days of history | Fit on days 0 to 105, forecast days 106 to 119, compare with the actual values | Holdout = the last 14 days |
| D2 | Actual day that was a stock-out (a censored zero) or a flagged entry error | Excluded from the error and counted in `skippedDays` | Neither is real demand |
| D4 | Lines with stock-out days inside the naive average's 28-day window (the 28 days before the holdout) | Error for the model and the naive average reported separately for this group (`withStockouts`) | This is where correcting censored demand should matter |
| D5 | Any result | Colours follow the numbers: the lower error is shown as the better one, whether that is the model or the average | No styling that implies the model won when it did not |
| D3 | Full network | `maeModel` and `maeNaive` (mean of the last 28 raw days) are both shown, whichever is better | Report honestly, never force the model to look better |

## Edge cases that must be covered
- Forecast of 0 for a line: no stock-out days, and no division by zero in cover
- District filter set: impact counts only lines in that district; runs and orders still include cross-district partners of transfers that touch it
- Scenario change or SMS/CSV import: impact, runs and orders recompute with the plan
- "Approve all transfers" does not change the impact numbers (approval is a status, not new stock)
- PHC names and codes are escaped wherever they are rendered

## Explicitly out of scope
- Changing the transfer planner, forecast, EARS C2 or federated model (the engine baseline must stay identical)
- Real SMS sending (orders are generated and copyable; a gateway is the production path)
- Vehicle capacity by weight or volume (stop count and hours only)
- Road-network routing (keeps the planner's 1.3 x straight-line road factor)

## Status
- [x] Drafted
- [x] Reviewed by a human (all four modules approved 2026-09-29)
- [ ] Implementation matches this contract
- [ ] Golden tests exist for every behavior case above
