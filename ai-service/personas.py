"""
Hotel fact → dating persona generator for Suite Hearts.
Deterministic per property id so deck + chat stay consistent without an LLM.
"""
from __future__ import annotations

import hashlib
import random
from typing import Any

ARCHETYPES = [
    ("The Slow Burn", "patient, observant, saves the best views for sunrise"),
    ("The Spontaneous Flame", "books last-minute, lives for plot twists"),
    ("The Cozy Classic", "blankets, tea, and zero small talk before coffee"),
    ("The Luxury Minimalist", "understated taste, hates performative flexing"),
    ("The Social Butterfly", "knows the bartender by name, collects stories"),
    ("The Wild Adventurer", "hiking boots in the suitcase, always"),
    ("The Budget Romantic", "candlelit picnic beats a prix fixe every time"),
    ("The Party Catalyst", "DJ requests and late checkout negotiator"),
    ("The Nature Mystic", "forest baths, star maps, silence as a love language"),
    ("The Design Snob", "judges you by your luggage and your lighting"),
]

LOVE_LANGUAGES = [
    "Quality Time",
    "Acts of Service",
    "Words of Affirmation",
    "Physical Touch",
    "Receiving Gifts",
]

GREEN_FLAG_POOL = [
    "Texts back before the lift closes",
    "Remembers your pillow preference",
    "Splits the minibar bill without drama",
    "Plans the itinerary but leaves room for detours",
    "Actually reads the house rules",
    "Brings snacks for the road trip",
    "Tips housekeeping without being asked",
    "Suggests sunrise instead of brunch",
    "Comfortable with silence on long drives",
    "Books refundable rates when you're flaky",
    "Knows when to order room service vs. explore",
    "Celebrates your weird travel rituals",
]

RED_FLAG_POOL = [
    "Leaves wet towels on the bed",
    "Argues with front desk at 2am",
    "Ghosting after matching on vibes alone",
    "Insists on the scenic route with zero snacks",
    "Reviews the hotel mid-stay, out loud",
    "Brings a plus-one you didn't approve",
    "Treats staff like NPCs",
    "Only travels for the Instagram grid",
    "Never shares the aux cord",
    "Cancels free-cancellation windows on purpose",
    "Packs flip-flops for a glacier hike",
    "Talks through the movie on the plane",
]

BIO_TEMPLATES = [
    "{name} ({type}) in {city}. {rating}-star energy, sleeps {capacity}. "
    "I'm {trait} — swipe right if you want {hook}.",
    "Call me {nickname}. {archetype} energy: {trait}. "
    "${price}/night but I'll split the vibe check. {hook}.",
    "{city} local at heart. {type} with {policy}. "
    "Love language: {love}. {hook}.",
]

OPENING_LINES = [
    "Hey — I noticed you picked {vibe}. Same. Want to see my cancellation policy? (It's flexible.)",
    "So… {hook} — but only if you're serious about {vibe}.",
    "I don't usually message first, but your vibe quiz said {vibe} and I felt seen.",
    "Plot twist: I'm available next weekend. You in?",
    "My green flag is {green}. What's yours?",
]

TYPE_TRAITS = {
    "hotel": "polished but not precious",
    "hostel": "communal kitchen flirt",
    "cabin": "fireplace and flannel",
    "villa": "private pool energy",
    "cabin": "off-grid charm",
    "apartment": "local insider",
    "bnb": "homemade breakfast flirt",
    "all_inclusive": "unlimited mimosas, limited drama",
}

TYPE_VIBES = {
    "hotel": ["luxury", "romantic", "social"],
    "hostel": ["budget", "party", "social"],
    "cabin": ["cozy", "nature", "romantic"],
    "villa": ["luxury", "romantic", "adventure"],
    "apartment": ["cozy", "budget", "social"],
    "bnb": ["cozy", "romantic", "nature"],
    "all_inclusive": ["party", "luxury", "social"],
}

STAT_KEYS = ["spontaneity", "luxury", "social", "adventure", "budget", "nature", "romance"]


def _seed_int(seed: str) -> int:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return int(digest[:12], 16)


def _rng(seed: str) -> random.Random:
    return random.Random(_seed_int(seed))


def _nickname(name: str, rng: random.Random) -> str:
    parts = name.split()
    if len(parts) >= 2:
        return parts[0]
    return name[:12]


