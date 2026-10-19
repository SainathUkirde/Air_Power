"""GET /api/scenario  – return current fused scenario state"""
from fastapi import APIRouter
from app.services import scenario as sc_svc
from app.models.domain import ScenarioState

router = APIRouter()

@router.get("/scenario", response_model=ScenarioState)
def get_scenario():
    return sc_svc.get()
