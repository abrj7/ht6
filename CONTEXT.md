# Yonder Project Context

Last updated: July 18, 2026  
Hackathon: Hack the 6ix 2026  
Submission deadline: July 18, 2026 at 11:59 PM ET

## Purpose of this file

This file is the fast onboarding guide for developers and coding agents working in the repository.

Use it to answer:

- What are we building right now?
- How is the repo organized?
- What decisions are already locked?
- What can each teammate edit?
- What is confirmed, assumed, or still unknown?
- What should be built next?

For full product requirements, user flows, acceptance criteria, sponsor strategy, and edge cases, read [`docs/PRD.md`](docs/PRD.md).

## Product summary

Yonder is an AI-powered savings planner that turns everyday spending into live travel opportunity costs.

Instead of only saying, "You spent $150 on delivery," Yonder shows what that money could fund right now, such as a hostel weekend in Montréal, a cabin stay near Toronto, or part of a Banff hotel booking.

The application combines:

1. Synthetic transaction data and payment analysis
2. Deterministic opportunity-cost calculations
3. Live accommodation results from Stay22
4. A FreeSolo-trained conversational savings model
5. A clear path from spending insight to a bookable goal

The product should motivate users without shaming them. It should never present AI-generated advice as guaranteed financial guidance.

## Current product focus

The hackathon MVP focuses on travel goals because Stay22 gives us live, bookable accommodation data.

The product can eventually support concerts, laptops, debt repayment, and other goals, but those are future extensions. Do not dilute the demo by trying to build every goal type this weekend.

### MVP story

A user imports or views synthetic transactions, chooses a spending category they are willing to reduce, selects a destination and travel dates, and receives:

- A categorized spending summary
- Live Stay22 accommodation options
- A calculation showing how their spending maps to those options
- A personalized FreeSolo coaching conversation
- A progress card
- A booking link

## Source of truth

Use the following priority when documents disagree:

1. `docs/PRD.md`
2. Locked API contracts in this file
3. Current service README files
4. Existing implementation
5. Old chat messages or planning notes

Do not silently change a locked contract. Update the PRD and notify the team first.

## Repo structure

```text
ht6/
├── README.md
├── CONTEXT.md
├── docs/
│   └── PRD.md
├── ai-service/
│   ├── .env.example
│   ├── main.py
│   ├── requirements.txt
│   └── training_data_notes.md
├── backend/
│   ├── .env.example
│   ├── index.js
│   ├── mockStay22.js
│   ├── stay22Client.js
│   ├── package.json
│   └── package-lock.json
├── chexy-integration/
│   ├── .env.example
│   ├── index.js
│   ├── data/
│   │   └── mockTransactions.json
│   ├── package.json
│   └── package-lock.json
└── frontend/
    ├── .env.example
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── package-lock.json
    └── src/
        ├── App.jsx
        ├── index.css
        └── main.jsx
```

## Important sponsor reality checks

### Stay22

Confirmed from the accommodation search documentation:

- Endpoint: `GET /v2/accommodations`
- Authentication: `X-API-KEY`
- Supports destination, coordinates, radius, dates, guests, rooms, property type, price range, currency, rating, and supplier filters
- Returns property identity, booking URLs, supplier prices, ratings, capacity, location, policies, and media
- Pricing is a current search result, not a historical price series
- Standard documented API limit is 150 requests per minute per API key
- Demo mode is limited to 5 requests per minute per IP

App-side caching is still required to avoid unnecessary calls. A 10-minute TTL is a reasonable MVP default, but treat it as a project decision unless Stay22 confirms a different cache policy during the hackathon.

### FreeSolo

Confirmed from the current Flash documentation:

- FreeSolo trains LoRA adapters on supported base models using managed infrastructure
- SFT learns from `input` and `output` training pairs
- Dataset rows may also include `metadata`
- SFT targets can contain full message transcripts for multi-turn behavior
- A trained adapter can be deployed behind an OpenAI-compatible endpoint
- FreeSolo supports SFT, GRPO, and OPD
- Our MVP uses SFT first
- FreeSolo should learn coaching behavior, conversational flow, and personalization
- FreeSolo should not be responsible for exact arithmetic

### Chexy track

The hackathon track does not require a proprietary Chexy API integration. It requires a meaningful end-to-end payment workflow using sandbox or synthetic data.

For the MVP, `chexy-integration/` is a Chexy-aligned payment analysis service, not a claim that we are calling a private Chexy API.

Do not claim:

- Real bank linking
- Real payment processing
- Access to private Chexy systems
- Movement of real money

### Base44

The current repository is React, Node, and Python. That alone does not satisfy the Base44 track.

Only include Base44 in the final submission if the team adds a meaningful Base44-built product or workflow and can demonstrate it. Otherwise, remove Base44 from the track list.

### Deloitte

