"""POST /api/contested  – toggle contested mode, return source statuses + jammed polygon"""
from __future__ import annotations
import datetime, random
from fastapi import APIRouter
from app.models.domain import ContestedRequest, ContestedResponse, DataSourceStatus, LatLon
from app.services import scenario as sc_svc

router = APIRouter()

_JAMMED_POLYGON = [
    LatLon(lat=19.5, lon=76.0),
    LatLon(lat=21.0, lon=76.5),
    LatLon(lat=21.0, lon=79.0),
    LatLon(lat=19.5, lon=79.0),
]

_ALL_SOURCES = ["radar", "iff", "weather", "comms", "intel", "gps"]


@router.post("/contested", response_model=ContestedResponse)
def set_contested(req: ContestedRequest):
    sc = sc_svc.get()
    sc.contested = req.enable

    rng     = random.Random(42)
    sources = []
    for src in _ALL_SOURCES:
        if src in req.jammed_sources:
            sources.append(DataSourceStatus(source=src, confidence=0.0,
                                            age_minutes=rng.uniform(30, 120), status="LOST"))
        elif req.enable and rng.random() < 0.3:
            sources.append(DataSourceStatus(source=src, confidence=rng.uniform(0.3, 0.6),
                                            age_minutes=rng.uniform(5, 30), status="DEGRADED"))
        else:
            sources.append(DataSourceStatus(source=src, confidence=1.0,
                                            age_minutes=0.0, status="LIVE"))

    # Affected assignments: find missions in the jammed area (rough bbox)
    affected: list[str] = []
    for m in sc.missions:
        if 19.5 <= m.target_lat <= 21.0 and 76.0 <= m.target_lon <= 79.0:
            affected.append(m.id)

    return ContestedResponse(
        active=req.enable,
        sources=sources,
        jammed_polygon=_JAMMED_POLYGON if req.enable else [],
        affected_assignments=affected,
    )
