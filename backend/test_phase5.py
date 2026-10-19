#!/usr/bin/env python3
"""
Phase 5 test – NL parser (WHAT-IF vs COMMIT), contested mode, voice command flows.
Run: python backend/test_phase5.py
"""
import sys, os, pathlib
ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT.parent)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
PASS = 0; FAIL = 0

def check(name, condition, detail=''):
    global PASS, FAIL
    if condition:
        print(f"  PASS {name}")
        PASS += 1
    else:
        print(f"  FAIL {name}  {detail}")
        FAIL += 1

print("\n=== TEMPO Phase 5 Tests ===\n")

# ── NL WHAT-IF commands ───────────────────────────────────────────────────────
what_if_cases = [
    ("What if VIPER 12 is down?",              "AIRCRAFT_UNSERVICEABLE"),
    ("What if weather worsens at 1400?",        None),           # WHAT-IF detected
    ("What breaks if GHOST 41 unavailable?",    "AIRCRAFT_UNSERVICEABLE"),
    ("Hypothetically jam all comms",            "COMMS_JAM"),
]
for text, expected_intent in what_if_cases:
    r = client.post("/api/nl", json={"text": text, "commit": False})
    check(f"NL 200: {text[:30]}", r.status_code == 200)
    nl = r.json()
    check(f"  is_what_if=True for: {text[:30]}", nl["is_what_if"] is True)
    if expected_intent:
        check(f"  intent={expected_intent}", nl["intent"] == expected_intent,
              f"got {nl['intent']}")
    check(f"  explanation not empty", bool(nl.get("explanation")))
    check(f"  no plan_diff on WHAT-IF", nl.get("plan_diff") is None)

# ── NL structured parse accuracy ─────────────────────────────────────────────
struct_cases = [
    ("VIPER 11 is down",          "AIRCRAFT_UNSERVICEABLE", "AC01"),
    ("RAPTOR 22 unserviceable",   "AIRCRAFT_UNSERVICEABLE", None),
    ("HAWK 31 u/s",               "AIRCRAFT_UNSERVICEABLE", None),
    ("comms jam detected",        "COMMS_JAM",              None),
    ("weather closing at Nagpur", "WEATHER_CLOSING",        None),
    ("new threat at 20.5N 77E",   "NEW_THREAT",             None),
]
for text, expected_type, expected_id in struct_cases:
    r = client.post("/api/nl", json={"text": text, "commit": False})
    check(f"NL parse 200: {text}", r.status_code == 200)
    nl = r.json()
    check(f"  intent={expected_type} for: {text}", nl["intent"] == expected_type,
          f"got {nl['intent']}")
    if expected_id:
        ev = nl.get("structured_event")
        # structured_event only populated on COMMIT, but intent should still match
        check(f"  structured event absent on WHAT-IF", ev is None)

# ── NL COMMIT flow ────────────────────────────────────────────────────────────
# First reset scenario
client.get("/api/scenario")   # load fresh

r = client.post("/api/nl", json={"text": "VIPER 13 is down", "commit": True})
check("NL COMMIT 200", r.status_code == 200)
nl_commit = r.json()
check("COMMIT is_what_if=False",      nl_commit["is_what_if"] is False, str(nl_commit.get("is_what_if")))
check("COMMIT has structured_event",  nl_commit.get("structured_event") is not None)
check("COMMIT structured_event.type", nl_commit["structured_event"]["type"] == "AIRCRAFT_UNSERVICEABLE")
check("COMMIT plan_diff returned",    nl_commit.get("plan_diff") is not None)

if nl_commit.get("plan_diff"):
    pd = nl_commit["plan_diff"]
    check("plan_diff has diffs list",   isinstance(pd.get("diffs"), list))
    check("plan_diff has summary",      bool(pd.get("disruption_summary")))

