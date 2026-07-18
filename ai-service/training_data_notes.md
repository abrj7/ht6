# Training data plan (Person C)

Synthetic dataset shape - {spend pattern + goal + motivational style} -> {coaching message}.
Since we don't have real user data, generate plausible synthetic examples covering:
- Different spend categories (food delivery, subscriptions, shopping, gaming, transport)
- Different goal sizes/timelines
- Different motivational styles (encouraging, tough-love, data-driven, playful)

Be ready to explain to judges exactly how this dataset was built and why it's
credible, not hand-wavy - this is the first thing a technical judge will ask.

Keep a clear record here of:
1. How many training pairs
2. How they were generated (manual writing vs LLM-assisted drafting + human review)
3. What makes this different from just prompting a general model at inference time
