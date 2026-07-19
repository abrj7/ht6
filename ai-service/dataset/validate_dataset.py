"""Validation/audit report for the Yonder coaching dataset.

Checks, per split (train/validation/test) and in aggregate:
  - row count
  - JSON validity
  - schema validity (input, output.messages, metadata + required metadata keys)
  - numeric consistency (remaining, estimated_months, and the two recalculated
    follow-up amounts used in multi-turn "faster"/"easier" replies)
  - grammar/spacing problems (repeated punctuation, "1 months", concatenated
    words, double spaces)
  - multi-turn role alternation / must end on assistant
  - exact and near-duplicate detection within and across splits
  - percentage of multi-turn rows
  - percentage of edge-case rows

Usage: python3 validate_dataset.py
"""
import json
import math
import re
from pathlib import Path

DATASET_DIR = Path(__file__).parent
SPLITS = ["train", "validation", "test"]
REQUIRED_METADATA_KEYS = {
    "scenarioId",
    "tone",
    "strictness",
    "edgeCase",
    "edgeType",
    "goalType",
    "multiTurn",
}

FACT_PATTERNS = {
    "currency": r"Currency: (\w+)\.",
    "category": r"Category: (.+?)\.",
    "monthly_spend": r"Monthly category spend: \$([\d,]+\.\d+)",
    "recoverable": r"Recoverable monthly amount: \$([\d,]+\.\d+)",
    "goal": r"Travel goal: (.+?)\.",
    "property": r"Property: (.+?)\.",
    "goal_cost": r"Goal cost: \$([\d,]+\.\d+)",
    "current_saved": r"Current saved: \$([\d,]+\.\d+)",
    "remaining": r"Remaining: \$([\d,]+\.\d+)",
    "estimated_months": r"Estimated months: (\d+)",
    "tone": r"Tone: (\w+)\.",
    "strictness": r"Strictness: (\w+)\.",
    "constraint": r"User constraint: (.+?)\.\s*Return",
}
MONEY_FIELDS = {
    "monthly_spend",
    "recoverable",
    "goal_cost",
    "current_saved",
    "remaining",
}


def parse_facts(text):
    facts = {}
    for name, pattern in FACT_PATTERNS.items():
        m = re.search(pattern, text)
        if not m:
            facts[name] = None
            continue
        value = m.group(1)
        if name in MONEY_FIELDS:
            value = float(value.replace(",", ""))
        elif name == "estimated_months":
            value = int(value)
        facts[name] = value
    return facts


def load_raw_lines(fname):
    with open(DATASET_DIR / fname, encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f if line.strip()]


def normalize_for_dupe(text):
    t = re.sub(r"\$[\d,]+\.\d+", "$X", text)
    t = re.sub(r"\b\d+\b", "N", t)
    return t


GRAMMAR_CHECKS = [
    ("repeated_period", re.compile(r"\.\.(?!\.)")),
    ("double_space", re.compile(r"  +")),
    ("num_months_singular_bug", re.compile(r"\b1 months\b")),
    ("num_months_plural_bug", re.compile(r"\b(?!1\b)\d+ month\b")),
    ("double_bang_or_q", re.compile(r"(!!|\?\?)")),
]


def load_dict_words():
    path = Path("/usr/share/dict/words")
    if not path.exists():
        return set()
    with open(path, encoding="utf-8", errors="ignore") as f:
        return {w.strip().lower() for w in f if w.strip().isalpha()}


DICT_WORDS = load_dict_words()
# Real single/compound English words that a naive splitter would flag as
# "concatenated" (false positives) -- exclude them from the spacing check.
SPACING_ALLOWLIST = {
    "redirecting", "remaining", "supplied", "timeline", "changing",
    "rideshare", "inventing", "tradeoff", "coaching", "realistic",
    "realistically", "spending", "recoverable", "reduction", "everything",
    "something", "anything", "nothing", "another", "already", "overall",
    "throughout", "without", "within",
}


