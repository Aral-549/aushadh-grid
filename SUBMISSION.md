# Submission checklist (Hack2skill form)

| Form field | What to enter |
| --- | --- |
| Challenges | **Track 3 — Smart Health & Supply Chain Resilience** |
| GitHub repository | `https://github.com/Aral-549/aushadh-grid` (public) |
| Demo video | Upload `docs/Aushadh-Grid-demo.webm` to YouTube (Unlisted) or Google Drive ("Anyone with the link"), paste the link |
| Presentation PDF | `docs/Aushadh-Grid-deck.pdf` |
| Working prototype link | `https://aral-549.github.io/aushadh-grid/` |
| Brief description | Copy the text below (967 characters, limit 1024) |

## Brief description

```
Aushadh Grid is a federated AI platform for PHC medicine supply chains. Syndromic OPD surveillance (CDC EARS C2) spots outbreaks days before declaration and switches forecasts to outbreak demand for the affected districts. Holt forecasting on cleaned history (stock-out days re-estimated, typos capped, stale reports adjusted) gives 14-day demand and stock-out probability for 528 medicine lines at 48 pilot PHCs. A first-expiry-first-out simulation finds lots that will expire unused. A cold-chain-aware optimiser then creates transfer orders that prevent stock-outs and rescue expiring stock; the rest become warehouse indents, vital medicines first. Pharmacists report by SMS/WhatsApp or CSV. A referral finder shows the nearest PHC with a free bed and a doctor. BRICS nodes train a shared model with FedAvg, sharing only weights; small-data nations cut error by ~30%. Gemini writes grounded briefs in any language. Open source, runs in a browser. Synthetic data.
```
