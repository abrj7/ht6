"""
Person C owns this file and everything in /ai-service.
Exposes POST /coach - see docs/PRD.md section 12 for the contract.

IMPORTANT: FreeSolo docs are TBD - confirm exact training/inference API
before wiring up the real call. Until then this runs in STUB MODE:
contract-correct responses, templated messages grounded in the user's
actual numbers. The real implementation must hit the fine-tuned model
(tone/timing generation), NOT do the opportunity-cost math - that lives
in the backend (see PRD section 4).
"""
import os
import random

from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

FREESOLO_API_KEY = os.getenv("FREESOLO_API_KEY", "")
STUB_MODE = not FREESOLO_API_KEY

app = FastAPI()


class CoachRequest(BaseModel):
    spendSummary: dict
    goalAmount: float
    tone: str = "encouraging"


def _top_category(spend_summary: dict):
    """Pick the biggest recoverable category out of the chexy summary."""
    categories = spend_summary.get("categories") or []
    best = None
    for c in categories:
        amount = c.get("recoverableSpend") or c.get("monthlyTotal") or 0
        if best is None or amount > (best.get("recoverableSpend") or best.get("monthlyTotal") or 0):
            best = c
    return best


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


@app.post("/coach")
def coach(req: CoachRequest):
    if STUB_MODE:
        top = _top_category(req.spendSummary)
        recoverable = (top or {}).get("recoverableSpend") or (top or {}).get("monthlyTotal") or 0
        cat = ((top or {}).get("name") or "spending").replace("_", " ")

        if recoverable > 0 and req.goalAmount > 0:
            months_to_goal = max(1, round(req.goalAmount / recoverable))
            months = "1 month" if months_to_goal == 1 else f"{months_to_goal} months"
            template = random.choice(STUB_TEMPLATES.get(req.tone, STUB_TEMPLATES["encouraging"]))
            return {
                "message": template.format(
                    cat=cat,
                    rec=f"{recoverable:.0f}",
                    goal=f"{req.goalAmount:.0f}",
                    months=months,
                )
            }
        # No usable spend data - fall back to a generic-but-on-brand line.
        return {
            "message": "Prices moved in your favor today. Keep this pace and you're booking, not browsing."
        }

    # TODO (Person C): real FreeSolo inference call goes here once docs are
    # confirmed - fine-tuned model, structured prompt from spendSummary +
    # goalAmount + tone. Do not silently fall back to a generic model in the
    # demo path (PRD section 6, item 4).
    raise NotImplementedError("FreeSolo inference not wired up yet")


@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub" if STUB_MODE else "freesolo"}
