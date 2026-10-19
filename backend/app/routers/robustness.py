"""POST /api/robustness  – run Monte Carlo on a submitted plan"""
from fastapi import APIRouter
from app.models.domain import RobustnessRequest, RobustnessResult
from app.services import robustness as rob_svc

router = APIRouter()


@router.post("/robustness", response_model=list[RobustnessResult])
def run_robustness(req: RobustnessRequest):
    return rob_svc.evaluate(req.plan, n_runs=req.n_runs)
