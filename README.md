# Aushadh Grid

**Track 3: Smart Health & Supply Chain Resilience** · Build with AI: Code for Communities, Second Edition

Aushadh Grid ("medicine grid") is a federated AI platform for the medicine supply chain of a nation's Primary Health Centre (PHC) network. It detects outbreaks from clinic visit data, forecasts medicine demand, and warns before a stock-out. It moves stock between PHCs so that one centre's surplus covers another's shortage and near-expiry lots are used instead of thrown away. National health systems can train a shared demand model without moving patient or facility records across borders.

Live prototype: open `index.html` in any browser, or visit the GitHub Pages link in the repo description.

## The problem, as it looks on the ground

- **Stock-outs next to surplus.** A PHC runs out of ORS while a centre 40 km away holds months of it. Stock is reported late, on paper or by phone.
- **Expiry wastage.** Quiet centres hold lots that expire on the shelf, while busy centres nearby are short of the same medicine.
- **Bad data breeds bad forecasts.** A PHC that ran out records zero use, so any model trained on it concludes that demand is low and orders less. Typos (an extra zero) and late reports make it worse.
- **Outbreaks are declared late.** Fever and diarrhoea visits rise days before an outbreak is officially confirmed, and demand for ORS, IV fluids and paracetamol can triple in that time.
- **Cold chain.** Insulin, vaccines and oxytocin need 2–8 °C. They cannot be moved like tablets, and a faulty fridge makes restocking pointless.
- **Tight budgets.** When money is short, WHO VEN practice says vital medicines come first.

## What the prototype does