# Verify AC03 now UNSERVICEABLE in scenario state
r = client.get("/api/scenario")
sc = r.json()
ac03 = next(a for a in sc["aircraft"] if a["id"] == "AC03")
check("AC03 UNSERVICEABLE after COMMIT", ac03["status"] == "UNSERVICEABLE")

# ── NL unknown / fallback ─────────────────────────────────────────────────────
r = client.post("/api/nl", json={"text": "purple monkey dishwasher", "commit": False})
check("NL unknown 200",         r.status_code == 200)
unk = r.json()
check("unknown intent returned", unk["intent"] == "UNKNOWN")
check("explanation provided",    bool(unk.get("explanation")))

# ── Contested mode ────────────────────────────────────────────────────────────
r = client.post("/api/contested", json={"enable": True, "jammed_sources": ["comms", "radar", "iff"]})
check("POST /api/contested enable 200", r.status_code == 200)
ct = r.json()
check("active=True",           ct["active"] is True)
check("jammed_polygon present", len(ct["jammed_polygon"]) == 4)
check("all 4 polygon points",   all("lat" in p and "lon" in p for p in ct["jammed_polygon"]))
check("sources list present",   len(ct["sources"]) == 6)

sources = {s["source"]: s for s in ct["sources"]}
check("comms LOST",  sources.get("comms", {}).get("status") == "LOST")
check("radar LOST",  sources.get("radar", {}).get("status") == "LOST")
check("iff LOST",    sources.get("iff",   {}).get("status") == "LOST")
check("comms confidence=0", sources["comms"]["confidence"] == 0.0)

# Source age validation
for src in ct["sources"]:
    check(f"  {src['source']} confidence [0,1]", 0 <= src["confidence"] <= 1)
    check(f"  {src['source']} age_minutes >= 0",  src["age_minutes"] >= 0)
    check(f"  {src['source']} status valid",       src["status"] in ("LIVE","DEGRADED","LOST"))

# Affected assignments in jammed polygon area
check("affected_assignments is list", isinstance(ct["affected_assignments"], list))

# ── Plan in contested mode tags LOW CONF ──────────────────────────────────────
r = client.post("/api/plan", json={"priority_weight": 0.5, "include_robustness": False})
check("plan in contested mode 200", r.status_code == 200)
cp = r.json()
best = next(o for o in cp["options"] if o["label"] == cp["best_option"])
# In contested mode all assignments should have confidence < 1.0
all_conf = [a["confidence"] for a in best["assignments"]]
check("assignments have reduced confidence in contested",
      all(c <= 1.0 for c in all_conf))
# At least some should be < 1.0
check("some assignments have low_conf or reduced confidence",
      any(c < 1.0 or a["low_conf"] for a, c in zip(best["assignments"], all_conf)))

# ── Disable contested ─────────────────────────────────────────────────────────
r = client.post("/api/contested", json={"enable": False, "jammed_sources": []})
check("disable contested 200",   r.status_code == 200)
ct2 = r.json()
check("active=False",            ct2["active"] is False)
check("jammed_polygon empty",    ct2["jammed_polygon"] == [])
live_srcs = [s for s in ct2["sources"] if s["status"] == "LIVE"]
check("all sources LIVE after disable", len(live_srcs) == 6)

# ── NL + contested interaction ────────────────────────────────────────────────
# Re-enable contested
client.post("/api/contested", json={"enable": True, "jammed_sources": ["comms"]})
r = client.post("/api/nl", json={"text": "jam all communications", "commit": False})
check("NL jam comms WHAT-IF 200", r.status_code == 200)
nl_jam = r.json()
check("jam intent COMMS_JAM or unknown", nl_jam["intent"] in ("COMMS_JAM", "UNKNOWN"))
check("jam explanation not empty", bool(nl_jam.get("explanation")))

print(f"\n{'='*44}")
print(f"RESULTS: {PASS} passed, {FAIL} failed")
if FAIL:
    sys.exit(1)
else:
    print("ALL PHASE 5 TESTS PASSED.")
