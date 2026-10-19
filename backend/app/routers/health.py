"""GET /api/health"""
from fastapi import APIRouter
from app.models.domain import HealthResponse
import pathlib

router = APIRouter()
VERSION = "1.0.0"


@router.get("/health", response_model=HealthResponse)
def health():
    model_path   = pathlib.Path(__file__).resolve().parents[3] / "data" / "processed" / "cmapss_model.joblib"
    weather_path = pathlib.Path(__file__).resolve().parents[3] / "data" / "cache"
    from app.services import scenario as sc_svc
    # get() auto-loads if not yet loaded (covers TestClient startup race)
    sc = sc_svc.get()
    return HealthResponse(
        status="ok",
        version=VERSION,
        model_loaded=model_path.exists(),
        weather_cache=any(weather_path.glob("weather_*.json")),
        scenario_loaded=sc is not None,
    )
