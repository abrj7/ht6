"""
Person C owns this file and everything in /ai-service.
Exposes POST /coach - see docs/PRD.md section 12 for the contract.

IMPORTANT: FreeSolo docs are TBD - confirm exact training/inference API
before wiring up the real call. Until then this runs in STUB MODE:
contract-correct responses, templated messages. The real implementation
must hit the fine-tuned model (tone/timing generation), NOT do the
opportunity-cost math - that lives in the backend (see PRD section 4).
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


STUB_TEMPLATES = {
    "encouraging": [
        "You're closer than you think - a couple of skipped orders and that trip stops being hypothetical.",
        "Prices moved in your favor today. Keep this pace and you're booking, not browsing.",
    ],
    "direct": [
        "That delivery habit costs a real trip every quarter. Redirect it and book.",
        "The math is done: hold the line for two weeks and the goal is funded.",
    ],
    "playful": [
        "Your couch has had enough of you. The mountains are literally on sale right now.",
        "Skip the fries, keep the flights. You're one lazy weekend away from a real one.",
    ],
}


@app.post("/coach")
def coach(req: CoachRequest):
    if STUB_MODE:
        options = STUB_TEMPLATES.get(req.tone, STUB_TEMPLATES["encouraging"])
        return {"message": random.choice(options)}

    # TODO (Person C): real FreeSolo inference call goes here once docs are
    # confirmed - fine-tuned model, structured prompt from spendSummary +
    # goalAmount + tone. Do not silently fall back to a generic model in the
    # demo path (PRD section 6, item 4).
    raise NotImplementedError("FreeSolo inference not wired up yet")


@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub" if STUB_MODE else "freesolo"}