| View | What it shows |
| --- | --- |
| **Overview** | Headline numbers, outbreak signal banner, geographic risk map of 48 PHCs across 12 districts, early warnings (vital medicines first), and SMS/WhatsApp report intake. |
| **Outbreak signals** | Syndromic OPD surveillance (fever, diarrhoea, heat illness) for every district, using the CDC EARS C2 method. One click applies outbreak demand to the forecasts of exactly the affected districts. |
| **Stock & forecast** | 528 medicine lines (48 PHCs × 11 essential medicines). Each has a 14-day demand forecast with an 80% band, days of cover, and stock-out probability within the resupply lead time. The chart marks stock-out days and entry errors that were corrected before fitting. |
| **Expiry & wastage** | First-expiry-first-out simulation of every lot against its PHC's own forecast. It shows which lots will expire unused, their ₹ value, and where to send them so they are used in time. |
| **Transfers & indents** | Two transfer types: *Prevent stock-out* and *Rescue expiring stock*. Both respect cold-chain rules, and vital medicines go first. Unmet need becomes a state warehouse indent with cost, VEN priority, and a fridge-fault note where restocking must wait for a repair. |
| **Beds, staff & referral** | Bed occupancy, 14-day staff attendance, fridge status, and a referral finder that lists the nearest PHCs with a free bed and a medical officer on duty. |
| **Data quality** | Overdue reports (today's stock is estimated for these), automatic history corrections, and CSV import/export of the stock ledger, so a real district can load its own data. |
| **BRICS federated model** | FedAvg training across six national nodes. Only weights are shared. Nodes with little data and little outbreak history cut forecast error by about 30%. |
| **AI situation brief** | A Gemini-written brief for the District Health Officer in any language, grounded only in the live dashboard state shown on screen. Offline template fallback in English, Hindi and Portuguese. |

## How the AI works

1. **Outbreak detection.** CDC EARS C2 runs on daily syndromic OPD counts. The baseline is 7 days ending 2 days before today, and its spread uses a Poisson floor so small counts do not raise false alarms. An alert needs 3 SD on 2 of the last 3 days. Applying a signal switches medicine-specific demand multipliers on for the alert districts and for watch districts within 150 km.
2. **History cleaning.** Runs of 3+ zero-use days at a PHC that normally dispenses the item are treated as stock-outs (censored demand) and re-estimated from the surrounding level and weekday pattern. Days above 4× their local median are capped as entry errors.
3. **Demand forecasting.** Holt linear exponential smoothing on the cleaned, day-of-week adjusted series, with the trend damped after 3 weeks.
4. **Stale-report handling.** If a PHC has not reported for *n* days, today's stock is the reported stock minus forecast use since then, and forecast uncertainty grows by √(1 + n / lead time).
5. **Stock-out early warning.** P(stock-out) = P(demand over the lead time > stock on hand). Lines are classed Critical (runs out before resupply), Warning (below lead time + 7 days), Healthy or Surplus (over 45 days).
6. **Expiry simulation.** Lots are consumed first-expiry-first-out against the forecast. Whatever cannot be used before its expiry date is projected wastage, valued at state tender prices.
7. **Redistribution optimiser.** Greedy matching over road distance (1.3 × haversine). Receivers are ranked by risk and donors keep lead time + 14 days of their own demand. Donors with expiring stock are preferred. Cold-chain items move only between PHCs with working fridges, within 150 km. A second pass sends expiring lots to PHCs that can use them before the expiry date.
8. **Field report validation.** A reported jump of more than 60 days of demand, with no delivery on record, is held and the pharmacist is asked to confirm, which catches the classic extra-zero typo.
9. **Federated learning.** A linear demand model (weekday, temperature anomaly, rainfall, outbreak flag, last-week demand) is trained locally on each node. The coordinator runs sample-weighted FedAvg, and raw records never leave the node.
10. **Generative AI.** Gemini (`gemini-2.5-flash` by default, configurable) turns the structured dashboard state into a multilingual briefing. The exact JSON sent to the model is shown on screen.

## Run it

No build step and no backend: open `index.html`.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

To edit, change `src/app.html` and run `./build.sh` to regenerate `index.html`. The hosted build loads Chart.js from `vendor/` (MIT licence) and uses the CDN only as a fallback, so the dashboard works on poor or no connectivity.

**Deploy to GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → `main` / root. The app is live at `https://<user>.github.io/aushadh-grid/` within a minute.

**Gemini:** paste an API key from [Google AI Studio](https://aistudio.google.com/apikey) into the *AI situation brief* tab. The key stays in the browser's localStorage.

**Your own data:** *Data quality* tab → paste or choose a CSV with `phc_id,medicine_code,stock[,expiry_days]`.

## Architecture (production path)

```
Clinic OPD registers ──► Syndromic surveillance (EARS C2) ──► outbreak demand multipliers ─┐
                                                                                          ▼
PHC pharmacist ── SMS / WhatsApp / IVR / CSV ──► Validation ──► Stock & lot ledger ──► Cleaning ──► Forecast
                                                                                          │
                              Early warning ◄─────────────────────────────────────────────┤
                                    │                                                     │
                                    ▼                                                     ▼
                        Redistribution optimiser ◄── expiry simulation (FEFO) ◄── lot ledger
                                    │
                                    ▼
           Transfer orders · warehouse indents (VEN priority) · Gemini brief · SMS alerts

 National node (per country): local training ──► weights only ──► BRICS coordinator (FedAvg) ──► global model
```

Suggested Google Cloud stack: Cloud Run (API), Firestore or AlloyDB (stock and lot ledger), BigQuery (history), Vertex AI (forecast models and Gemini), Pub/Sub (SMS/WhatsApp/IVR webhooks), Flower or TensorFlow Federated for cross-border training. Integration targets: state drug-distribution systems (for example DVDMS / eAushadhi), IDSP/IHIP syndromic reporting, and the ABDM health facility registry.

## Data

All data in the prototype is **synthetic**, generated from fixed seeds. It includes 12 real Andhra Pradesh districts at approximate coordinates, 48 PHCs, 11 medicines from India's essential medicines list with approximate tender prices, shelf lives, VEN classes and realistic lead times. Deliberate messiness is injected (past stock-outs, entry errors, late reports, faulty fridges, near-expiry lots, a fever cluster on the north coast) to show how the system copes. No real patient or facility data is used.

## Designed as a Digital Public Good

Open source (MIT), no vendor lock-in, runs offline in a browser, multilingual, works with SMS for low-connectivity PHCs, and privacy-preserving by design through federated training.