Avoid vague claims such as "spending less is automatically sustainable."

A credible Deloitte feature should compare measurable alternatives, such as:

- A closer destination versus a farther destination
- Rail or bus versus flying, where data is available
- Off-peak versus peak travel dates
- Lower-cost local accommodation options
- Reduced unnecessary consumption connected to a stated goal

All environmental estimates must be labeled as estimates with visible assumptions.

## Locked architecture

```text
[React Frontend]
       |
       v
[Node Backend Orchestrator]
   |          |             |
   v          v             v
[Stay22] [AI Service] [Payment Analysis Service]
          [FreeSolo]   [Synthetic Chexy-aligned data]
```

### Service responsibilities

#### `frontend/`

Owns presentation and user interaction.

Responsibilities:

- Onboarding and goal setup
- Transaction category selection
- Opportunity cards
- Progress display
- Multi-turn coaching interface
- Error, loading, and empty states
- Booking link CTA

Must not:

- Store sponsor API keys
- Call Stay22 or FreeSolo directly
- Recalculate financial values independently from the backend

#### `backend/`

Owns orchestration and deterministic business logic.

Responsibilities:

- Validate frontend requests
- Fetch spend summaries
- Query Stay22
- Normalize supplier results
- Calculate goal gaps, recoverable spend, months to goal, and opportunity costs
- Call the AI service with already-calculated facts
- Return one stable response to the frontend
- Cache Stay22 searches
- Handle fallbacks and partial failures

The backend is the source of truth for numbers.

#### `ai-service/`

Owns the FreeSolo dataset, evaluation, training, deployment, and inference wrapper.

Responsibilities:

- Generate synthetic user scenarios
- Build SFT training and evaluation splits
- Generate target conversations
- Use deterministic checks for numeric consistency
- Use an LLM judge for tone, relevance, safety, and realism
- Train and deploy a FreeSolo adapter
- Expose a simple `/coach` API
- Preserve conversation history supplied by the backend
- Return structured output

The AI service explains and personalizes. It does not invent prices or perform trusted calculations.

#### `chexy-integration/`

Owns the payment workflow using synthetic data.

Responsibilities:

- Load synthetic transactions
- Validate and categorize transactions
- Produce category totals
- Track included and excluded transactions
- Reconcile totals back to source transactions
- Expose a stable spend summary
- Demonstrate payment-specific error handling

The folder name can remain for the hackathon, but documentation must clearly state that this is a Chexy-aligned workflow unless an actual sponsor integration is later added.

## Locked data flow

1. Frontend requests the demo user's spend summary.
2. Payment service returns categorized synthetic transactions with reconciliation totals.
3. User chooses a category, destination, dates, and savings intensity.
4. Backend calculates recoverable monthly spend.
5. Backend queries Stay22 for current accommodation options.
6. Backend selects and normalizes options within or near the user's target.
7. Backend calculates exact opportunity-cost facts.
8. Backend sends facts, preferences, and conversation history to the AI service.
9. FreeSolo returns a personalized coaching response.
10. Backend returns the combined result to the frontend.
11. User can adjust the plan through a multi-turn conversation.
12. User can open the Stay22 booking link.

## Locked API contracts

These contracts are the integration boundary. Mocks must follow the same shapes as live services.

### Payment service to backend

```http
GET /spend-summary?userId=demo
```

Response:

```json
{
  "userId": "demo",
  "currency": "CAD",
  "period": {
    "start": "2026-06-01",
    "end": "2026-06-30"
  },
  "categories": [
    {
      "id": "food_delivery",
      "label": "Food delivery",
      "monthlyTotal": 286.42,
      "transactionCount": 9,
      "transactions": [
        {
          "id": "txn_001",
          "merchant": "Example Eats",
          "amount": 31.50,
          "date": "2026-06-03",
          "category": "food_delivery",
          "status": "reconciled"
        }
      ]
    }
  ],
  "reconciliation": {
    "sourceTotal": 742.10,
    "categorizedTotal": 742.10,
    "difference": 0
  }
}
```

### Frontend to backend

Recommended MVP contract:

```http
POST /api/opportunity
Content-Type: application/json
```

Request:

```json
{
  "userId": "demo",
  "categoryId": "food_delivery",
  "savingsRate": 0.4,
  "travel": {
    "destination": "Montreal, Canada",
    "checkin": "2026-09-18",
    "checkout": "2026-09-20",
    "adults": 2,
    "rooms": 1,
    "currency": "CAD",
    "propertyTypes": ["hotel", "hostel"]
  },
  "preferences": {
    "minimumGuestRating": 7.5,
    "freeCancellationPreferred": true,
    "coachingStyle": "encouraging"
  }
}
```

Response:

