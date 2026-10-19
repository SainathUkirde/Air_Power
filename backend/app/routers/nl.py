"""POST /api/nl  – natural language / voice command processing"""
from fastapi import APIRouter
from app.models.domain import NLRequest, NLResponse
from app.services import nl_parser, scenario as sc_svc, optimiser, robustness as rob_svc
from app.routers.disruption import _build_diff

router = APIRouter()


@router.post("/nl", response_model=NLResponse)
def nl_command(req: NLRequest):
    result = nl_parser.process(req)

    # If COMMIT and we got a structured event, apply it and return diff
    if not result.is_what_if and result.structured_event:
        before_sc   = sc_svc.get()
        before_plan = optimiser.optimise(before_sc, contested=before_sc.contested)
        sc_svc.apply_disruption(result.structured_event)
        after_sc    = sc_svc.get()
        after_plan  = optimiser.optimise(after_sc, contested=after_sc.contested)
        after_plan  = rob_svc.attach_robustness(after_plan)
        result.plan_diff = _build_diff(before_plan, after_plan, result.structured_event)

    return result
