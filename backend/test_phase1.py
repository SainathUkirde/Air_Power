#!/usr/bin/env python3
"""
Phase 1 quick-test: starts the backend in-process, exercises all endpoints.
Run from the repo root:  python backend/test_phase1.py
"""
import sys, os, pathlib, json

# ensure backend is on path
ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT))

# patch env so scenario loader finds data
os.chdir(ROOT.parent)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
PASS = 0; FAIL = 0


def check(name: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        print(f"  PASS {name}")
        PASS += 1
    else:
        print(f"  FAIL {name}  {detail}")
        FAIL += 1


print("\n=== TEMPO Phase 1 Tests ===\n")

# ── /api/health ──────────────────────────────────────────────────────────────
r = client.get("/api/health")
check("GET /api/health 200", r.status_code == 200)
h = r.json()
check("health.status == ok", h.get("status") == "ok")
check("health.scenario_loaded", h.get("scenario_loaded") is True)

# ── /api/scenario ─────────────────────────────────────────────────────────────
r = client.get("/api/scenario")
check("GET /api/scenario 200", r.status_code == 200)
sc = r.json()
check("scenario has 12 aircraft", len(sc["aircraft"]) == 12)
check("scenario has 10 crews",    len(sc["crews"]) == 10)
check("scenario has 8 missions",  len(sc["missions"]) == 8)
check("scenario has 4 airbases",  len(sc["airbases"]) == 4)
check("aircraft have fail_probability", all("fail_probability" in a for a in sc["aircraft"]))

# ── /api/plan ─────────────────────────────────────────────────────────────────
r = client.post("/api/plan", json={"priority_weight": 0.5, "include_robustness": True})
check("POST /api/plan 200", r.status_code == 200, r.text[:200])
plan = r.json()
check("plan has 3 options",    len(plan["options"]) == 3)
check("options labelled A B C", {o["label"] for o in plan["options"]} == {"A","B","C"})
check("best_option set",       plan.get("best_option") in ("A","B","C"))
check("planning_time_s < 10",  plan.get("planning_time_s", 99) < 10)
best = next(o for o in plan["options"] if o["label"] == plan["best_option"])
check("best option has assignments", len(best["assignments"]) > 0)
check("assignments have reason",
      all("reason" in a for a in best["assignments"]))
check("robustness scores attached",
      all(o["robustness_score"] > 0 for o in plan["options"]))

# ── /api/disruption ───────────────────────────────────────────────────────────
r = client.post("/api/disruption", json={
    "type": "AIRCRAFT_UNSERVICEABLE",
    "target_id": "AC02",
    "severity": "HIGH",
    "detail": "VIPER 12 hydraulic failure",
})
check("POST /api/disruption 200", r.status_code == 200, r.text[:200])
dr = r.json()
check("disruption returns new plan",   "new_plan" in dr)
check("disruption returns diff",       "diff" in dr)
check("disruption returns advisories", len(dr["advisories"]) > 0)
# AC02 should now be unserviceable
r2 = client.get("/api/scenario")
sc2 = r2.json()
ac02 = next(a for a in sc2["aircraft"] if a["id"] == "AC02")
check("AC02 status UNSERVICEABLE", ac02["status"] == "UNSERVICEABLE")

# ── /api/predictions ──────────────────────────────────────────────────────────
r = client.get("/api/predictions")
check("GET /api/predictions 200", r.status_code == 200)
preds = r.json()
check("predictions has aircraft list", len(preds["aircraft"]) == 12)
check("predictions has mission list",  len(preds["missions"]) == 8)
check("all aircraft have risk_level",
      all("risk_level" in a for a in preds["aircraft"]))

# ── /api/robustness ───────────────────────────────────────────────────────────
r2 = client.post("/api/plan", json={"priority_weight": 0.5, "include_robustness": False})
plan2 = r2.json()
r = client.post("/api/robustness", json={"plan": plan2, "n_runs": 100})
check("POST /api/robustness 200", r.status_code == 200, r.text[:200])
rob = r.json()
check("robustness has 3 results",     len(rob) == 3)
check("survival_pct in [0,100]",
      all(0 <= o["survival_pct"] <= 100 for o in rob))

# ── /api/nl ───────────────────────────────────────────────────────────────────
r = client.post("/api/nl", json={"text": "VIPER 12 is down", "commit": False})
check("POST /api/nl 200", r.status_code == 200, r.text[:200])
nl = r.json()
check("nl intent AIRCRAFT_UNSERVICEABLE", nl["intent"] == "AIRCRAFT_UNSERVICEABLE")
check("nl is_what_if True", nl["is_what_if"] is True)

r = client.post("/api/nl", json={"text": "What if weather worsens at 1400?", "commit": False})
check("NL what-if detected", r.json().get("is_what_if") is True)

# ── /api/negotiate ────────────────────────────────────────────────────────────
r = client.post("/api/negotiate")
check("POST /api/negotiate 200", r.status_code == 200, r.text[:200])
neg = r.json()
check("negotiate returns log", len(neg.get("negotiation_log", [])) > 0)
check("negotiate returns missions_covered", neg.get("missions_covered", -1) >= 0)
log_actions = {e["action"] for e in neg["negotiation_log"]}
check("log has BID events",   "BID" in log_actions)
check("log has AWARD events", "AWARD" in log_actions)

# ── /api/contested ────────────────────────────────────────────────────────────
r = client.post("/api/contested", json={"enable": True, "jammed_sources": ["comms","radar"]})
check("POST /api/contested 200", r.status_code == 200, r.text[:200])
ct = r.json()
check("contested active", ct["active"] is True)
check("jammed polygon returned", len(ct["jammed_polygon"]) > 0)
sources = {s["source"]: s["status"] for s in ct["sources"]}
check("comms LOST",  sources.get("comms") == "LOST")
check("radar LOST",  sources.get("radar") == "LOST")

print(f"\n{'='*40}")
print(f"RESULTS: {PASS} passed, {FAIL} failed")
if FAIL:
    sys.exit(1)
else:
    print("ALL TESTS PASSED – Phase 1 ready.")
