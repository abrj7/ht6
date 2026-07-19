# PRD — Yonder
Hack the 6ix 2026 — Base44 / Chexy / Stay22 / FreeSolo tracks

## 1. One-liner
An AI-powered spending tracker that translates everyday purchases into live, real travel opportunity costs — "your $150/month food delivery habit is 2 nights in Banff, right now, bookable today" — and coaches users toward the goal instead of guilting them about the spend.

## 2. Problem
Budgeting apps show where money went. They don't make the tradeoff *feel real*. "You spent $600 on delivery this quarter" is abstract. "You spent a weekend in Montreal" is not. Nobody has tied live, real-world priced rewards to spending behavior in real time.

## 3. Core user flow
1. User connects/imports spending data, tags categories they want to cut (food delivery, subscriptions, shopping, gaming, transport).
2. App computes a rolling "recoverable spend" per category.
3. App queries Stay22 live pricing to find real, bookable travel opportunities matching that recoverable spend (by amount + a stated preference: destination vibe, distance, dates).
4. FreeSolo-trained coaching layer generates a personalized nudge — tone, framing, and cadence tailored to the user's own spending psychology (not generic "you should save more").
5. As Stay22 prices move (10-min cache, so poll-driven), the user's progress toward the goal moves too — "prices dropped, you're $40 closer than yesterday."
6. Chexy handles the underlying payment/transaction analysis, categorization, and reconciliation so the spend numbers feeding the engine are accurate.
7. User can book directly via Stay22 affiliate link when goal is hit.

## 4. Why this isn't a generic budgeting app
- Rewards are **live and real**, not a static conversion ("2 nights in Banff" recalculates as prices move — real urgency mechanic, not a one-time stat).
- FreeSolo's job is **behavioral coaching tone/timing**, not arithmetic. The opportunity-cost math is a formula; the fine-tune target is *when and how to say something so it actually motivates this specific user* — that's the defensible post-training use case for the FreeSolo track.
- Reward surface isn't limited to hotels — Stay22's `type` param covers cabins, villas, hostels, all-inclusive, etc., so rewards can match a user's actual travel style, not just "hotel."

## 5. Sponsor track mapping
| Track | How we hit it |
|---|---|
| **Stay22** | Live accommodation pricing, geo-diverse property search, affiliate booking links, price-as-live-progress mechanic |
| **Chexy** | Payment analysis, spend categorization, budgeting/reconciliation workflow (sandbox/synthetic data only — no real money movement) |
| **FreeSolo** | Custom-trained coaching model — personalized nudge generation based on spending pattern + motivational style, not generic LLM chat |
| **Deloitte (Green AI/AI for Green)** | Travel-alternative comparison includes carbon-conscious framing (e.g., surfacing lower-impact / closer / off-peak options), and demand-aware booking reduces overbuilding/empty inventory waste — real resource-efficiency angle, not just "spend less" |

## 6. MVP scope (must-have for demo, in priority order)
1. Manual/mock spend input by category (skip real bank linking — use Chexy sandbox/synthetic data)
2. Opportunity cost engine: category spend → Stay22 query → live matching options
3. One working live "goal card" that updates as prices move (poll on a timer respecting the 10-min cache)
4. FreeSolo-generated coaching message on the dashboard (at least one real fine-tuned inference call in the demo path — do not fall back silently to a generic model)
5. Book-now affiliate link out to Stay22

## 7. Stretch (only if time remains)
- Social/comparative anonymized insight ("others saving toward Montreal are cutting X")
- Full Chexy reconciliation view
- Multi-goal tracking
- Deloitte carbon-comparison module (train vs flight, off-peak vs peak)

## 8. Non-goals (explicitly out of scope for the hackathon)
- Real bank/card linking or real money movement (sandbox/synthetic data only, per Chexy track rules)
- Historical price time-series / true occupancy data (Stay22 API is snapshot-only; do not claim otherwise in the pitch)
- Multi-language support
- Native mobile app

## 9. Data & API notes (confirmed)
- **Stay22**: `GET /v2/accommodations` — snapshot pricing only, no historical/occupancy data. Cache is ~10 min on their end — do not poll faster than that. Key fields: `results[].suppliers.*.price.total`, `location`, `rating`, `capacity`, `policies.instantBook/freeCancellation`, `type`. Auth via `X-API-KEY` header.
- **Chexy**: exact endpoint schema TBD — confirm from their docs before backend work starts. Assume: transaction list w/ category, amount, date, merchant; sandbox mode required (no real account linking).
- **FreeSolo**: exact fine-tuning/inference API TBD — confirm from their docs before AI workstream starts. Assume: upload training pairs → SFT job → inference endpoint returning generated text given a structured prompt (spend pattern + goal + tone parameters).

## 10. Architecture (high level)
```
[Frontend/React]
   |
   v
[Backend API (Node/Express or FastAPI)] --- orchestrates ---> [Stay22 client]
   |                                    \--- calls ---------> [FreeSolo inference]
   v                                     \--- calls --------> [Chexy sandbox API]
[Mock/seeded spend data store]
```

## 11. Team split — 4 workstreams (designed to avoid merge conflicts)

### Person A — Frontend / Dashboard (`/frontend`)
Owns all UI. Consumes a backend API contract (defined in section 12) — does NOT touch backend code.
- Spend category input/tagging UI
- "Goal card" showing live opportunity cost, updating on poll
- Coaching message display (renders FreeSolo output)
- Book-now CTA → Stay22 affiliate link
- Tech: React + Tailwind, polling hook against backend `/api/opportunity` endpoint

