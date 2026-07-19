"""
Person C owns this file and everything in /ai-service.
Exposes POST /coach - see docs/PRD.md section 12 for the contract.

Real mode calls an OpenAI-compatible FreeSolo chat completions endpoint
(FREESOLO_BASE_URL + "/chat/completions") with the fine-tuned FREESOLO_MODEL.
If FREESOLO_API_KEY, FREESOLO_BASE_URL, or FREESOLO_MODEL is missing, or the
real call fails for any reason, this falls back to STUB MODE: contract-correct
responses, templated messages grounded in the user's actual numbers - so a
demo never crashes on a flaky endpoint.

Opportunity-cost math lives in the backend (see PRD section 4) - this service
only does coaching tone/timing (and Suite Hearts personas).
"""
import json
import os
import random
from typing import Optional

import requests
from fastapi import FastAPI
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from personas import build_persona, chat_reply, compatibility_score

load_dotenv()

FREESOLO_API_KEY = os.getenv("FREESOLO_API_KEY", "")
FREESOLO_BASE_URL = os.getenv("FREESOLO_BASE_URL", "")
FREESOLO_MODEL = os.getenv("FREESOLO_MODEL", "")
STUB_MODE = not (FREESOLO_API_KEY and FREESOLO_BASE_URL and FREESOLO_MODEL)

app = FastAPI()


class CoachRequest(BaseModel):
    spendSummary: dict
    goalAmount: float
    tone: str = "encouraging"


class PersonaRequest(BaseModel):
    property: dict = Field(..., description="Stay22-shaped property facts")
    userVibes: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: str
    content: str


class PersonaChatRequest(BaseModel):
    persona: dict
    messages: list[ChatMessage]
    bookUrl: Optional[str] = None


def _facts_from_summary(spend_summary: dict):
    """Prefer the FreeSolo handoff shape; fall back to a Chexy categories blob."""
    if spend_summary.get("category") or spend_summary.get("recoverableMonthly"):
        return {
            "category": str(spend_summary.get("category") or "spending").replace("_", " "),
            "recoverable": float(
                spend_summary.get("recoverableMonthly")
                or spend_summary.get("monthlyTotal")
                or 0
            ),
            "months": spend_summary.get("estimatedMonths"),
            "destination": spend_summary.get("destination"),
            "remaining": spend_summary.get("remaining"),
        }

    categories = spend_summary.get("categories") or []
    best = None
    for c in categories:
        amount = c.get("recoverableSpend") or c.get("monthlyTotal") or 0
        if best is None or amount > (
            best.get("recoverableSpend") or best.get("monthlyTotal") or 0
        ):
            best = c
    if not best:
        return None
    return {
        "category": str(best.get("name") or "spending").replace("_", " "),
        "recoverable": float(best.get("recoverableSpend") or best.get("monthlyTotal") or 0),
        "months": None,
        "destination": None,
        "remaining": None,
    }


# Message templates grounded in real numbers. {cat} = category label,
# {rec} = recoverable $/mo, {goal} = goal price, {months} = months to goal.
STUB_TEMPLATES = {
    "encouraging": [
        "Redirect ${rec}/mo from {cat} and this trip is funded in {months} - you're closer than you think.",
        "${rec} a month out of {cat} covers a ${goal} getaway in {months}. Keep this pace and you're booking, not browsing.",
    ],
    "direct": [
        "{cat} is eating ${rec}/mo - that's a ${goal} trip every {months}. Redirect it and book.",
        "The math is done: ${rec}/mo from {cat} funds the ${goal} goal in {months}. Hold the line.",
    ],
    "playful": [
        "Your {cat} habit is quietly holding a ${goal} trip hostage. ${rec}/mo is the ransom - pay yourself instead.",
        "Skip the {cat}, keep the flights. ${rec}/mo means you're about {months} from a real weekend.",
    ],
}


def _stub_message(req: CoachRequest) -> str:
    facts = _facts_from_summary(req.spendSummary) or {}
    recoverable = facts.get("recoverable") or 0
    cat = facts.get("category") or "spending"
    months_n = facts.get("months")
    if not months_n and recoverable > 0 and req.goalAmount > 0:
        months_n = max(1, round(req.goalAmount / recoverable))

    if recoverable > 0 and req.goalAmount > 0 and months_n:
        months = "1 month" if months_n == 1 else f"{months_n} months"
        template = random.choice(STUB_TEMPLATES.get(req.tone, STUB_TEMPLATES["encouraging"]))
        return template.format(
            cat=cat,
            rec=f"{recoverable:.0f}",
            goal=f"{req.goalAmount:.0f}",
            months=months,
        )
    return (
        "Prices moved in your favor today. Keep this pace and you're booking, not browsing."
    )


def _call_freesolo(req: CoachRequest) -> str:
    """POST an OpenAI-compatible chat completion request to FreeSolo.

    Raises on any failure (network error, bad status, unexpected response
    shape) so the caller can fall back to a stub message instead of crashing.
    """
    payload = {
        "model": FREESOLO_MODEL,
        "messages": [
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "spendSummary": req.spendSummary,
                        "goalAmount": req.goalAmount,
                        "tone": req.tone,
                    }
                ),
            }
        ],
        "temperature": 0.4,
    }
    headers = {"Authorization": f"Bearer {FREESOLO_API_KEY}"}
    response = requests.post(
        f"{FREESOLO_BASE_URL.rstrip('/')}/chat/completions",
        json=payload,
        headers=headers,
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


@app.post("/coach")
def coach(req: CoachRequest):
    if STUB_MODE:
        return {"message": _stub_message(req)}

    try:
        return {"message": _call_freesolo(req)}
    except Exception:
        return {"message": _stub_message(req)}


@app.post("/persona")
def persona(req: PersonaRequest):
    """Fact → dating persona for Suite Hearts deck cards."""
    built = build_persona(req.property)
    score = compatibility_score(built, req.userVibes)
    return {
        "persona": built,
        "compatibility": score,
        "mode": "stub" if STUB_MODE else "freesolo",
    }


@app.post("/persona/chat")
def persona_chat(req: PersonaChatRequest):
    """In-character hotel persona chat — steers toward Stay22 booking."""
    if STUB_MODE:
        messages = [m.model_dump() for m in req.messages]
        reply = chat_reply(req.persona, messages, req.bookUrl)
        return {"reply": reply, "mode": "stub"}

    # TODO (Person C / FreeSolo track): replace stub chat_reply with fine-tuned
    # Suite Hearts persona model trained on training_data/personas_sft.jsonl.
    # Prompt = persona JSON + user messages + bookUrl; model must stay in character
    # and nudge toward booking without breaking the /coach contract.
    raise NotImplementedError("FreeSolo persona chat inference not wired up yet")


@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub" if STUB_MODE else "freesolo"}
