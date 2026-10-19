"""
TEMPO backend – Pydantic data models.
All domain types live here; routers and services import from this module only.
"""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ──────────────────────────── shared primitives ──────────────────────────────

class LatLon(BaseModel):
    lat: float
    lon: float


# ──────────────────────────── scenario entities ──────────────────────────────

class Airbase(BaseModel):
    id: str
    icao: str
    name: str
    lat: float
    lon: float
    elevation_ft: int
    runways: int
    capacity: int
    fuel_tons: float
    ammo_stock: int


class Aircraft(BaseModel):
    id: str
    callsign: str
    role: str                       # STRIKE | SEAD | CAS | ISR
    base: str                       # airbase id
    engine_hours: float
    max_engine_hours: float
    fuel_kg: float
    range_km: float
    payload_kg: float
    status: str                     # READY | UNSERVICEABLE | AIRBORNE
    maintenance_due_hrs: float
    fail_probability: float = 0.0   # injected by predictions service


class Crew(BaseModel):
    id: str
    name: str
    qualifications: list[str]
    duty_start: datetime
    max_duty_hrs: float
    flight_hrs_today: float
    available: bool = True


class Weapon(BaseModel):
    id: str
    type: str
    count: int
    weight_kg: float
    compatible_roles: list[str]
    base: str


class Mission(BaseModel):
    id: str
    name: str
    priority: int                   # 1 = highest
    type: str
    target_lat: float
    target_lon: float
    time_window_start: datetime
    time_window_end: datetime
    duration_hrs: float
    required_role: str
    required_weapon: str
    min_payload_kg: float


class ThreatZone(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    radius_km: float
    type: str
    severity: str
    active: bool


class WeatherData(BaseModel):
    source: str
    location: str
    lat: float
    lon: float
    fetched_at: str
    hourly: dict[str, list]
    confidence: float = 1.0


class ScenarioState(BaseModel):
    scenario_id: str
    name: str
    classification: str
    zulu_start: datetime
    duration_hours: int
    airbases: list[Airbase]
    aircraft: list[Aircraft]
    crews: list[Crew]
    weapons: list[Weapon]
    missions: list[Mission]
    threat_zones: list[ThreatZone]
    weather: list[WeatherData] = []
    disruptions: list[dict] = []
    contested: bool = False
    data_freshness: dict[str, Any] = {}


# ──────────────────────────── plan / assignment ───────────────────────────────

class Assignment(BaseModel):
    mission_id: str
    aircraft_id: str
    crew_id: str
    weapon_id: str
    start_zulu: datetime
    end_zulu: datetime
    route: list[LatLon]             # [base, waypoints…, target]
    reason: str                     # one-line explanation
    confidence: float = 1.0
    low_conf: bool = False


class PlanOption(BaseModel):
    label: str                      # A | B | C
    assignments: list[Assignment]
    missions_covered: int
    utilisation_pct: float
    risk_score: float               # 0-1, lower is safer
    robustness_score: float = 0.0   # filled by robustness endpoint
    robustness_histogram: list[float] = []
    top_failure_causes: list[str] = []
    weakest_mission: str = ""
    notes: str = ""


class PlanResult(BaseModel):
    plan_id: str
    scenario_id: str
    generated_at: datetime
    options: list[PlanOption]
    best_option: str                # label of best option
    planning_time_s: float
    priority_weight: float = 0.5    # 0=all-risk, 1=all-priority
    risk_weight: float = 0.5


class DiffLine(BaseModel):
    mission_id: str
    before: str
    after: str
    reason: str
    confidence: float = 1.0
    low_conf: bool = False


class PlanDiff(BaseModel):
    plan_before_id: str
    plan_after_id: str
    diffs: list[DiffLine]
    disruption_summary: str


# ──────────────────────────── disruption ─────────────────────────────────────

class DisruptionEvent(BaseModel):
    type: Literal[
        "AIRCRAFT_UNSERVICEABLE",
        "CREW_UNAVAILABLE",
        "WEATHER_CLOSING",
        "NEW_THREAT",
        "COMMS_JAM",
        "PRIORITY_CHANGE",
    ]
    target_id: Optional[str] = None     # aircraft/crew/mission id
    severity: Literal["LOW","MEDIUM","HIGH","CRITICAL"] = "MEDIUM"
    detail: str = ""
    zulu_time: Optional[datetime] = None


class DisruptionResponse(BaseModel):
    event: DisruptionEvent
    new_plan: PlanResult
    diff: PlanDiff
    advisories: list[str]


# ──────────────────────────── robustness ─────────────────────────────────────

class RobustnessRequest(BaseModel):
    plan: PlanResult
    n_runs: int = 500


class RobustnessResult(BaseModel):
    plan_id: str
    survival_pct: float
    top_failure_causes: list[str]
    weakest_mission: str
    histogram: list[float]          # 20-bin coverage distribution
    n_runs: int


# ──────────────────────────── NL / voice ─────────────────────────────────────

class NLRequest(BaseModel):
    text: str
    commit: bool = False            # False = WHAT-IF only


class NLResponse(BaseModel):
    intent: str
    structured_event: Optional[DisruptionEvent] = None
    explanation: str
    is_what_if: bool = True
    plan_diff: Optional[PlanDiff] = None


# ──────────────────────────── predictions ────────────────────────────────────

class AircraftPrediction(BaseModel):
    aircraft_id: str
    callsign: str
    fail_probability: float
    rul_hrs: float                  # remaining useful life hours
    risk_level: str                 # LOW | MEDIUM | HIGH | CRITICAL
    advisory: str


class MissionPrediction(BaseModel):
    mission_id: str
    mission_name: str
    weather_impact: float           # 0-1 severity
    threat_approach: float          # 0-1 probability threat expands
    at_risk: bool
    reason: str


class PredictionsResponse(BaseModel):
    generated_at: datetime
    aircraft: list[AircraftPrediction]
    missions: list[MissionPrediction]


# ──────────────────────────── contested ──────────────────────────────────────

class ContestedRequest(BaseModel):
    enable: bool
    jammed_sources: list[str] = []


class DataSourceStatus(BaseModel):
    source: str
    confidence: float
    age_minutes: float
    status: str                     # LIVE | DEGRADED | LOST


class ContestedResponse(BaseModel):
    active: bool
    sources: list[DataSourceStatus]
    jammed_polygon: list[LatLon]
    affected_assignments: list[str]


# ──────────────────────────── health ─────────────────────────────────────────

class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    status: str
    version: str
    model_loaded: bool
    weather_cache: bool
    scenario_loaded: bool
