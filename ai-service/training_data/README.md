# Suite Hearts persona SFT — FreeSolo track

This folder holds supervised fine-tuning (SFT) data for the **Suite Hearts** hotel-dating persona chat model — a separate track from the dashboard `/coach` endpoint.

## Goal

Train a model that:

1. Stays **in character** as a hotel property persona (archetype, bio, stats, green/red flags).
2. Responds to swipe-match chat with **light flirt + travel specificity** grounded in the persona JSON.
3. **Steers toward booking** when the user shows intent (`book`, `yes`, `link`, price objections resolved).
4. Never breaks the fourth wall or does opportunity-cost math (that stays in the backend).

## Dataset: `personas_sft.jsonl`

~100 JSONL rows, each with OpenAI-style messages:

| Role        | Content |
|-------------|---------|
| `system`    | Fixed Suite Hearts persona instructions |
| `user`      | JSON blob: `{ persona, bookUrl, message }` |
| `assistant` | In-character reply referencing persona fields + Stay22 URL when appropriate |

Persona objects mirror `personas.py` output (`displayName`, `archetype`, `vibes`, `stats`, etc.).

## Training plan (FreeSolo)

1. **Upload** `personas_sft.jsonl` to the FreeSolo training UI / API.
2. **Base model**: their recommended instruct/chat checkpoint (confirm in FreeSolo docs).
3. **Hyperparams (starting point)**:
   - Epochs: 3–5 (watch for over-flirting / URL spam)
   - LoRA or full SFT per FreeSolo defaults
   - Eval split: hold out 10% of rows for qualitative review
4. **Inference wiring** (see `main.py` TODO on `POST /persona/chat`):
   - Prompt = system string + serialized persona + last N chat turns + `bookUrl`
   - Replace `personas.chat_reply()` stub when `FREESOLO_API_KEY` is set
   - Keep `/coach` unchanged — different task, different weights or adapter
5. **Demo path**: at least one live persona chat call in the hackathon demo (PRD §6) without silent fallback to generic chat.

## Stub vs fine-tuned

| Endpoint | Stub (`FREESOLO_API_KEY` unset) | Fine-tuned |
|----------|----------------------------------|------------|
| `POST /persona` | `personas.build_persona()` deterministic | Same — facts→persona stays rule-based |
| `POST /persona/chat` | `personas.chat_reply()` templates | FreeSolo inference on SFT weights |

Fact→persona generation stays deterministic in Python so deck cards are stable without GPU. Only **chat** is the SFT target.

## Expanding the dataset

Before final training, add rows for:

- Price objections and budget vibes
- Group capacity questions
- Cancellation / instant-book policy questions
- “Not sure yet” → soft nudge without hard sell
- Multi-turn threads (concatenate as separate examples or conversation packs per FreeSolo format)

Run `python -c "import json; print(sum(1 for _ in open('personas_sft.jsonl')))"` to verify line count before upload.
