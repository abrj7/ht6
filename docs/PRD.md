# Product Requirements Document: Yonder

Version: 2.0  
Status: Hackathon MVP  
Hackathon: Hack the 6ix 2026  
Last updated: July 18, 2026

## 1. Product overview

### One-liner

Yonder is an AI-powered savings planner that translates everyday spending into live, bookable travel opportunity costs and helps users build a realistic plan toward the experience they care about.

### Example

Instead of only showing:

> You spent $286 on food delivery this month.

Yonder shows:

> That spending is about 68 percent of a two-night Montréal stay available right now. Reducing delivery by roughly $115 a month could cover the remaining cost in four months.

The user can then talk to a personalized savings model, adjust the plan, and open a live booking option.

## 2. Document purpose

This PRD defines:

- The product problem and intended user
- The MVP user experience
- Functional and non-functional requirements
- AI training and evaluation requirements
- Sponsor track alignment
- Service boundaries and API contracts
- Privacy, reliability, and failure handling
- Demo acceptance criteria
- Out-of-scope work

This document describes what the team is building and why. Day-to-day setup and repository guidance belong in `CONTEXT.md`.

## 3. Product thesis

Traditional budgeting tools make spending visible, but visibility alone often does not change behavior.

A number such as "$600 spent on delivery" is abstract. A specific, currently bookable experience such as "a weekend in Montréal" is emotionally understandable.

Yonder's thesis is:

> People are more motivated to change discretionary spending when the tradeoff is connected to a concrete goal they personally value.

The product therefore combines live travel pricing, trusted calculations, and personalized conversation.

## 4. Problem statement

Users who want to save often face four problems:

1. Their budgeting app reports past spending without making the tradeoff meaningful.
2. Generic advice such as "spend less on takeout" does not reflect their priorities or constraints.
3. Savings goals feel distant because progress is not connected to current real-world prices.
4. Financial tools often use guilt or rigid restrictions, causing users to disengage.

Yonder should make the opportunity visible, make the plan realistic, and keep the user in control.

## 5. Target users

### Primary persona: Goal-driven student or young professional

Characteristics:

- Has limited disposable income
- Regularly spends on delivery, shopping, subscriptions, gaming, or transportation
- Wants a meaningful goal such as a trip
- Does not consistently use a traditional budgeting app
- Responds better to concrete rewards than abstract charts
- Wants flexibility rather than strict financial rules

### Secondary persona: Casual budgeter

Characteristics:

- Already tracks spending occasionally
- Wants help deciding what to reduce
- Prefers a lightweight plan rather than full financial management
- Values progress tracking and personalized reminders

### Not the target user

The MVP is not intended for:

- Professional investment management
- Credit decisions
- Tax advice
- Emergency debt counselling
- Real-money transfers
- Users requiring regulated financial planning

## 6. User needs

A user needs to be able to:

- Understand where their discretionary money is going
- Choose which categories they are willing to change
- See what that spending could fund
- Use current pricing rather than static examples
- Set a realistic savings rate
- Change the plan without restarting
- Receive advice in a tone that works for them
- Understand when a goal is not feasible
- Reach a real booking option when ready

## 7. Product goals

### MVP goals

1. Make one spending tradeoff feel concrete using live Stay22 accommodation prices.
2. Demonstrate an end-to-end payment analysis and reconciliation workflow using synthetic data.
3. Demonstrate a real FreeSolo fine-tuned model call in the main demo path.
4. Provide a useful multi-turn coaching interaction.
5. Keep all trusted calculations outside the LLM.
6. Clearly handle missing, invalid, or unavailable data.
7. Produce a polished three-minute demo.

### Success criteria

The MVP succeeds when a demo user can:

- View reconciled transactions
- Select a discretionary category
- Choose a destination and dates
- Receive real accommodation results
- See a mathematically correct opportunity-cost comparison
- Talk to the coaching model for at least two turns
- Adjust the goal or savings plan
- Open a Stay22 booking link

## 8. Non-goals

The hackathon MVP will not include:

- Real bank or card connections
- Real Chexy account access
- Real money movement
- Investment recommendations
- Credit recommendations
- Full debt-management planning
- Historical accommodation price prediction
- Occupancy forecasting
- Native mobile applications
- Multi-language support
- Production-grade identity verification
- Automated purchase execution
- Guaranteed environmental claims
- Every possible life-goal category

