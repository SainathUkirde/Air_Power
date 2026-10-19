"""
Natural-language / voice command parser.
Tries OpenAI if key present, otherwise regex/rule-based parser.
Distinguishes WHAT-IF from COMMIT.
"""
from __future__ import annotations
import os, re, datetime
from typing import Optional

from app.models.domain import DisruptionEvent, NLRequest, NLResponse


# ────────── regex rule parser ─────────────────────────────────────────────────

_RULES: list[tuple[re.Pattern, str, str]] = [
    (re.compile(r"(jet|aircraft|plane|viper|raptor|hawk|ghost)\s*(\d+)\s+(is\s+)?(down|unserviceable|broken|u/s)", re.I),
     "AIRCRAFT_UNSERVICEABLE", "AC"),
    (re.compile(r"crew\s+(\w+)\s+(unavailable|sick|unfit|grounded)", re.I),
     "CREW_UNAVAILABLE", "CR"),
    (re.compile(r"weather\s+(closing|closing down|deteriorating|bad)\s+(at\s+)?(\w+)?", re.I),
     "WEATHER_CLOSING", "AB"),
    (re.compile(r"new\s+threat\s+(at|near)?\s*([0-9.]+)[,\s]+([0-9.]+)", re.I),
     "NEW_THREAT", "COORD"),
    (re.compile(r"(jam|jamming|jammed)", re.I),
     "COMMS_JAM", ""),
    (re.compile(r"(priorit|escalate|urgent)\w*\s+(\w+[-\s]?\w+)", re.I),
     "PRIORITY_CHANGE", "M"),
]

_CALLSIGN_MAP = {
    "viper 11": "AC01", "viper 12": "AC02", "viper 13": "AC03",
    "raptor 21": "AC04", "raptor 22": "AC05", "raptor 23": "AC06",
    "hawk 31": "AC07", "hawk 32": "AC08", "hawk 33": "AC09", "hawk 34": "AC10",
    "ghost 41": "AC11", "ghost 42": "AC12",
}

def _detect_whatif(text: str) -> bool:
    patterns = ["what if", "what happens if", "what breaks", "hypothetically",
                "simulate", "suppose", "if we", "if weather"]
    return any(p in text.lower() for p in patterns)


def _rule_parse(text: str) -> Optional[DisruptionEvent]:
    lower = text.lower()
    # Aircraft unserviceable: detect callsign
    m = re.search(r"(viper|raptor|hawk|ghost)\s*(\d+)\s+(is\s+)?(down|unserviceable|unavailable|broken|u/s)", lower)
    if m:
        callsign = f"{m.group(1)} {m.group(2)}".upper()
        ac_id    = _CALLSIGN_MAP.get(callsign.lower(), callsign)
        return DisruptionEvent(type="AIRCRAFT_UNSERVICEABLE", target_id=ac_id,
                               severity="HIGH", detail=f"{callsign} unserviceable")

    m = re.search(r"crew\s+(\w+)\s+(unavailable|sick|unfit|grounded)", lower)
    if m:
        return DisruptionEvent(type="CREW_UNAVAILABLE", target_id=m.group(1).upper(),
                               severity="MEDIUM", detail="crew status")

    if re.search(r"jam|jamm", lower):
        return DisruptionEvent(type="COMMS_JAM", severity="HIGH", detail="comms jam")

    m = re.search(r"weather\s+(clos|deterior|bad|wors)", lower)
    if m:
        return DisruptionEvent(type="WEATHER_CLOSING", severity="MEDIUM", detail="weather deterioration")

    m = re.search(r"new\s+threat", lower)
    if m:
        return DisruptionEvent(type="NEW_THREAT", severity="HIGH", detail="20.5,77.0,60")

    m = re.search(r"priorit\w+\s+(m\d{2}|mission\s+\w+)", lower)
    if m:
        return DisruptionEvent(type="PRIORITY_CHANGE", target_id=m.group(1).upper(),
                               severity="MEDIUM", detail="1")

    return None


def _llm_parse(text: str) -> Optional[DisruptionEvent]:
    """Call OpenAI if key set, return structured event or None."""
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        return None
    try:
        import openai
        client = openai.OpenAI(api_key=key)
        system = (
            "You are a military C2 system parser. Extract a single disruption event from "
            "the operator text. Reply ONLY as JSON with keys: "
            "type (AIRCRAFT_UNSERVICEABLE|CREW_UNAVAILABLE|WEATHER_CLOSING|NEW_THREAT|COMMS_JAM|PRIORITY_CHANGE), "
            "target_id (string or null), severity (LOW|MEDIUM|HIGH|CRITICAL), detail (string)."
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"system","content":system},{"role":"user","content":text}],
            temperature=0, max_tokens=200,
        )
        import json
        raw = json.loads(resp.choices[0].message.content)
        return DisruptionEvent(**raw)
    except Exception:
        return None


def process(req: NLRequest) -> NLResponse:
    is_whatif = _detect_whatif(req.text)
    commit    = req.commit and not is_whatif

    event = _llm_parse(req.text) or _rule_parse(req.text)

    if event is None:
        return NLResponse(
            intent="UNKNOWN",
            explanation="Could not parse a structured command from that input. "
                        "Try: 'VIPER 12 is down' or 'What if weather worsens at 1400?'",
            is_what_if=True,
        )

    intent   = event.type
    what_if  = not commit

    expl_map = {
        "AIRCRAFT_UNSERVICEABLE": f"{event.target_id} marked unserviceable – re-optimising without that asset.",
        "CREW_UNAVAILABLE":       f"Crew {event.target_id} removed – reassigning affected missions.",
        "WEATHER_CLOSING":        "Weather deterioration flagged – rerouting or delaying affected missions.",
        "NEW_THREAT":             "New threat zone injected – affected routes will be deconflicted.",
        "COMMS_JAM":              "Comms jam active – switching to contested mode, confidence degraded.",
        "PRIORITY_CHANGE":        f"Priority of {event.target_id} elevated – re-optimising allocation.",
    }
    explanation = expl_map.get(intent, f"Event parsed: {intent}")
    if what_if:
        explanation = "[WHAT-IF] " + explanation + " (no state change committed)"

    return NLResponse(
        intent=intent,
        structured_event=event if not what_if else None,
        explanation=explanation,
        is_what_if=what_if,
    )
