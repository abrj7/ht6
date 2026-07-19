"""Yonder multi-turn Freesolo environment.

A multi-turn environment runs a bounded episode: the model produces an assistant
action, `step_episode` advances the world (optionally appending an observation
message), and the loop repeats until `done` or `max_episode_turns`. The finished
transcript is graded by `score_episode`.

Each row in dataset/train.jsonl looks like:

    {
      "input": "<the exact opening coaching prompt>",
      "output": {"messages": [
          {"role": "assistant", "content": "..."},
          {"role": "user", "content": "..."},
          {"role": "assistant", "content": "..."}
      ]},
      "metadata": {...}
    }

The gold trajectory always starts on `assistant` and alternates roles. The model
only ever plays the assistant seat; `step_episode` replays the gold USER turns
as observations so training data keeps flowing through real assistant/user
turns without ever leaking the gold assistant answer the model is meant to
produce itself.

Edit dataset/train.jsonl and the episode logic, then upload with
`flash env push --name my-env .`.

All three algorithms train off this file:
- GRPO (configs/rl.toml) rolls out full episodes and optimizes `score_episode`.
- SFT (configs/sft.toml) learns the gold trajectory from `output.messages`.
- OPD (configs/opd.toml) rolls out each episode and distils EVERY assistant turn
  against the managed Fireworks teacher, conditioned on the transcript so far.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from freesolo.datasets.types import TaskExample
from freesolo.environments import (
    EnvironmentEpisode,
    EnvironmentMultiTurn,
    EnvironmentStepResult,
    RewardResult,
)

DEFAULT_DATASET_PATH = Path(__file__).parent / "dataset" / "train.jsonl"

# Reward knobs for score_episode. No LLM judge and no API key -- every check
# below is a plain deterministic string/number test.
_MAX_RESPONSE_CHARS = 500  # gold coaching replies run ~170-300 chars; give headroom.
_SHAME_OR_GUARANTEE_PATTERNS = (
    "shame",
    "ashamed",
    "guilt",
    "should have known better",
    "your fault",
    "guarantee",
    "guaranteed",
    "i promise",
    "100% certain",
    "will definitely",
)
_DOLLAR_RE = re.compile(r"\$[\d,]+(?:\.\d+)?")


def load_jsonl(path: str | Path):
    rows = []
    with Path(path).open() as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _gold_messages(example: TaskExample) -> list[dict]:
    """Flatten example.output into a list of {"role", "content"} dicts.

    Every row uses output = {"messages": [...]}; a bare list of messages is
    also tolerated so a slightly different but still reasonable shape doesn't
    hard-fail the environment.
    """
    output = getattr(example, "output", None)
    messages = output.get("messages") if isinstance(output, dict) else output
    if not isinstance(messages, list):
        return []
    cleaned = []
    for m in messages:
        if (
            isinstance(m, dict)
            and m.get("role") in ("user", "assistant")
            and isinstance(m.get("content"), str)
        ):
            cleaned.append({"role": m["role"], "content": m["content"]})
    return cleaned


def _gold_assistant_contents(example: TaskExample) -> list[str]:
    return [m["content"] for m in _gold_messages(example) if m["role"] == "assistant"]


def _gold_user_contents(example: TaskExample) -> list[str]:
    return [m["content"] for m in _gold_messages(example) if m["role"] == "user"]


def _dollar_amounts(text: str) -> set[str]:
    # Normalize away thousands separators so "$1,026.17" and "$1026.17" match.
    return {m.replace(",", "") for m in _DOLLAR_RE.findall(text or "")}


class YonderMultiTurnEnv(EnvironmentMultiTurn):
    dataset = load_jsonl(DEFAULT_DATASET_PATH)

    def start_episode(self, example: TaskExample, prompt_text: str):
        # The opening turn is exactly the supplied coaching prompt -- nothing
        # extra is injected.
        return [{"role": "user", "content": example.input}]

    def max_episode_turns(self, example: TaskExample) -> int:
        # One model turn per gold assistant message, floored at 1 so a row
        # with an empty/malformed trajectory still gets a single shot.
        return max(1, len(_gold_assistant_contents(example)))

    def step_episode(
        self,
        example: TaskExample,
        messages: list,
        assistant_response: str,
    ) -> EnvironmentStepResult:
        # `messages` already ends with the assistant turn the model just
        # produced, so counting assistant-role messages tells us which gold
        # turn (1-indexed) was just generated.
        turn_index = sum(1 for m in messages if m.get("role") == "assistant")
        gold_assistant = _gold_assistant_contents(example)

        if turn_index >= len(gold_assistant):
            # No more gold assistant turns to imitate -- episode is over.
            return EnvironmentStepResult(done=True)

        # A following gold user turn exists: replay it verbatim as the next
        # observation and keep going. The gold assistant answer itself is
        # never shown to the model.
        gold_user = _gold_user_contents(example)
        user_index = turn_index - 1
        if 0 <= user_index < len(gold_user):
            return EnvironmentStepResult(
                done=False,
                messages=[{"role": "user", "content": gold_user[user_index]}],
            )

        # Defensive fallback for a malformed row (assistant turns outnumber
        # user turns): end rather than loop with no observation to add.
        return EnvironmentStepResult(done=True)

    def score_episode(
        self,
        example: TaskExample,
        episode: EnvironmentEpisode,
    ) -> RewardResult:
        # Scoring must never raise; a malformed row just scores 0.
        try:
            return self._score_episode(example, episode)
        except Exception:
            return RewardResult(score=0.0, threshold=1.0, success=False)

    def _score_episode(
        self,
        example: TaskExample,
        episode: EnvironmentEpisode,
    ) -> RewardResult:
        response = str(episode.response_text or "").strip()
        if not response:
            return RewardResult(score=0.0, threshold=1.0, success=False)

        gold_assistant = _gold_assistant_contents(example)
        if not gold_assistant:
            # No gold trajectory to grade against -- treat as malformed data.
            return RewardResult(score=0.0, threshold=1.0, success=False)
        gold_final = gold_assistant[-1]

        passed = 0
        total = 4

        # Concise: stay near the length of the gold coaching replies instead
        # of rambling.
        if len(response) <= _MAX_RESPONSE_CHARS:
            passed += 1

        # Ask a follow-up question exactly when the gold final response does.
        if ("?" in gold_final) == ("?" in response):
            passed += 1

        # No shame-based or guaranteed language.
        lowered = response.lower()
        if not any(p in lowered for p in _SHAME_OR_GUARANTEE_PATTERNS):
            passed += 1

        # Numeric grounding: every dollar amount in the response must be
        # traceable to the supplied facts (example.input) or the gold final
        # answer -- never an invented number.
        allowed_amounts = _dollar_amounts(example.input) | _dollar_amounts(gold_final)
        if _dollar_amounts(response) <= allowed_amounts:
            passed += 1

        score = passed / total
        return RewardResult(score=score, threshold=1.0, success=score >= 1.0)


def load_environment(dataset_path: str | None = None, **kwargs) -> YonderMultiTurnEnv:
    env = YonderMultiTurnEnv()
    if dataset_path:
        env.dataset = load_jsonl(dataset_path)
    return env