Concerts, laptops, debt repayment, and other goals remain part of the product vision, but the demo should focus on travel.

## 9. Core user journey

### Step 1: Enter the experience

The user sees a clear statement:

> Turn spending you barely remember into something you will.

The app loads a synthetic demo profile or lets the user select a sample profile.

### Step 2: Review spending

The user sees categorized monthly spending with source transactions.

Example categories:

- Food delivery
- Subscriptions
- Shopping
- Gaming
- Rideshare
- Entertainment

The app must show that category totals reconcile to the underlying transaction data.

### Step 3: Choose what is flexible

The user selects a category and chooses a reduction level:

- Light
- Balanced
- Aggressive
- Custom percentage

The app must never assume that the user wants to cut their largest category.

### Step 4: Choose a travel goal

The user enters:

- Destination
- Check-in date
- Check-out date
- Number of guests
- Property preferences
- Minimum rating
- Currency

### Step 5: Fetch live opportunities

The backend requests Stay22 results and normalizes prices across available suppliers.

The user sees a small number of relevant properties, not a generic hotel-search carousel.

Each card should answer:

- What is the property?
- How much does it cost in total?
- How much of it does the selected spending represent?
- How long would the savings plan take?
- Why is this option relevant?

### Step 6: Build a plan

The backend calculates:

- Monthly category spend
- Recoverable monthly amount
- Goal price
- Current savings
- Remaining amount
- Estimated number of months
- Percentage of goal funded
- Suggested transfer amount

### Step 7: Talk to the FreeSolo model

The model explains the plan and asks a useful follow-up question.

Example:

> Cutting delivery completely is not necessary. Replacing one order each week would free about $115 per month. Would you rather keep the four-month goal or make the plan easier over five months?

The user can respond and the model adapts without losing the supplied facts.

### Step 8: Take action

The user can:

- Accept the plan
- Change the reduction rate
- Change destination or dates
- Choose another property
- Continue the conversation
- Open the booking link

## 10. Functional requirements

### FR-1: Synthetic transaction ingestion

The payment service must load a synthetic transaction dataset.

Each transaction must include:

- Unique ID
- Date
- Merchant
- Amount
- Currency
- Category
- Status

The service must reject malformed records and identify unresolved records.

### FR-2: Categorization

The service must group transactions by category and calculate:

- Monthly total
- Transaction count
- Average transaction size
- Included transaction IDs

The MVP may use pre-labelled categories, rules, or a lightweight classifier. It does not need to solve production-grade merchant categorization.

### FR-3: Reconciliation

The service must compare:

- Sum of source transactions
- Sum of categorized transactions
- Difference

Acceptance condition:

- A fully valid demo dataset has a difference of zero.
- An error scenario visibly shows a non-zero difference and prevents the app from presenting the total as trusted.

### FR-4: Spending category selection

The user must be able to select one category to use for the opportunity-cost calculation.

The app must display:

- Current monthly spend
- Selected reduction rate
- Recoverable monthly amount

### FR-5: Goal setup

The user must be able to provide:

- Destination
- Dates
- Guest count
- Room count
- Currency
- Optional property types
- Optional minimum guest rating
- Optional free-cancellation preference

Validation must prevent invalid date order, missing destination, non-positive guest counts, and unsupported currency values.

### FR-6: Stay22 search

The backend must call the Stay22 accommodations endpoint using server-side credentials.

The search should support:

- Destination or coordinates
- Dates
- Guests and rooms
- Property type
- Currency
- Price bounds when appropriate
- Minimum guest rating

The backend must normalize supplier-specific results into one internal format.

### FR-7: Property ranking

Yonder should rank results based on product relevance, not only the lowest price.

Suggested ranking factors:

- Total price near the user's reachable range
- Guest rating
- Review count
- Free cancellation
- Property type preference
- Distance from requested location
- Availability of a valid booking link

The ranking formula should be deterministic and documented.

### FR-8: Opportunity-cost calculation

All trusted calculations must be performed in backend code.

Suggested formulas:

```text
recoverableMonthly = monthlyCategorySpend × savingsRate

remainingGoal = max(goalCost - currentSaved, 0)

estimatedMonths = ceil(remainingGoal / recoverableMonthly)

goalProgress = min(currentSaved / goalCost, 1)

spendEquivalent = monthlyCategorySpend / goalCost
```

The backend must handle zero or negative values safely.

### FR-9: Goal card

The frontend must show:

