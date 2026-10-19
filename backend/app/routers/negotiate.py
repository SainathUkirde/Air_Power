"""POST /api/negotiate  – run multi-agent negotiation on latest plan.
Returns negotiation_log (ordered events), final assignments, per-mission
scarcity scores, and elapsed time.
"""
from __future__ import annotations
import time
from fastapi import APIRouter
from pydantic import BaseModel
from app.services import scenario as sc_svc, optimiser, negotiation as neg_svc, robustness as rob_svc

router = APIRouter()


class NegotiateResponse(BaseModel):
    plan_id:         str
    negotiation_log: list[dict]
    missions_covered: int
    elapsed_ms:      float
    scarcity:        dict[str, float]   # mission_id → scarcity score (0–1)
    robustness:      dict[str, float]   # option label → survival %
    assignments:     list[dict]         # final awarded assignments


@router.post("/negotiate", response_model=NegotiateResponse)
def run_negotiation():
    t0   = time.perf_counter()
    sc   = sc_svc.get()
    plan = optimiser.optimise(sc, contested=sc.contested)
    refined, log = neg_svc.negotiate(sc, plan)

    best = next((o for o in refined.options if o.label == refined.best_option), refined.options[0])

    # Attach robustness so the frontend can show survival% immediately
    plan_with_rob = rob_svc.attach_robustness(refined, n_runs=500)
    robustness = {o.label: o.robustness_score for o in plan_with_rob.options}

    # Scarcity = 1 – (# feasible aircraft / total aircraft) per mission role
    scarcity: dict[str, float] = {}
    aircraft_avail = [a for a in sc.aircraft if a.status == "READY"]
    for m in sc.missions:
        role_count = sum(1 for a in aircraft_avail if a.role == m.required_role)
        scarcity[m.id] = round(max(0.0, 1.0 - role_count / max(1, len(aircraft_avail))), 3)

    elapsed = round((time.perf_counter() - t0) * 1000, 1)

    return NegotiateResponse(
        plan_id=refined.plan_id,
        negotiation_log=log,
        missions_covered=best.missions_covered,
        elapsed_ms=elapsed,
        scarcity=scarcity,
        robustness=robustness,
        assignments=[
            {
                "mission_id":  a.mission_id,
                "aircraft_id": a.aircraft_id,
                "crew_id":     a.crew_id,
                "weapon_id":   a.weapon_id,
                "reason":      a.reason,
                "confidence":  a.confidence,
            }
            for a in best.assignments
        ],
    )
