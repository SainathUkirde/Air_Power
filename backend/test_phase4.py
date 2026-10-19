#!/usr/bin/env python3
"""
Phase 4 test – negotiation, robustness, predictions, advisory endpoint.
Run: python backend/test_phase4.py
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

print("\n=== TEMPO Phase 4 Tests ===\n")

# ── Negotiation ───────────────────────────────────────────────────────────────
r = client.post("/api/negotiate")
check("POST /api/negotiate 200", r.status_code == 200, r.text[:100])
neg = r.json()

check("has negotiation_log",  len(neg.get("negotiation_log", [])) > 0)
check("has elapsed_ms",       neg.get("elapsed_ms", -1) >= 0)
check("has scarcity dict",    isinstance(neg.get("scarcity"), dict))
check("has robustness dict",  isinstance(neg.get("robustness"), dict))
check("has assignments list", isinstance(neg.get("assignments"), list))
check("missions_covered >= 0", neg.get("missions_covered", -1) >= 0)

log = neg["negotiation_log"]
actions = {e["action"] for e in log}
check("log has BID events",     "BID"   in actions)
check("log has AWARD events",   "AWARD" in actions)

# Every log entry has required fields
for entry in log[:3]:
    check("log entry has agent",      "agent"      in entry)
    check("log entry has action",     "action"     in entry)
    check("log entry has mission_id", "mission_id" in entry)
    check("log entry has reason",     "reason"     in entry)
    check("log entry has score",      "score"      in entry)
    check("log entry has zulu",       "zulu"       in entry)

# Scarcity values in [0,1]
for mid, sc_val in neg["scarcity"].items():
    check(f"scarcity[{mid}] in [0,1]", 0.0 <= sc_val <= 1.0)

# Robustness values in [0,100]
for label, rob in neg["robustness"].items():
    check(f"robustness[{label}] in [0,100]", 0 <= rob <= 100)

# ── Robustness standalone ─────────────────────────────────────────────────────
r = client.post("/api/plan", json={"priority_weight": 0.5, "include_robustness": True})
plan = r.json()
check("plan for robustness 200", r.status_code == 200)

# Verify robustness already attached by plan endpoint
for opt in plan["options"]:
    check(f"option {opt['label']} has robustness_score", opt.get("robustness_score", -1) >= 0)
    check(f"option {opt['label']} has histogram",        len(opt.get("robustness_histogram", [])) == 20)
    check(f"option {opt['label']} has top_failure_causes", isinstance(opt.get("top_failure_causes"), list))
    check(f"option {opt['label']} has weakest_mission",    "weakest_mission" in opt)

# Standalone robustness endpoint
r = client.post("/api/robustness", json={"plan": plan, "n_runs": 300})
check("POST /api/robustness 200", r.status_code == 200)
robs = r.json()
check("3 results", len(robs) == 3)
for rob in robs:
    check(f"survival_pct valid {rob['plan_id']}", 0 <= rob["survival_pct"] <= 100)
    check(f"histogram len 20 {rob['plan_id']}",  len(rob["histogram"]) == 20)
    check(f"top causes present",                 len(rob["top_failure_causes"]) <= 3)
    check(f"weakest_mission set",                rob["weakest_mission"] != "")

# ── Predictions ───────────────────────────────────────────────────────────────
r = client.get("/api/predictions")
check("GET /api/predictions 200", r.status_code == 200)
preds = r.json()

check("12 aircraft predictions",  len(preds["aircraft"]) == 12)
check("8 mission predictions",    len(preds["missions"])  == 8)

for ap in preds["aircraft"]:
    check(f"ac {ap['callsign']} fail_prob [0,1]", 0 <= ap["fail_probability"] <= 1)
    check(f"ac {ap['callsign']} rul_hrs >= 0",    ap["rul_hrs"] >= 0)
    check(f"ac {ap['callsign']} risk_level set",  ap["risk_level"] in ("LOW","MEDIUM","HIGH","CRITICAL"))

for mp in preds["missions"]:
    check(f"msn {mp['mission_id']} weather_impact [0,1]", 0 <= mp["weather_impact"] <= 1)
    check(f"msn {mp['mission_id']} threat_approach [0,1]", 0 <= mp["threat_approach"] <= 1)
    check(f"msn {mp['mission_id']} at_risk is bool", isinstance(mp["at_risk"], bool))

# ── Advisory endpoint ─────────────────────────────────────────────────────────
r = client.get("/api/advisory")
check("GET /api/advisory 200", r.status_code == 200, r.text[:100])
advs = r.json()
check("advisory list returned",   isinstance(advs, list))

if advs:
    adv0 = advs[0]
    check("advisory has id",       "id"       in adv0)
    check("advisory has level",    "level"    in adv0)
    check("advisory has category", "category" in adv0)
    check("advisory has title",    "title"    in adv0)
    check("advisory has detail",   "detail"   in adv0)
    check("advisory has zulu",     "zulu"     in adv0)

    # HIGH/CRITICAL advisories should have backup_plan
    high_advs = [a for a in advs if a["level"] in ("HIGH","CRITICAL") and a.get("backup_plan")]
    if high_advs:
        bp = high_advs[0]["backup_plan"]
        check("backup_plan has plan_id",          "plan_id"          in bp)
        check("backup_plan has missions_covered", "missions_covered" in bp)
        check("backup_plan has robustness_score", "robustness_score" in bp)
        check("backup_plan has diff_summary",     "diff_summary"     in bp)

# Advisory levels are valid
for a in advs:
    check(f"adv {a['id']} level valid", a["level"] in ("LOW","MEDIUM","HIGH","CRITICAL"))

# ── Pre-emptive: high-risk aircraft should be in advisories ───────────────────
high_risk_acs = [p for p in preds["aircraft"] if p["risk_level"] in ("HIGH","CRITICAL")]
maint_advs    = [a for a in advs if a["category"] == "MAINTENANCE"]
check("maintenance advisories match high-risk aircraft count",
      len(maint_advs) == len(high_risk_acs),
      f"expected {len(high_risk_acs)} got {len(maint_advs)}")

print(f"\n{'='*44}")
print(f"RESULTS: {PASS} passed, {FAIL} failed")
if FAIL:
    sys.exit(1)
else:
    print("ALL PHASE 4 TESTS PASSED.")