- Selected property
- Total current price
- Monthly spending category
- Recoverable monthly amount
- Percentage funded
- Estimated time to goal
- Last updated time
- Booking CTA

### FR-10: FreeSolo coaching

The AI service must receive only structured facts already calculated by trusted code.

The model must:

- Explain the plan
- Personalize tone
- Suggest one or two realistic actions
- Ask a relevant follow-up question
- Avoid shame
- Avoid guaranteed outcomes
- Avoid inventing prices
- Avoid changing supplied numeric facts

### FR-11: Multi-turn interaction

The user must be able to complete at least two model turns.

The conversation should support requests such as:

- "Make the plan easier."
- "I do not want to cut delivery that much."
- "Can I take an extra month?"
- "What if I choose the cheaper hostel?"
- "I would rather cut subscriptions."
- "Why is this realistic?"

The backend must provide the current trusted facts and conversation history with each call.

### FR-12: Structured AI output

The AI service should return a stable object containing:

- Main message
- Follow-up question
- Suggested actions
- Fact keys used
- Risk flags

The frontend must not parse important values out of free-form text.

### FR-13: Booking link

At least one result must include a valid Stay22 booking or affiliate link.

The CTA must clearly indicate that the user is leaving Yonder to view or complete a booking.

### FR-14: App-side caching

Stay22 responses should be cached using a stable key derived from the search parameters.

The cache must store:

- Search key
- Normalized results
- Retrieval time
- Expiry time

The MVP default TTL is 10 minutes unless sponsor guidance requires another value.

### FR-15: Refresh behavior

The frontend may poll the backend, but the backend must not call Stay22 again while a valid matching cache entry exists.

The UI should distinguish:

- Current result
- Cached result
- Unavailable result

### FR-16: Sustainability comparison

The MVP should include at least one clear, measurable sustainability feature if entering the Deloitte track.

Preferred implementation:

- Compare a selected destination with a closer alternative
- Show estimated transport emissions using documented assumptions
- Offer a lower-impact option
- Explain that estimates are approximate

A simple, transparent calculation is better than an unsupported AI-generated environmental claim.

### FR-17: Error states

The user must receive a useful message when:

- No transactions exist
- Reconciliation fails
- No category is selected
- Dates are invalid
- Stay22 returns no results
- Stay22 is unavailable
- FreeSolo is unavailable
- A booking link is missing
- A request times out

## 11. AI and FreeSolo requirements

### 11.1 Why fine-tuning is needed

A generic model can produce broad budgeting advice, but the product needs consistent behavior across many similar calls.

The fine-tuned model should consistently:

- Use supplied facts without changing them
- Ask focused follow-up questions
- Match the user's motivational style
- Suggest feasible changes
- Avoid guilt-based language
- Keep replies concise
- Maintain consistency across turns
- Return the required structure

The model is not being trained to memorize hotel inventory or calculate exact values.

### 11.2 Training algorithm

Primary algorithm: supervised fine-tuning.

Reason:

- The team can define high-quality target conversations.
- The desired behavior is specific and teachable through examples.
- SFT is easier to complete, evaluate, and explain within a hackathon.
- FreeSolo supports message-shaped outputs for multi-turn SFT targets.

GRPO and OPD are stretch options, not MVP requirements.

### 11.3 Training data sources

Training inputs should be synthetic and generated specifically for this project.

Each scenario should include:

- Spending pattern
- Selected category
- Goal type
- Goal cost
- Current savings
- Timeline
- User constraint
- Motivation style
- Example accommodation facts
- Conversation state

Stay22 live prices should not be copied into a permanent memorization dataset.

Training examples may contain synthetic Stay22-shaped records so the model learns how to use supplied price facts. At runtime, current results come from the live API.

### 11.4 Dataset schema

Each FreeSolo record must use:

- `input`
- `output`
- Optional `metadata`

Example:

```json
{
  "input": "A user spends CAD 286.42 monthly on delivery. They are willing to reduce it by 40 percent. Their remaining Montréal accommodation goal is CAD 346.00. They do not want to stop delivery completely. Respond as an encouraging savings planner and ask one follow-up question.",
  "output": {
    "messages": [
      {
        "role": "assistant",
        "content": "You do not need to stop completely. Replacing one delivery order each week would free about $115 per month and put the remaining cost within reach in roughly four months. Would you rather keep that timeline or make the monthly target smaller?"
      },
      {
        "role": "user",
        "content": "Make the monthly target smaller."
      },
      {
        "role": "assistant",
        "content": "A five-month plan would lower the target to about $69 per month. That could mean skipping roughly two delivery orders each month instead of one every week."
      }
    ]
  },
  "metadata": {
    "scenarioId": "scenario_001",
    "tone": "encouraging",
    "edgeCase": false,
    "goalType": "travel"
  }
}
```

