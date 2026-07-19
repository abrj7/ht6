# Yonder — Hack the 6ix 2026

AI-powered spending tracker that turns everyday spending into live, real, bookable
travel opportunity costs. Full spec: `docs/PRD.md`. Shared context: `CONTEXT.md`.

## The WTF moment: Yonder Exchange
We treat Stay22 accommodation inventory as a **securities exchange**:

- Every destination is a **ticker** (YBNF, YMTL...) whose price is the cheapest
  live nightly rate. Stay22 is snapshot-only, so we poll on their 10-min cache
  and build our own price time series — our market data is genuinely ours.
- The four suppliers (Booking, Vrbo, Expedia, Hotels.com) are **market makers**:
  the same room priced differently across them is a bid/ask spread, surfaced as
  live **arbitrage alerts** ("same room, $31 cheaper on Vrbo").
- Your cut spending (Chexy feed) is your **buying power**. The AI coach is the
  desk analyst. **BUY** is a real Stay22 affiliate link — every market order
  pays commission, so the demo is the business model.

One-liner for judges: *hotel inventory as a stock market where your bad habits
fund the deposits and every order pays Stay22 commission.*

## Team split (own your folder, don't touch others' — see PRD section 11-12)
- `/frontend` — Person A
- `/backend` — Person B (owns Stay22 integration)
- `/ai-service` — Person C (owns FreeSolo integration)
- `/chexy-integration` — Person D (owns Chexy integration + Deloitte sustainability logic)

## Env setup (do this first)
Each service has a `.env.example`. Copy it to `.env` in the same folder and fill
in your keys. **Everything runs without keys** — services fall back to mock/stub
mode so you can build immediately:

| Service | Key | Without it |
|---|---|---|
| `backend` | `STAY22_API_KEY` | Serves realistic mock Stay22 results |
| `ai-service` | `FREESOLO_API_KEY` (+ base URL/model in `.env.example`) | Stub coaching messages |
| `chexy-integration` | `CHEXY_API_KEY` (TBD) | Seeded mock transactions |
| `frontend` | none | — |

Never commit a real `.env` — they're gitignored.

## Quick start
```bash
# Terminal 1
cd backend && cp .env.example .env && npm install && npm run dev

# Terminal 2
cd frontend && cp .env.example .env && npm install && npm run dev

# Terminal 3
cd ai-service && cp .env.example .env && pip install -r requirements.txt && uvicorn main:app --reload --port 5001

# Terminal 4
cd chexy-integration && cp .env.example .env && npm install && npm run dev
```

Open http://localhost:3000 — the departure board should show live rows fed by
`backend → chexy-integration` spend data, mock Stay22 prices, and a stub coach
message. Each service also exposes `GET /health`.

## What's already wired (mock mode)
- `chexy-integration` `GET /spend-summary` → categorized mock transactions
- `backend` `GET /api/opportunity` → pulls spend summary, matches categories to
  destinations, prices them (mock Stay22 until a key is set, with the 10-min
  cache already enforced), calls `ai-service /coach` for the nudge
- `ai-service` `POST /coach` → FreeSolo-trained coaching when keyed, else stubs.
  Backend sends trusted facts (`recoverableMonthly`, `remaining`, `estimatedMonths`, …)
- `frontend` → polls the backend, renders the board, falls back to demo rows if
  the backend is down

Everyone builds against the API contracts in `docs/PRD.md` section 12. Real
integration happens by pointing at live endpoints, not by editing someone
else's folder.
