# Contract: Demand forecast smoothing parameters

## Purpose
Fix the forecast so it beats a plain 28-day average, without flattering the
result. Owns the smoothing parameters of `baseForecast` (Holt linear smoothing
on the cleaned, day-of-week adjusted series) and how they are chosen. The
cleaning step, day-of-week factors, outbreak multipliers, and everything
downstream (stock-out risk, transfers, dispatch) are unchanged, and simply
consume the new forecast.

## Inputs
- `raw`: 120 days of recorded daily use per PHC x medicine (the fit uses a prefix of it)
- Parameter grid: `alpha` in {0.05, 0.1, 0.15, 0.2, 0.3, 0.4}, `beta` (trend) in {0, 0.02, 0.05, 0.08}

## Outputs
- `ALPHA`, `BETA`: the pair used by the engine, with a comment recording how it was chosen
- `tools/tune_forecast.py`: reproduces the selection and prints the grid
- A regenerated `tests/golden/engine_baseline.json` (approved by the human on 2026-09-29, since the numbers are forecast-driven)

## Selection protocol (no peeking)
- Selection window: fit on days 0-91, forecast days 92-105, score WAPE against the actual values. Stock-out days and entry errors are excluded, as in the backtest.
- The reported holdout (fit on 0-105, forecast 106-119) is never used to choose parameters.
- The pair with the lowest selection-window WAPE wins. Ties go to the smaller `beta`, then the larger `alpha`.

## Behavior cases (input -> expected output)
| # | Input | Expected output | Notes |
|---|-------|------------------|-------|
| F1 | Grid search on the selection window | Chosen pair has the minimum selection WAPE of the 24 pairs | Reproduced by `tools/tune_forecast.py` |
| F2 | Reported holdout (days 106-119) | Model and 28-day average WAPE shown as measured, whichever is lower | Unchanged honesty rule (contract impact-and-dispatch D3/D5) |
| F3 | Constant series, 5 units/day for 120 days | Forecast is 5.0 on every day 1-60 (within 1e-6) | No drift |
| F4 | 10 units/day, with the last 5 days recorded as 0 (a stock-out) | 14-day forecast mean within 10% of 10 | Cleaning still re-estimates censored demand |
| F5 | Full network after the change | Every invariant in `tests/golden/impact_cases.js` still passes (donor never worse, runs, SMS) | |
| F6 | Engine numbers that do not depend on the forecast | Unchanged: PHCs 48, lines 528, reports overdue 6, beds 553 of 868 | Only forecast-driven numbers move |

## Edge cases that must be covered
- Series that is all zeros: forecast 0, no NaN
- `beta = 0` with the existing damping (`min(k, 21)`): trend contribution is exactly 0
- Parameters stay fixed at run time; the page does not re-tune on the viewer's data

## Explicitly out of scope
- Changing the cleaning rules, day-of-week factors or outbreak multipliers
- New model families (ETS with seasonality states, ML models)
- Re-tuning per medicine or per PHC (a production option once real data exists)

## Status
- [x] Drafted
- [x] Reviewed by a human (approach approved 2026-09-29: tune on an earlier window, update the frozen engine baseline)
- [x] Implementation matches this contract (chosen: alpha 0.05, beta 0)
- [x] Golden tests exist for every behavior case above (`tests/golden/forecast_cases.js`, mutation-checked)