### 11.5 Dataset coverage

The dataset must cover variation in:

- Income ranges
- Spending levels
- Categories
- Goal costs
- Current savings
- Timelines
- Travel styles
- Strictness preferences
- Motivational tones
- Feasible and infeasible goals
- Single-turn and multi-turn conversations

Required edge cases:

- Zero recoverable spend
- Goal already reached
- User refuses proposed category reduction
- Goal cannot be reached by the target date
- No affordable Stay22 result
- User changes the destination
- User changes the property
- User selects a lower-cost option
- User asks for aggressive advice
- User asks for guilt-based language
- Provided facts conflict
- Missing data

The model should remain respectful and grounded in every case.

### 11.6 Data generation pipeline

1. Generate structured synthetic profiles.
2. Calculate all exact values using code.
3. Ask a capable teacher LLM to create a target conversation using those facts.
4. Reject outputs that fail JSON or schema validation.
5. Reject outputs that change supplied numeric facts beyond permitted rounding.
6. Use an LLM judge to score:
   - Grounding
   - Feasibility
   - Personalization
   - Tone
   - Helpfulness
   - Multi-turn consistency
7. Keep only examples above a defined threshold.
8. Manually inspect a small random sample and all unusual failures.
9. Split by scenario, not by individual message, to prevent leakage.
10. Train and evaluate on FreeSolo.

### 11.7 LLM judge rubric

Score each dimension from 1 to 5.

#### Grounding

- 5: Uses only supplied facts and preserves them accurately
- 1: Invents or changes important facts

#### Feasibility

- 5: Suggested actions are possible within the spending limits
- 1: Suggests saving more than the user spends or ignores constraints

#### Personalization

- 5: Clearly reflects the user's goal, category, tone, and preferences
- 1: Generic budgeting advice

#### Tone

- 5: Encouraging, clear, and non-judgmental
- 1: Shame-based, harsh, or patronizing

#### Conversation quality

- 5: Asks a useful question and adapts consistently in later turns
- 1: Repeats itself or ignores the user's answer

Suggested acceptance rule:

- No dimension below 4
- Average score of at least 4.2
- All deterministic checks pass

### 11.8 Evaluation plan

Use a held-out set that was never shown during training or data selection.

Compare:

1. Base model with the same system prompt
2. Fine-tuned model

Metrics:

- Numeric fact preservation rate
- Hallucinated property or price rate
- Action feasibility rate
- Tone score
- Personalization score
- Follow-up relevance score
- Multi-turn consistency score
- Structured output validity rate
- Average latency

The team should save example transcripts showing both improvements and remaining failures.

### 11.9 Model fallback

If FreeSolo inference fails:

- Keep the trusted calculations visible
- Use a deterministic template message
- Disable or clearly label the conversational feature
- Log the failure without exposing user data
- Do not silently substitute an unrelated model during the sponsor demo

## 12. Stay22 requirements

### 12.1 API use

Use the Stay22 accommodation search endpoint with server-side authentication.

Required request fields for the demo:

- Destination
- Check-in
- Check-out
- Adults
- Rooms
- Currency

Useful optional fields:

- Property type
- Maximum price
- Minimum guest rating
- Supplier
- Radius

### 12.2 Normalized property model

```json
{
  "id": "stay_123",
  "name": "Example Hotel",
  "type": "hotel",
  "location": {
    "address": "Example address",
    "lat": 45.5017,
    "lng": -73.5673,
    "distanceInMeters": 1200
  },
  "totalPrice": 421.00,
  "currency": "CAD",
  "supplier": "booking",
  "rating": 8.2,
  "ratingCount": 840,
  "hotelStars": 3,
  "capacity": {
    "guests": 2,
    "bedrooms": 1,
    "beds": 1,
    "bathrooms": 1
  },
  "policies": {
    "instantBook": true,
    "freeCancellation": true
  },
  "thumbnailUrl": "https://example.com/image.jpg",
  "bookingUrl": "https://example.com/book"
}
```

### 12.3 No unsupported claims

