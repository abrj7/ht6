"""
Person C owns this file and everything in /ai-service.
Exposes POST /coach - see docs/PRD.md section 12 for the contract.

Real mode calls an OpenAI-compatible FreeSolo chat completions endpoint
(FREESOLO_BASE_URL + "/chat/completions") with the fine-tuned FREESOLO_MODEL.
If FREESOLO_API_KEY, FREESOLO_BASE_URL, or FREESOLO_MODEL is missing, or the
real call fails for any reason, this falls back to STUB MODE: contract-correct
responses, templated messages - so a demo never crashes on a flaky endpoint.
"""
import json
import os
import random

import requests
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

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


def _stub_message(tone: str) -> str:
    options = STUB_TEMPLATES.get(tone, STUB_TEMPLATES["encouraging"])
    return random.choice(options)


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
        f"{FREESOLO_BASE_URL}/chat/completions",
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
        return {"message": _stub_message(req.tone)}

    try:
        return {"message": _call_freesolo(req)}
    except Exception:
        return {"message": _stub_message(req.tone)}


@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub" if STUB_MODE else "freesolo"}
