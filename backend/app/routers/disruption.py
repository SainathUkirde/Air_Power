"""
POST /api/disruption  – inject a disruption event, re-plan, return diff.
"""
from __future__ import annotations
import datetime, uuid
from fastapi import APIRouter

from app.models.domain import (
    DisruptionEvent, DisruptionResponse, PlanDiff, DiffLine, PlanResult,
)
from app.services import scenario as sc_svc, optimiser, robustness as rob_svc

router = APIRouter()


def _build_diff(before: PlanResult, after: PlanResult, event: DisruptionEvent) -> PlanDiff:
    """Compare best-option assignments between two plans."""
    def assignments_map(plan: PlanResult) -> dict:
        opt = next((o for o in plan.options if o.label == plan.best_option), plan.options[0])
        return {a.mission_id: a for a in opt.assignments}

    before_map = assignments_map(before)
    after_map  = assignments_map(after)

    diffs: list[DiffLine] = []
    all_missions = set(before_map) | set(after_map)

    for mid in sorted(all_missions):
        b = before_map.get(mid)
        a = after_map.get(mid)
        if b is None and a is not None:
            diffs.append(DiffLine(
                mission_id=mid,
                before="UNASSIGNED",
                after=f"AC:{a.aircraft_id} CR:{a.crew_id} WP:{a.weapon_id}",
                reason=f"New assignment after disruption {event.type}",
                confidence=a.confidence,
                low_conf=a.low_conf,
            ))
        elif b is not None and a is None:
            diffs.append(DiffLine(
                mission_id=mid,
                before=f"AC:{b.aircraft_id} CR:{b.crew_id} WP:{b.weapon_id}",
                after="UNASSIGNED",
                reason=f"Asset lost due to {event.type}: {event.detail or event.target_id}",
                confidence=0.0,
                low_conf=True,
            ))
        elif b and a and (b.aircraft_id != a.aircraft_id or b.crew_id != a.crew_id):
            diffs.append(DiffLine(
                mission_id=mid,
                before=f"AC:{b.aircraft_id} CR:{b.crew_id}",
                after=f"AC:{a.aircraft_id} CR:{a.crew_id}",
                reason=a.reason,
                confidence=a.confidence,
                low_conf=a.low_conf,
            ))

    return PlanDiff(
        plan_before_id=before.plan_id,
        plan_after_id=after.plan_id,
        diffs=diffs,
        disruption_summary=f"{event.type}: {event.detail or str(event.target_id)} "
                           f"at {datetime.datetime.now(datetime.timezone.utc).strftime('%d%H%MZ')}",
    )


@router.post("/disruption", response_model=DisruptionResponse)
def inject_disruption(event: DisruptionEvent):
    before_sc = sc_svc.get()
    before_plan = optimiser.optimise(before_sc, contested=before_sc.contested)

    # Apply disruption to scenario state
    sc_svc.apply_disruption(event)
    after_sc = sc_svc.get()

    after_plan = optimiser.optimise(after_sc, contested=after_sc.contested)
    after_plan = rob_svc.attach_robustness(after_plan, n_runs=500)

    diff = _build_diff(before_plan, after_plan, event)

    advisories: list[str] = []
    if not diff.diffs:
        advisories.append("Plan unchanged – disruption absorbed within margin.")
    else:
        advisories.append(f"{len(diff.diffs)} mission(s) affected. Review PLAN DIFF.")
    if after_sc.contested:
        advisories.append("CONTESTED MODE ACTIVE – some decisions carry LOW CONF tag.")

    return DisruptionResponse(
        event=event,
        new_plan=after_plan,
        diff=diff,
        advisories=advisories,
    )