def _stats_for_property(prop: dict, rng: random.Random) -> dict[str, int]:
    rating = float(prop.get("rating") or 7.5)
    price = float(prop.get("price") or prop.get("cheapestTotal") or 150)
    capacity = int(prop.get("capacity") or 2)
    ptype = (prop.get("type") or "hotel").lower()
    instant = bool(prop.get("instantBook") or prop.get("policies", {}).get("instantBook"))
    free_cancel = bool(
        prop.get("freeCancellation") or prop.get("policies", {}).get("freeCancellation")
    )

    base = {
        "spontaneity": 40 + (10 if instant else 0) + rng.randint(-15, 25),
        "luxury": 30 + int(rating * 5) + (15 if price > 250 else 0) + rng.randint(-10, 15),
        "social": 35 + capacity * 8 + rng.randint(-12, 20),
        "adventure": 35 + rng.randint(-10, 30),
        "budget": max(10, 100 - int(price / 4) + rng.randint(-15, 15)),
        "nature": 30 + rng.randint(-5, 35),
        "romance": 35 + int(rating * 4) + rng.randint(-15, 20),
    }

    if ptype in ("cabin", "villa", "bnb"):
        base["nature"] += 20
    if ptype == "hostel":
        base["social"] += 25
        base["budget"] += 20
    if ptype == "hotel" and price > 200:
        base["luxury"] += 15
    if free_cancel:
        base["spontaneity"] += 10

    # Clamp 5–98
    return {k: max(5, min(98, v)) for k, v in base.items()}


def _vibes_from_stats(stats: dict[str, int], ptype: str, rng: random.Random) -> list[str]:
    vibe_scores = {
        "adventure": stats["adventure"] + stats["spontaneity"] * 0.3,
        "luxury": stats["luxury"],
        "cozy": (100 - stats["social"]) * 0.4 + stats["romance"] * 0.3,
        "party": stats["social"] * 0.7 + stats["spontaneity"] * 0.3,
        "budget": stats["budget"],
        "nature": stats["nature"],
        "romantic": stats["romance"],
        "social": stats["social"],
    }
    for v in TYPE_VIBES.get(ptype, []):
        vibe_scores[v] = vibe_scores.get(v, 50) + 15

    ranked = sorted(vibe_scores.items(), key=lambda x: x[1], reverse=True)
    top = [v for v, _ in ranked[:3]]
    # Stable tie-breaker
    extra = rng.choice([v for v, _ in ranked[3:6]])
    if extra not in top:
        top.append(extra)
    return top[:4]


def build_persona(property_facts: dict) -> dict[str, Any]:
    """Turn Stay22-shaped property facts into a Suite Hearts dating persona."""
    prop_id = str(property_facts.get("id") or property_facts.get("name") or "unknown")
    rng = _rng(f"persona:{prop_id}")

    name = property_facts.get("name") or "Mystery Stay"
    ptype = (property_facts.get("type") or "hotel").lower()
    city = (
        property_facts.get("destination")
        or property_facts.get("location", {}).get("address")
        or property_facts.get("city")
        or "somewhere good"
    )
    rating = property_facts.get("rating") or 8.0
    capacity = property_facts.get("capacity") or 2
    price = property_facts.get("price") or property_facts.get("cheapestTotal") or 150
    instant = bool(
        property_facts.get("instantBook")
        or property_facts.get("policies", {}).get("instantBook")
    )
    free_cancel = bool(
        property_facts.get("freeCancellation")
        or property_facts.get("policies", {}).get("freeCancellation")
    )

    archetype, archetype_blurb = rng.choice(ARCHETYPES)
    love = rng.choice(LOVE_LANGUAGES)
    greens = rng.sample(GREEN_FLAG_POOL, 3)
    reds = rng.sample(RED_FLAG_POOL, 2)
    stats = _stats_for_property(property_facts, rng)
    vibes = _vibes_from_stats(stats, ptype, rng)
    trait = TYPE_TRAITS.get(ptype, "low-key unforgettable")
    nickname = _nickname(name, rng)

    policy_bits = []
    if free_cancel:
        policy_bits.append("free cancellation")
    if instant:
        policy_bits.append("instant book")
    policy = " + ".join(policy_bits) if policy_bits else "old-school charm"

    hooks = [
        f"sunrise hikes and ${int(price)} well spent",
        f"a {ptype} that actually matches the photos",
        f"{capacity}-person stories and no awkward checkout",
        f"{city.split(',')[0]} weekends with {policy}",
    ]
    hook = rng.choice(hooks)
    primary_vibe = vibes[0]

    bio = rng.choice(BIO_TEMPLATES).format(
        name=name,
        nickname=nickname,
        type=ptype,
        city=city.split(",")[0],
        rating=f"{rating:.1f}",
        capacity=capacity,
        trait=trait,
        hook=hook,
        archetype=archetype,
        price=int(price),
        policy=policy,
        love=love,
    )

    opening = rng.choice(OPENING_LINES).format(
        vibe=primary_vibe,
        hook=hook,
        green=greens[0].lower(),
    )

    return {
        "id": prop_id,
        "displayName": nickname,
        "fullName": name,
        "archetype": archetype,
        "archetypeBlurb": archetype_blurb,
        "bio": bio,
        "greenFlags": greens,
        "redFlags": reds,
        "loveLanguage": love,
        "stats": stats,
        "vibes": vibes,
        "openingLine": opening,
        "propertyType": ptype,
        "city": city,
        "price": int(price) if price else None,
        "rating": rating,
    }