Do not claim Stay22 provides:

- Historical price charts
- Future price predictions
- True occupancy
- Carbon emissions
- User bank data

If Yonder stores periodic snapshots itself, label them as Yonder-collected observations rather than Stay22 historical data.

## 13. Chexy track requirements

The product must demonstrate an end-to-end payment-related workflow.

Yonder's workflow:

1. Ingest synthetic transactions.
2. Validate transaction fields.
3. Categorize spending.
4. Calculate category totals.
5. Reconcile totals to the source.
6. Let the user make a spending decision.
7. Show the effect on a savings goal.
8. Track the selected plan.

The demo and submission must explain:

- Target user
- Payment-related problem
- Privacy approach
- Financial correctness
- Error handling
- Reconciliation
- Failure modes

Do not present a generic chatbot as the payment workflow.

## 14. Deloitte requirements

If entering the Deloitte track, the product must show a credible environmental mechanism.

Recommended mechanism:

> Yonder helps users compare a desired trip with a closer or lower-impact alternative and shows both cost and estimated travel impact.

Required elements:

- Clear environmental problem
- Transparent calculation or model
- Visible assumptions
- Estimated impact
- Alternative action
- Limitations

Possible MVP output:

```text
Montréal by rail:
Estimated cost: $X
Estimated transport emissions: Y kg CO2e

Farther destination by air:
Estimated cost: $A
Estimated transport emissions: B kg CO2e
```

The exact coefficients must come from a documented source before the team makes numeric claims.

## 15. Sponsor track strategy

### Stay22

Strong evidence:

- Live results are central to the core experience
- Hotel data becomes a spending opportunity-cost engine
- Booking links create a real monetization path
- The product is not another hotel list

### FreeSolo

Strong evidence:

- The team trains and deploys a real adapter
- The model has a clearly defined behavioral task
- The dataset includes multi-turn trajectories
- The team uses an LLM judge and deterministic validators
- The team compares base and fine-tuned performance

### Chexy

Strong evidence:

- End-to-end transaction workflow
- Categorization and reconciliation
- Synthetic data only
- Financial correctness and failure states
- Clear user decision created from payment data

### Deloitte

Strong evidence:

- Measurable comparison
- Transparent environmental assumptions
- Lower-impact alternative
- No unsupported sustainability claims

### Base44

Current status: not qualified based on the provided repository.

Only submit if a meaningful Base44 component is built and demonstrated.

## 16. Architecture

```text
┌──────────────────────────────┐
│ React Frontend               │
│ Goal setup, cards, chat      │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Node Backend                 │
│ Validation and orchestration │
│ Trusted calculations         │
│ Stay22 cache and ranking     │
└───────┬───────────┬──────────┘
        │           │
        v           v
┌──────────────┐  ┌──────────────────┐
│ Stay22 API   │  │ Python AI Service│
│ Live stays   │  │ FreeSolo adapter │
└──────────────┘  └──────────────────┘
        ^
        │
┌──────────────────────────────┐
│ Payment Analysis Service     │
│ Synthetic transactions       │
│ Categorization/reconciliation│
└──────────────────────────────┘
```

## 17. API contracts

### `GET /spend-summary`

Returns reconciled synthetic spending data.

### `POST /api/opportunity`

Accepts user goal and savings preferences, then returns:

- Spend facts
- Normalized Stay22 results
- Opportunity calculations
- Coaching response
- Cache metadata

### `POST /coach`

Accepts trusted facts, preferences, and conversation history, then returns structured coaching content.

Detailed example payloads are documented in `CONTEXT.md`.

## 18. Data model

### User profile

```json
{
  "id": "demo",
  "currency": "CAD",
  "coachingStyle": "encouraging",
  "strictness": "balanced",
  "excludedCategories": []
}
```

### Savings plan

```json
{
  "id": "plan_001",
  "userId": "demo",
  "categoryId": "food_delivery",
  "savingsRate": 0.4,
  "recoverableMonthly": 114.57,
  "currentSaved": 75.00,
  "targetCost": 421.00,
  "status": "active"
}
```

### Conversation session

```json
{
  "id": "session_demo_001",
  "planId": "plan_001",
  "messages": [
    {
      "role": "user",
      "content": "Make the plan easier.",
      "createdAt": "2026-07-18T22:00:00Z"
    }
  ]
}
```

The MVP may keep these objects in memory or simple local storage. A production database is not required for the demo.