```json
{
  "requestId": "opp_demo_001",
  "generatedAt": "2026-07-18T22:00:00Z",
  "spending": {
    "categoryId": "food_delivery",
    "monthlyTotal": 286.42,
    "savingsRate": 0.4,
    "recoverableMonthly": 114.57
  },
  "goal": {
    "destination": "Montreal, Canada",
    "targetPropertyId": "stay_123",
    "targetCost": 421.00,
    "currentSaved": 75.00,
    "remaining": 346.00,
    "estimatedMonths": 4
  },
  "properties": [
    {
      "id": "stay_123",
      "name": "Example Hotel",
      "type": "hotel",
      "totalPrice": 421.00,
      "currency": "CAD",
      "rating": 8.2,
      "ratingCount": 840,
      "freeCancellation": true,
      "thumbnailUrl": "https://example.com/image.jpg",
      "bookingUrl": "https://example.com/book"
    }
  ],
  "coach": {
    "message": "Reducing delivery by about $115 a month would cover the remaining cost in roughly four months.",
    "followUpQuestion": "Would you rather make the plan easier over five months or keep the four-month target?",
    "suggestedActions": [
      "Replace one delivery order each week",
      "Move $29 into the goal after each skipped order"
    ],
    "disclaimer": "This is a planning estimate, not professional financial advice."
  },
  "cache": {
    "stay22CacheHit": false,
    "expiresAt": "2026-07-18T22:10:00Z"
  }
}
```

### Backend to AI service

```http
POST /coach
Content-Type: application/json
```

Request:

```json
{
  "sessionId": "session_demo_001",
  "facts": {
    "currency": "CAD",
    "monthlyCategorySpend": 286.42,
    "recoverableMonthly": 114.57,
    "goalCost": 421.00,
    "currentSaved": 75.00,
    "remaining": 346.00,
    "estimatedMonths": 4
  },
  "goal": {
    "type": "travel",
    "destination": "Montreal, Canada",
    "checkin": "2026-09-18",
    "checkout": "2026-09-20",
    "propertyName": "Example Hotel"
  },
  "preferences": {
    "tone": "encouraging",
    "strictness": "balanced",
    "avoidCategories": []
  },
  "conversation": [
    {
      "role": "user",
      "content": "I do not want to completely stop ordering food."
    }
  ]
}
```

Response:

```json
{
  "message": "You do not need to stop completely. Replacing one delivery order each week would get you close to the target while still leaving room for it.",
  "followUpQuestion": "Would you prefer a smaller weekly transfer or a longer timeline?",
  "suggestedActions": [
    {
      "label": "Skip one delivery order weekly",
      "estimatedMonthlyImpact": 114.57
    }
  ],
  "usedFactKeys": [
    "recoverableMonthly",
    "remaining",
    "estimatedMonths"
  ],
  "riskFlags": []
}
```

## FreeSolo implementation plan

### Model responsibility

The model should:

- Ask useful follow-up questions
- Adapt tone to the user
- Explain exact facts supplied by the backend
- Suggest realistic behavior changes
- Respect categories the user does not want to cut
- Remember the current conversation
- Avoid guilt, shame, or guaranteed outcomes
- Admit when the supplied plan is not feasible

The model should not:

- Invent transactions
- Invent Stay22 prices
- Perform trusted arithmetic
- Recommend debt, credit, or risky financial products
- Claim professional financial authority
- Promise that a user will reach a goal

### Training approach

MVP algorithm: supervised fine-tuning.

Training records should use FreeSolo's expected top-level fields:

```json
{
  "input": "Rendered user scenario and opening prompt",
  "output": {
    "messages": [
      {
        "role": "assistant",
        "content": "First coaching response"
      },
      {
        "role": "user",
        "content": "User follow-up"
      },
      {
        "role": "assistant",
        "content": "Adjusted coaching response"
      }
    ]
  },
  "metadata": {
    "scenarioId": "scenario_001",
    "tone": "encouraging",
    "difficulty": "medium",
    "edgeCase": false
  }
}
```

### Dataset generation pipeline

```text
Synthetic user profile generator
        |
        v
Deterministic financial calculator
        |
        v
Teacher LLM creates ideal conversation
        |
        v
Programmatic numeric and schema checks
        |
        v
LLM judge scores tone, relevance, realism, and grounding
        |
        v
Small human spot-check
        |
        v
Train, validation, and held-out test splits
```

Suggested dataset target:

- 150 to 300 training examples
- 25 to 50 validation examples
- 25 to 50 held-out test examples
- At least 30 percent multi-turn examples
- At least 20 percent edge cases

Edge cases should include:

- Goal impossible within requested timeline
- Very little discretionary spending
- User refuses to cut the largest category
- No Stay22 results in budget
- Price is missing or stale
- User changes destination
- User changes dates
- User asks for a less strict plan
- User has inconsistent preferences
- Negative or malformed transaction amount
- Category total does not reconcile

