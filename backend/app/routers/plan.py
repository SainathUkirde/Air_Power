"""
POST /api/plan  – generate optimised plan (options A/B/C)
Body: { priority_weight: 0.5 }  (optional)
"""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import scenario as sc_svc, optimiser, robustness as rob_svc
from app.models.domain import PlanResult

router = APIRouter()


class PlanRequest(BaseModel):
    priority_weight: float = 0.5
    seed: int = 42
    include_robustness: bool = True


@router.post("/plan", response_model=PlanResult)
def create_plan(req: PlanRequest):
    sc     = sc_svc.get()
    plan   = optimiser.optimise(
        sc,
        priority_weight=req.priority_weight,
        seed=req.seed,
        contested=sc.contested,
    )
    if req.include_robustness:
        plan = rob_svc.attach_robustness(plan, n_runs=500, seed=req.seed)
    return plan