## 19. Non-functional requirements

### Reliability

- External calls must have timeouts.
- Stay22 calls must use caching and retry rules.
- Errors must not crash the full page.
- Partial results should remain useful.

### Performance

Target demo performance:

- Cached opportunity response under 1 second
- Uncached external search under 5 seconds when services respond normally
- Coaching response under 8 seconds
- Frontend loading states appear immediately

These are product targets, not guaranteed sponsor API limits.

### Security

- API keys remain server-side
- `.env` files are ignored by Git
- Inputs are validated
- Model output is escaped before rendering
- Logs avoid full transaction details
- Only synthetic financial data is used

### Accessibility

- Keyboard-accessible controls
- Visible focus states
- Text labels for icons
- Sufficient contrast
- Status messages not communicated by colour alone

### Observability

Log:

- Request ID
- Service latency
- Cache hit or miss
- External status code
- Model identifier
- Fallback activation

Do not log full financial profiles or secret keys.

## 20. Edge cases

The app must handle:

- No discretionary categories
- Category spend of zero
- Savings rate of zero
- Savings rate above 100 percent
- Goal already funded
- Goal impossible within the timeline
- Missing Stay22 price
- Multiple supplier prices
- No valid booking URL
- Duplicate properties
- Invalid date range
- Currency mismatch
- FreeSolo timeout
- Malformed model output
- Reconciliation mismatch
- User contradicts an earlier preference
- User asks for professional financial advice

For professional financial advice requests, the model should explain the product's limits and keep the response focused on the user's supplied savings plan.

## 21. Analytics for the demo

Optional local events:

- `spend_summary_viewed`
- `category_selected`
- `travel_search_submitted`
- `opportunity_loaded`
- `coach_message_received`
- `plan_adjusted`
- `booking_link_clicked`
- `fallback_triggered`

No third-party analytics platform is required.

## 22. Work plan

### Phase 1: Contracts and mocks

- Lock request and response shapes
- Run each service independently
- Build mock responses
- Complete frontend skeleton

### Phase 2: Live core dependencies

- Connect Stay22
- Generate FreeSolo dataset
- Train first adapter
- Build payment reconciliation

### Phase 3: End-to-end integration

- Connect all services
- Add multi-turn chat
- Add caching and errors
- Test booking links

### Phase 4: Evaluation and pitch

- Compare base and fine-tuned model
- Save evaluation results
- Test sponsor requirements
- Rehearse three-minute demo
- Prepare fallback recording or screenshots only as backup

## 23. Demo script

### 0:00 to 0:25: Problem

"Budgeting apps tell you where your money went, but they do not show what that spending cost you in terms of something you actually care about."

### 0:25 to 0:55: Payment workflow

Show synthetic transactions, categorized delivery spend, and reconciliation.

### 0:55 to 1:35: Live opportunity

Choose Montréal and fetch live Stay22 options.

Show:

- Total accommodation price
- Monthly spending comparison
- Time to goal
- Current progress

### 1:35 to 2:15: FreeSolo

Show the personalized message.

Respond:

> I do not want to stop ordering food.

Show the model adapting the plan in a second turn.

Briefly explain:

- Synthetic SFT dataset
- LLM judge
- Deterministic numeric checks
- Base versus fine-tuned evaluation

### 2:15 to 2:40: Sustainability

Show one lower-impact or closer alternative with transparent estimated impact.

### 2:40 to 3:00: Conversion

Open the Stay22 booking link and close with:

> Yonder turns spending users barely remember into experiences they will.

## 24. Definition of done

The product is complete enough to submit when:

- All services start using documented commands
- Transaction data reconciles
- One real Stay22 request works
- One real FreeSolo trained-model request works
- Opportunity calculations are tested
- Multi-turn coaching works
- Booking link works
- Loading and failure states work
- No real financial data is used
- Sponsor claims match the implementation
- Base-model and fine-tuned outputs are available for comparison
- The team can complete the demo in three minutes

## 25. Future roadmap

After the hackathon, Yonder could support:

- Concert and event goals
- Laptop and purchase goals
- Debt repayment plans
- Real financial data integrations with consent
- Automated goal transfers
- Shared goals
- Price snapshot history collected by Yonder
- Notification timing personalization
- Mobile applications
- User-controlled data deletion
- Broader travel inventory
- Long-term model evaluation and monitoring

These are future possibilities and should not be presented as completed MVP features.
