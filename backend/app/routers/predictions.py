"""GET /api/predictions  – aircraft failure probs + mission weather risk"""
from fastapi import APIRouter
from app.services import scenario as sc_svc, predictions as pred
from app.models.domain import PredictionsResponse
import datetime

router = APIRouter()


@router.get("/predictions", response_model=PredictionsResponse)
def get_predictions():
    sc           = sc_svc.get()
    weather_files = pred._load_weather_cache()
    ac_preds     = pred.build_aircraft_predictions(sc.aircraft)
    m_preds      = pred.build_mission_predictions(sc.missions, weather_files)
    return PredictionsResponse(
        generated_at=datetime.datetime.now(datetime.timezone.utc),
        aircraft=ac_preds,
        missions=m_preds,
    )
