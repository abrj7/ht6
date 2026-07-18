# Project Context

**Hackathon:** Hack the 6ix 2026
**Tracks:** Stay22 (Peak Unhinged Use), Chexy (Make Every Payment Count), FreeSolo (Best Model Trained), Deloitte (Green AI / AI for Green)
**Deadline:** Draft submission 11:59pm Saturday, July 18

## What we're building
An AI-powered spending tracker that turns everyday spending into live, real, bookable travel opportunity costs (e.g. "$150/mo in food delivery = 2 nights in Banff, right now"). Full product spec: see `docs/PRD.md`.

## Why this isn't "just a budgeting app"
1. Rewards are live-priced via Stay22, not a static one-time comparison — progress updates as real prices move.
2. FreeSolo is fine-tuned to generate personalized coaching *tone and timing*, not to do the opportunity-cost math (that's a formula — don't over-claim what the model is for).
3. Chexy handles payment analysis/categorization using sandbox/synthetic data only — no real money movement, no real account linking.
4. Deloitte angle is about resource efficiency (demand-aware booking, lower-impact travel alternatives), not vague "spend less = green" messaging.

## Team split (4 workstreams — see PRD section 11-12 for full contracts)
- **Person A** — Frontend (`/frontend`) — React dashboard, consumes backend API only
- **Person B** — Backend + Stay22 (`/backend`) — orchestration API, only person calling Stay22 directly
- **Person C** — AI service / FreeSolo (`/ai-service`) — fine-tuning + coaching inference, exposes `/coach`
- **Person D** — Chexy integration (`/chexy-integration`) — spend data + Deloitte sustainability logic, exposes `/spend-summary`

**Golden rule to avoid merge conflicts:** everyone builds against the API contracts in PRD section 12 using mock data first. Nobody edits another person's folder. Integration happens by pointing at real endpoints once each service is live, not by touching each other's code.

## Confirmed API details

### Stay22 (`/backend` owns this)
- `GET /v2/accommodations` via `X-API-KEY` header
- Snapshot pricing only — **no historical data, no real occupancy field.** Don't build or pitch anything that assumes we have time-series data unless we're polling and storing it ourselves.
- Price cache is ~10 minutes on their end — don't poll faster than that.
- Useful params: `address` or `lat/lng/radius`, `checkin`/`checkout`, `min`/`max`, `type` (hotel, cabin, villa, hostel, all_inclusive, etc.), `minguestrating`
- Response gives `suppliers.{booking,vrbo,expedia,hotelscom}.price.total`, `location`, `rating`, `capacity`, `policies.instantBook/freeCancellation`

### Chexy (`/chexy-integration` owns this)
- **TBD — pull their actual docs before building.** Assume sandbox transaction data with category, amount, date, merchant. Real money movement is explicitly out of scope per their track rules.

### FreeSolo (`/ai-service` owns this)
- **TBD — pull their actual docs before building.** Assume: upload SFT training pairs → training job → inference endpoint. Infinite training credits during competition per their track description.

## Environment variables needed
```
STAY22_API_KEY=
CHEXY_API_KEY=        # TBD once docs confirmed
FREESOLO_API_KEY=     # TBD once docs confirmed
```
Each service owns its own `.env` — do not commit real keys, use `.env.example` files.

## Setup
See `README.md` in each service folder. Quick start:
```bash
# backend
cd backend && npm install && npm run dev

# frontend
cd frontend && npm install && npm run dev

# ai-service
cd ai-service && pip install -r requirements.txt

# chexy-integration
cd chexy-integration && npm install && npm run dev
```