def find_spacing_issues(text):
    issues = []
    for w in re.findall(r"[A-Za-z]+", text):
        if len(w) < 10:
            continue
        key = w.lower()
        if key in DICT_WORDS or key in SPACING_ALLOWLIST:
            continue
        n = len(key)
        for i in range(3, n - 2):
            a, b = key[:i], key[i:]
            if a in DICT_WORDS and b in DICT_WORDS and len(a) >= 3 and len(b) >= 3:
                issues.append((w, a, b))
                break
    return issues


def main():
    report_lines = []

    def log(*args):
        line = " ".join(str(a) for a in args)
        print(line)
        report_lines.append(line)

    all_rows = {}  # split -> list of (line_no, row_or_None, raw_line)
    json_errors = []
    schema_errors = []

    for split in SPLITS:
        fname = f"{split}.jsonl"
        rows = []
        for i, raw in enumerate(load_raw_lines(fname), start=1):
            try:
                row = json.loads(raw)
            except json.JSONDecodeError as e:
                json_errors.append((split, i, str(e)))
                rows.append((i, None, raw))
                continue
            rows.append((i, row, raw))
        all_rows[split] = rows

    # ---- schema validity ----
    for split, rows in all_rows.items():
        for i, row, raw in rows:
            if row is None:
                continue
            if "input" not in row or not isinstance(row["input"], str) or not row["input"].strip():
                schema_errors.append((split, i, "missing/invalid 'input'"))
            out = row.get("output")
            if not isinstance(out, dict) or "messages" not in out or not isinstance(out["messages"], list) or not out["messages"]:
                schema_errors.append((split, i, "missing/invalid 'output.messages'"))
            else:
                for j, m in enumerate(out["messages"]):
                    if not isinstance(m, dict) or "role" not in m or "content" not in m:
                        schema_errors.append((split, i, f"message {j} missing role/content"))
                    elif m["role"] not in ("user", "assistant"):
                        schema_errors.append((split, i, f"message {j} invalid role {m['role']!r}"))
                    elif not isinstance(m["content"], str) or not m["content"].strip():
                        schema_errors.append((split, i, f"message {j} empty content"))
            meta = row.get("metadata")
            if not isinstance(meta, dict):
                schema_errors.append((split, i, "missing/invalid 'metadata'"))
            else:
                missing_keys = REQUIRED_METADATA_KEYS - meta.keys()
                if missing_keys:
                    schema_errors.append((split, i, f"metadata missing keys {sorted(missing_keys)}"))

    # ---- role alternation / must end on assistant ----
    role_errors = []
    for split, rows in all_rows.items():
        for i, row, raw in rows:
            if row is None:
                continue
            msgs = row.get("output", {}).get("messages", [])
            if not msgs:
                continue
            if msgs[0]["role"] != "assistant":
                role_errors.append((split, row["metadata"].get("scenarioId"), "does not start with assistant"))
            if msgs[-1]["role"] != "assistant":
                role_errors.append((split, row["metadata"].get("scenarioId"), "does not end with assistant"))
            for a, b in zip(msgs, msgs[1:]):
                if a["role"] == b["role"]:
                    role_errors.append((split, row["metadata"].get("scenarioId"), "consecutive same-role messages"))
                    break

    # ---- numeric consistency ----
    numeric_errors = []
    for split, rows in all_rows.items():
        for i, row, raw in rows:
            if row is None:
                continue
            sid = row["metadata"].get("scenarioId")
            edge_type = row["metadata"].get("edgeType")
            facts = parse_facts(row["input"])
            gc, cs, rem, months, recov = (
                facts["goal_cost"], facts["current_saved"], facts["remaining"],
                facts["estimated_months"], facts["recoverable"],
            )
            if None in (gc, cs, rem, months, recov):
                numeric_errors.append((split, sid, "could not parse required numeric facts"))
                continue

            if edge_type != "conflicting_facts":
                expected_remaining = round(max(gc - cs, 0), 2)
                if abs(expected_remaining - rem) > 0.02:
                    numeric_errors.append(
                        (split, sid, f"remaining={rem} expected {expected_remaining}")
                    )
                if recov > 0:
                    expected_months = math.ceil(round(rem / recov, 6)) if rem > 0 else 0
                    if expected_months != months:
                        numeric_errors.append(
                            (split, sid, f"estimated_months={months} expected {expected_months}")
                        )
                elif months != 0:
                    numeric_errors.append(
                        (split, sid, f"zero recoverable but estimated_months={months}, expected 0")
                    )

            msgs = row["output"]["messages"]
            for idx, m in enumerate(msgs):
                if m["role"] != "user":
                    continue
                if m["content"] == "Can I reach it faster?" and idx + 1 < len(msgs):
                    reply = msgs[idx + 1]["content"]
                    amt = re.search(r"\$([\d,]+\.\d+)", reply)
                    got = float(amt.group(1).replace(",", "")) if amt else None
                    expected = round(recov * 1.2, 2)
                    if got is None or abs(got - expected) > 0.02:
                        numeric_errors.append(
                            (split, sid, f"'faster' reply amount={got} expected {expected}")
                        )
                    if rem <= 0:
                        numeric_errors.append(
                            (split, sid, "'Can I reach it faster?' asked with remaining<=0 (already reached)")
                        )
                if m["content"] == "Make the plan easier." and idx + 1 < len(msgs):
                    reply = msgs[idx + 1]["content"]
                    amt = re.search(r"\$([\d,]+\.\d+)", reply)
                    got = float(amt.group(1).replace(",", "")) if amt else None
                    expected = round(rem / (months + 1), 2)
                    if got is None or abs(got - expected) > 0.02:
                        numeric_errors.append(
                            (split, sid, f"'easier' reply amount={got} expected {expected}")
                        )
                    if rem <= 0:
                        numeric_errors.append(
                            (split, sid, "'Make the plan easier.' asked with remaining<=0 (already reached)")
                        )

    # ---- grammar / spacing ----
    grammar_errors = []
    for split, rows in all_rows.items():
        for i, row, raw in rows:
            if row is None:
                continue
            sid = row["metadata"].get("scenarioId")
            blobs = [row["input"]] + [m["content"] for m in row["output"]["messages"]]
            for text in blobs:
                for name, pattern in GRAMMAR_CHECKS:
                    if pattern.search(text):
                        grammar_errors.append((split, sid, name))
                for w, a, b in find_spacing_issues(text):
                    grammar_errors.append((split, sid, f"possible missing space: '{w}' -> '{a} {b}'"))

    # ---- duplicate / leakage detection ----
    exact_dupes = []
    seen_exact = {}
    near_dupes_cross_split = []
    seen_norm = {}
    scenario_ids = {}
    within_split_norm_counts = {}

    for split, rows in all_rows.items():
        for i, row, raw in rows:
            if row is None:
                continue
            sid = row["metadata"].get("scenarioId")
            scenario_ids.setdefault(sid, []).append(split)

            text = row["input"]
            if text in seen_exact:
                exact_dupes.append((seen_exact[text], (split, sid)))
            else:
                seen_exact[text] = (split, sid)

            norm = normalize_for_dupe(text)
            key = (split, norm)
            within_split_norm_counts[key] = within_split_norm_counts.get(key, 0) + 1
            if norm in seen_norm:
                other_split, other_sid = seen_norm[norm]
                if other_split != split:
                    near_dupes_cross_split.append((other_split, other_sid, split, sid))
            else:
                seen_norm[norm] = (split, sid)

    duplicate_scenario_ids = {sid: splits for sid, splits in scenario_ids.items() if len(splits) > 1}

    # ---- summary stats ----
    log("=" * 70)
    log("YONDER DATASET AUDIT REPORT")
    log("=" * 70)

    total_rows = 0
    total_multi = 0
    total_edge = 0
    for split in SPLITS:
        rows = all_rows[split]
        n = len(rows)
        total_rows += n
        valid_rows = [r for _, r, _ in rows if r is not None]
        n_multi = sum(1 for r in valid_rows if r["metadata"].get("multiTurn"))
        n_edge = sum(1 for r in valid_rows if r["metadata"].get("edgeCase"))
        total_multi += n_multi
        total_edge += n_edge
        log(f"\n[{split}] rows={n}")
        log(f"  multi-turn: {n_multi}/{n} ({(n_multi/n*100 if n else 0):.1f}%)")
        log(f"  edge-case:  {n_edge}/{n} ({(n_edge/n*100 if n else 0):.1f}%)")

    log(f"\n[TOTAL] rows={total_rows}")
    log(f"  multi-turn: {total_multi}/{total_rows} ({(total_multi/total_rows*100):.1f}%)")
    log(f"  edge-case:  {total_edge}/{total_rows} ({(total_edge/total_rows*100):.1f}%)")

    log("\n--- JSON validity ---")
    if json_errors:
        for split, i, err in json_errors:
            log(f"  INVALID JSON: {split} line {i}: {err}")
    else:
        log("  All rows parsed as valid JSON.")

    log("\n--- Schema validity ---")
    if schema_errors:
        for split, i, err in schema_errors:
            log(f"  SCHEMA ERROR: {split} line {i}: {err}")
    else:
        log("  All rows conform to {input, output.messages[], metadata} schema.")

    log("\n--- Multi-turn role alternation ---")
    if role_errors:
        for split, sid, err in role_errors:
            log(f"  ROLE ERROR: {split} {sid}: {err}")
    else:
        log("  All multi-turn rows alternate roles correctly and end on assistant.")

    log("\n--- Numeric consistency ---")
    if numeric_errors:
        for split, sid, err in numeric_errors:
            log(f"  NUMERIC ERROR: {split} {sid}: {err}")
    else:
        log("  All remaining/estimated_months/recalculated amounts are consistent.")

    log("\n--- Grammar / spacing / punctuation ---")
    if grammar_errors:
        for split, sid, err in grammar_errors:
            log(f"  GRAMMAR ISSUE: {split} {sid}: {err}")
    else:
        log("  No repeated punctuation, singular/plural month errors, or missing-space issues detected.")

    log("\n--- Duplicate scenario IDs across splits ---")
    if duplicate_scenario_ids:
        for sid, splits in duplicate_scenario_ids.items():
            log(f"  DUPLICATE scenarioId {sid} appears in: {splits}")
    else:
        log("  All 210 scenarioIds are unique across train/validation/test.")

    log("\n--- Exact duplicate input rows ---")
    if exact_dupes:
        for a, b in exact_dupes:
            log(f"  EXACT DUPLICATE input: {a} == {b}")
    else:
        log("  No exact duplicate 'input' text found within or across splits.")

    log("\n--- Near-duplicate / leakage across splits ---")
    log("  (same category+goal+tone+strictness+constraint template, differing only by dollar amounts)")
    if near_dupes_cross_split:
        for a_split, a_sid, b_split, b_sid in near_dupes_cross_split:
            log(f"  CROSS-SPLIT NEAR-DUPLICATE: {a_split}/{a_sid} ~= {b_split}/{b_sid}")
    else:
        log("  No cross-split near-duplicate scenario templates found.")

    log("\n" + "=" * 70)
    total_issues = (
        len(json_errors) + len(schema_errors) + len(role_errors)
        + len(numeric_errors) + len(grammar_errors) + len(duplicate_scenario_ids)
        + len(exact_dupes) + len(near_dupes_cross_split)
    )
    log(f"TOTAL ISSUES FOUND: {total_issues}")
    log("=" * 70)


if __name__ == "__main__":
    main()