### Person B — Backend API + Stay22 integration (`/backend`)
Owns the core orchestration API and is the only person touching Stay22 calls directly.
- `/api/opportunity` endpoint: takes category + recoverable spend + user prefs → queries Stay22 → returns matched properties
- Rate-limit-safe polling logic respecting the 10-min cache
- Opportunity-cost calculation logic (spend → nights/experiences)
- Tech: Node/Express or FastAPI, owns `.env` for `STAY22_API_KEY`

### Person C — FreeSolo coaching layer (`/ai-service`)
Owns the fine-tuning dataset, training job, and inference wrapper. Exposes ONE clean internal endpoint (`/coach`) so Backend never touches FreeSolo directly.
- Build synthetic training pairs: {spend pattern + goal + motivational style} → {coaching message}
- Run SFT job on FreeSolo
- Wrap inference behind a simple internal API: `POST /coach {spend_summary, goal, tone} → {message}`
- Own the "why fine-tuning, not prompting" justification doc for judges

### Person D — Chexy integration + Deloitte sustainability layer (`/chexy-integration`)
Owns spend data ingestion/categorization and the sustainability comparison logic.
- Chexy sandbox integration: seed/synthetic transaction data → categorized spend summary
- Exposes internal endpoint: `GET /spend-summary` → categorized, ready-to-use spend data for Backend
- Deloitte angle: carbon/impact comparison logic for travel alternatives (stretch)
- Owns pitch material tying Chexy + Deloitte requirements to the build

## 12. API contracts (lock these first — this is what prevents merge conflicts)

**Backend exposes to Frontend:**
```
GET /api/opportunity?category=food_delivery&amount=150&type=optional(hotel|cabin|villa|hostel)
→ {
  properties: [...enriched Stay22 results with cheapestTotal, destination, bookUrl],
  goalProgress: number 0-1,
  lastUpdated: ISOtimestamp,
  coachMessage: string,
  meta: { stay22Mode: "live"|"mock" },
  routes: [{
    category, destination, monthlyTotal, recoverableSpend, livePrice, progress,
    bookUrl, priceDelta,           // number|null, negative = price dropped
    priceHistory: [{ t, price }],  // oldest→newest
    property: { name, type, rating, capacity, freeCancellation, instantBook },  // best-value property
    green: { distanceKm, carbonKgCO2e, greenerAlternative }  // greenerAlternative may be null
  }]
}
```

```
GET /api/market   — the exchange feed (Stay22 track headline: destinations as tickers)
→ {
  asOf: ISOtimestamp,
  mode: "live"|"mock",
  buyingPower: number,           // chexy summary.totalRecoverable, 0 if chexy is down
  tickers: [{
    symbol,                      // e.g. "YBNF" for Banff — stable short code per destination
    destination,                 // "Banff, AB"
    last,                        // cheapest nightly total across all properties + suppliers
    changeAbs, changePct,        // vs previous history point (null if no prior point)
    history: [{ t, price }],     // oldest→newest, same per-destination series as /api/opportunity
    dayRange: { low, high },     // min/max of history
    book: [{ supplier, price }], // order book: best quote per supplier for the cheapest property, ascending
    spread: { bestSupplier, bestPrice, worstSupplier, worstPrice, spreadAbs, spreadPct },  // null if <2 suppliers
    arb: boolean,                // true when spreadPct >= 15 (arbitrage flag)
    affordable: boolean,         // buyingPower >= last
    property: { name, type, rating },  // the property behind the quote
    buyUrl                       // Stay22 affiliate booking link
  }],
  movers: { up: symbol|null, down: symbol|null },  // biggest changePct each way
  tape: [string]                 // 5-8 ticker-tape lines generated from live quote data
}
Ticker symbols: YBNF (Banff), YMTL (Montreal), YTOF (Tofino), YPEC (Prince Edward County),
YBLU (Blue Mountain), YNTL (Niagara-on-the-Lake).
```

**AI-service exposes to Backend:**
```
POST /coach
Body: { spendSummary: {...}, goalAmount: number, tone: string }
→ { message: string }
```

**Chexy-integration exposes to Backend:**
```
GET /spend-summary?userId=demo
→ { categories: [{ name, monthlyTotal, transactions: [...] }] }
```

Everyone builds against these contracts with mock data FIRST, integrates for real once each service is up. This is the key to zero merge conflicts — nobody needs to touch another person's folder.

## 13. Demo script (3 min)
1. Show categorized spend (Chexy sandbox data) — "here's $150/month in food delivery"
2. Show live opportunity cost on the departure board — real Stay22-priced options, right now
3. Show FreeSolo coaching message — personalized, not generic
4. **Flip to the Exchange** — "and here's the unhinged part: this is a stock market built on hotel inventory." Tickers, live charts from our self-built price series, supplier bid/ask spreads, an ARB alert firing
5. Point at buying power — "the deposits are funded by the spending you cut"
6. Click BUY → Stay22 affiliate link — "every market order pays commission; the demo *is* the business model"
7. Close on the "why fine-tuning" and "why this isn't a normal budgeting app" points from section 4

### Stay22 track one-liner
Hotel inventory as a securities exchange: destinations are tickers, suppliers
are market makers, your bad habits fund the deposits, and every order pays
Stay22 commission. Snapshot-only API? We built our own market data by polling
the 10-min cache and storing the series ourselves.
