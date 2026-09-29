# Contract: Resilience stress test, pre-positioning, shared cluster shelves

## Purpose
Change the question from "what runs out this week?" to "if an emergency hit this
district tomorrow, how much of the demand for vital and outbreak medicines could
its PHCs still meet, and what do we move now so they can?". Three layers:
(1) a stress test of every district against every emergency scenario,
(2) a pre-positioning planner that moves spare stock in calm times to the weakest
district first, (3) shared cluster shelves: the PHCs of a district act as one
virtual shelf around a hub, so stock flows to wherever the surge lands.
Consumes `BASE` forecasts, `EVALS` stock and today's `TRANSFERS`; changes none
of them. Today's plan, tiles and `tests/golden/engine_baseline.json` stay identical.

## Inputs
- Per PHC x medicine: current stock estimate `e.stock`, baseline forecast `BASE[p][m].f` (no scenario applied), residual spread `BASE[p][m].sd`, `m.lead`, `m.ven`, `m.cold`, `m.sens[scenario]`, `p.ilrOk` (working fridge), coordinates
- Today's `TRANSFERS` (the stress test starts from stock after today's plan)
- Scenarios: dengue, diarrhoea, heatwave (`SCENARIOS`), applied one district at a time

## Definitions
- Surge: scenario S hits district D today. For each PHC in D and medicine m, demand on day k is `f[k] * (1 + (s - 1) * min(1, (k + 1) / 3))` with `s = m.sens[S] || 1`, the same ramp the engine already uses for outbreaks.
- Window: 14 days, **no routine resupply** (stress assumption: emergencies disrupt supply lines). Unmet demand is lost (same rule as plan impact).
- Critical medicines for S: vital (`ven = V`) or demand rises in S (`sens[S] > 1`).
- Stock at day 0: current stock, minus today's outgoing transfers, plus today's incoming transfers on their arrival day, plus pre-positioned stock (already on the shelf at day 0, because it moved before the emergency).
- **Resilience R(D, S)**: for each critical medicine, the share of the district's surge demand that is met (total met / total demand over its PHCs); R is the mean over critical medicines. Range 0 to 1; 1 when there is no demand.
- Worst case of a district: min over S of R(D, S). State resilience: mean over districts of their worst case.
- **Shared cluster shelf**: per district and medicine, the PHCs' stock and demand are summed and served as one shelf (same-day delivery by the district vehicle from the hub).
- **Hub**: the district PHC with a working fridge nearest the district centre (any PHC if none has one).
- **Hub buffer (resilience budget)**: after the shared shelf, the extra stock each district hub must hold so that, for every critical medicine and every scenario, at least `TARGET` = 90% of surge demand is met. Per medicine and scenario, buffer = max(0, 0.9 x demand - met) (an extra unit on the shelf at day 0 is used as long as demand is unmet); per medicine, the hub holds the largest over scenarios. Valued at `m.price`. Hubs issue the buffer oldest-first into routine use, so it rotates rather than expires.
- Safety stock for 95% service: independent `sum_i 1.65 * sd_i * sqrt(L)`; pooled `1.65 * sqrt(sum_i sd_i^2) * sqrt(L)`, valued at `m.price`.

## Pre-positioning planner
- Repeat up to 40 moves: take the (district, scenario) pair with the lowest R that is not exhausted. Within it, take the critical medicine with the lowest met share, then the PHC with the largest unmet demand.
- Donor: same medicine at another PHC within 150 road km (1.3 x straight line); both fridges working for cold-chain items. A donor gives only its **spare**: stock at day 0 minus what it has already given minus its own largest 14-day surge demand over all scenarios. So no donor becomes less resilient in any scenario.
- Nearest donor with spare first. Quantity = min(spare, receiver's unmet demand, rounded up). A move smaller than one day of the receiver's surge demand is skipped.
- A pair with no feasible move is marked exhausted; the planner moves on to the next weakest.

## Outputs
- `RESIL = { pairs: [{ d, s, today, prepos, shared, buffered }], buffers: [{ d, hub, items: [{ m, qty, value }], value }], budget, moves: [{ d, s, m, from, to, qty, km, before, after }], clusters: [{ d, hub, spokes, maxKm, ssIndep, ssPooled }], state: { today, prepos, shared }, weakest }`
- Resilience tab: stress-test matrix (districts x scenarios), worst case per district across the three layers, pre-positioning orders, cluster hubs and safety-stock savings
- A structured stage-log record `resilience` (input sizes, output state and move count)

## Behavior cases (input -> expected output)
| # | Input | Expected output | Notes |
|---|-------|------------------|-------|
| R1 | One line: stock 10, surge demand 5/day, 14 days | Met 10 of 70, share 1/7 | |
| R2 | Surge ramp: base 10/day, s = 3 | Day 0 demand 16.67, day 1 23.33, day 2 onward 30 | Same ramp as `multiplier()` |
| R3 | Medicine with no demand in the district | R counts it as fully met (1) | No division by zero |
| S1 | Two PHCs, one medicine: A stock 0, B stock 140, each 5/day for 14 days | Independent share 0.5; shared shelf 1.0 | Pooling |
| S2 | Four PHCs with equal sd | Pooled safety stock = half of independent | Square-root law |
| S3 | Full network | For every (D, S): `buffered >= shared >= prepos >= today` | Layers only add |
| H1 | One medicine: demand 70, met 10, target 0.9 | Buffer 53 units | 0.9 x 70 - 10 |
| H2 | Medicine already at or above 90% in every scenario | Buffer 0 | |
| H3 | Full network with hub buffers | Every (D, S) has `buffered >= 0.9` (within 1e-6) | The budget achieves its target |
| P1 | Full network after pre-positioning | No line's unmet demand increases in any scenario (donors keep their worst-case need) | |
| P2 | Full network | Every move: same medicine, road km <= 150, cold-chain rule respected, qty >= 1 day of surge demand | |
| P3 | Full network | Total given by each donor <= its spare at the start | |
| P4 | Any scenario or district filter | Today's tiles, transfers and plan impact unchanged (engine baseline identical) | Stress test is read-only |
| P5 | Scenario selector changed | Stress test uses today's stock under that selection, but always applies its own surge per district; the result is deterministic for a given state | |

## Edge cases that must be covered
- District where every PHC has a faulty fridge: cold-chain medicines get no moves; hub falls back to any PHC
- A PHC that is both a donor for today's plan and a receiver in pre-positioning
- CSV/SMS import changes stock: the stress test recomputes
- R values rendered as percentages; the colour thresholds follow the numbers (red < 60%, amber < 85%, green otherwise)

## Explicitly out of scope
- Routine resupply during the surge (a stated stress assumption; the plan-impact view models the calm case)
- Physically re-organising PHCs into clusters (the shelf is virtual; the hub is a recommendation)
- Changing today's transfer planner or forecast

## Status
- [x] Drafted
- [x] Reviewed by a human (direction approved 2026-09-29: "1 and 2 together"; behaviour cases not reviewed line by line)
- [ ] Implementation matches this contract
- [ ] Golden tests exist for every behavior case above