def compatibility_score(persona: dict, user_vibes: list[str]) -> int:
    """0–100 match score from vibe overlap + stat alignment."""
    if not user_vibes:
        return 62 + _seed_int(persona.get("id", "")) % 20

    persona_vibes = set(persona.get("vibes") or [])
    stats = persona.get("stats") or {}
    vibe_stat_map = {
        "adventure": "adventure",
        "luxury": "luxury",
        "cozy": "romance",
        "party": "social",
        "budget": "budget",
        "nature": "nature",
        "romantic": "romance",
        "social": "social",
    }

    overlap = len(persona_vibes.intersection(user_vibes))
    overlap_score = min(50, overlap * 18)

    stat_total = 0
    for v in user_vibes:
        key = vibe_stat_map.get(v, "romance")
        stat_total += stats.get(key, 50)
    stat_score = int(stat_total / max(1, len(user_vibes)) * 0.5)

    return max(12, min(99, overlap_score + stat_score))


def chat_reply(
    persona: dict,
    messages: list[dict],
    book_url: str | None = None,
) -> str:
    """Stub in-character reply that steers toward booking."""
    rng = _rng(f"chat:{persona.get('id')}:{len(messages)}")
    user_last = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            user_last = (m.get("content") or "").lower()
            break

    name = persona.get("displayName") or persona.get("fullName") or "I"
    vibe = (persona.get("vibes") or ["adventure"])[0]
    green = (persona.get("greenFlags") or ["good vibes"])[0]
    book = book_url or "my Stay22 link"

    if any(w in user_last for w in ("book", "reserve", "checkout", "yes", "down", "let's go")):
        return (
            f"Say less — I'm holding a spot for us. Tap BOOK NOW ({book}) "
            f"before someone else swipes right on my last room. {green}, remember?"
        )
    if any(w in user_last for w in ("price", "cost", "expensive", "cheap", "budget")):
        price = persona.get("price")
        p = f"${price}/night" if price else "fair for what you get"
        return (
            f"Real talk: {p}, and I don't ghost on fees. "
            f"My love language is {persona.get('loveLanguage', 'Quality Time')} — "
            f"invest in the vibe, not just the thread count."
        )
    if any(w in user_last for w in ("cancel", "flex", "plan")):
        return (
            "Flexible cancellation is my green flag — I don't do anxiety bookings. "
            "Match with me and we can figure dates without the drama."
        )
    if any(w in user_last for w in ("hi", "hey", "hello", "sup")):
        return persona.get("openingLine") or f"Hey — {name} here. You give {vibe} energy."

    templates = [
        f"I'm {persona.get('archetype', 'a catch')} — {persona.get('archetypeBlurb', 'trust me')}. "
        f"Keep talking {vibe} to me and maybe I'll share my {book}.",
        f"Not to flex, but {green.lower()}. What's your move this weekend?",
        f"Stats check: romance {persona.get('stats', {}).get('romance', 70)}/100. "
        f"You seem like you could handle that. Ready to book or still browsing?",
        f"Red flag if you hate {vibe}; green flag if you tip housekeeping. "
        f"Where are you trying to take this — chat or checkout?",
    ]
    reply = rng.choice(templates)
    if rng.random() > 0.55 and book_url:
        reply += f" (P.S. — {book})"
    return reply