### Evaluation

Compare the base model and fine-tuned model on the same held-out prompts.

Measure:

- Grounded fact usage
- Calculation consistency with backend facts
- Feasibility of suggested actions
- Personalization
- Tone match
- Multi-turn consistency
- JSON or schema validity
- Hallucination rate
- Safety and disclaimer compliance

Do not claim the fine-tune improved the product unless the held-out evaluation shows it.

## Error handling rules

### Stay22 unavailable

- Return cached results if available
- Label them with the retrieval time
- If no cache exists, show a clear unavailable state
- Do not invent properties or prices
- Coaching may continue using a general savings target only if the UI labels it as not live-priced

### FreeSolo unavailable

- Preserve the deterministic opportunity-cost result
- Show a simple template message generated by backend code
- Clearly label the demo if the real fine-tuned call did not run
- Never silently claim a fallback response came from FreeSolo

### Payment data invalid

- Reject malformed transactions
- Show reconciliation difference
- Exclude unresolved transactions from trusted totals
- Never hide mismatches

### No affordable property found

- Show the closest options above budget
- Suggest date, destination, property type, or timeline changes
- Do not claim the user can afford a result that exceeds the calculated budget

## Privacy and security

- Use only synthetic or sandbox payment data
- Keep API keys server-side
- Never commit `.env` files
- Avoid logging complete user spending profiles
- Use request IDs rather than personal names in logs
- Validate all request fields
- Restrict CORS in deployed environments
- Escape model output before rendering
- Add timeouts to external calls
- Add basic rate limiting to public endpoints
- Treat all model output as untrusted text

## Team ownership

### Person A: Frontend

Edits only:

- `frontend/`

Deliverables:

- Goal setup flow
- Spend category view
- Opportunity card
- Coaching chat
- Loading, empty, and error states
- Book-now flow

### Person B: Backend and Stay22

Edits only:

- `backend/`

Deliverables:

- Orchestration API
- Stay22 client
- Cache
- Normalization
- Deterministic calculations
- Fallbacks

### Person C: FreeSolo

Edits only:

- `ai-service/`

Deliverables:

- Dataset generator
- Judge pipeline
- Train, validation, and test files
- Training configuration
- Evaluation report
- Deployed inference wrapper
- Multi-turn chat support

### Person D: Payment workflow and sustainability

Edits only:

- `chexy-integration/`

Deliverables:

- Synthetic transaction dataset
- Categorization and reconciliation
- Spend summary endpoint
- Payment-specific error cases
- Sustainability comparison module if time permits
- Sponsor explanation for Chexy and Deloitte

## Integration rule

Nobody edits another person's folder without agreement.

Integration should happen through HTTP contracts and environment variables, not by copying code across services.

Use mocks first. Replace a mock with a live dependency only after the contract is stable.

## Environment variables

### Backend

```env
PORT=3001
STAY22_API_KEY=
STAY22_BASE_URL=
STAY22_CACHE_TTL_SECONDS=600
AI_SERVICE_URL=http://localhost:8000
PAYMENT_SERVICE_URL=http://localhost:3002
```

### AI service

```env
PORT=8000
FREESOLO_API_KEY=
FREESOLO_BASE_URL=
FREESOLO_MODEL=
LLM_JUDGE_API_KEY=
LLM_JUDGE_MODEL=
```

### Payment service

```env
PORT=3002
TRANSACTION_DATA_PATH=./data/mockTransactions.json
```

### Frontend

```env
VITE_BACKEND_URL=http://localhost:3001
```

## Local development

```bash
# payment service
cd chexy-integration
npm install
npm run dev

# AI service
cd ai-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py

# backend
cd backend
npm install
npm run dev

# frontend
cd frontend
npm install
npm run dev
```

Verify actual script names in each `package.json` before relying on these commands.

## Definition of done for the demo

The MVP is demo-ready only when all of the following are true:

- Synthetic transactions load and reconcile
- User can choose a spending category
- Backend returns at least one real Stay22 result
- Opportunity-cost calculations are deterministic and visible
- At least one request uses the deployed FreeSolo fine-tuned model
- The user can complete at least two coaching turns
- The model does not invent prices
- A booking CTA opens a Stay22 link
- External-service failures produce clear UI states
- The team can explain why fine-tuning was needed
- The team can show a base-model versus fine-tuned comparison
- No real financial credentials or money are used

## Immediate priorities

1. Confirm all API keys and workshop deployment instructions.
2. Lock the API contracts.
3. Make all four services run with mocks.
4. Complete the Stay22 live call.
5. Generate and score the first FreeSolo dataset.
6. Train a small SFT run early.
7. Build the multi-turn coaching UI.
8. Integrate the end-to-end demo.
9. Record evidence for each sponsor requirement.
10. Polish only after the full flow works.
