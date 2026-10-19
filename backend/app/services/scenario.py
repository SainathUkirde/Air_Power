"""
Scenario loader – reads seed JSON, enriches with weather and failure probs,
and holds mutable disruption state for the session.
"""
from __future__ import annotations
import json, pathlib, datetime, copy
from typing import Any

from app.models.domain import (
    ScenarioState, Airbase, Aircraft, Crew, Weapon, Mission,
    ThreatZone, WeatherData, DisruptionEvent,
)
from app.services import predictions as pred_svc

REPO_ROOT   = pathlib.Path(__file__).resolve().parents[3]
DATA_DIR    = REPO_ROOT / "data"
SEED_FILE   = DATA_DIR / "seed_scenario.json"
CACHE_DIR   = DATA_DIR / "cache"


def _load_seed() -> dict:
    return json.loads(SEED_FILE.read_text())


def _load_weather() -> list[WeatherData]:
    """Load all cached weather files; fall back to empty list silently."""
    results = []
    for f in sorted(CACHE_DIR.glob("weather_*.json")):
        try:
            d = json.loads(f.read_text())
            results.append(WeatherData(**d))
        except Exception:
            pass
    return results


def _parse_scenario(raw: dict, weather: list[WeatherData]) -> ScenarioState:
    aircraft_objs = [Aircraft(**a) for a in raw["aircraft"]]
    # Enrich with failure probabilities from predictions service
    for ac in aircraft_objs:
        ac.fail_probability = pred_svc.heuristic_fail_prob(ac.engine_hours, ac.max_engine_hours)

    return ScenarioState(
        scenario_id=raw["scenario_id"],
        name=raw["name"],
        classification=raw["classification"],
        zulu_start=datetime.datetime.fromisoformat(raw["zulu_start"].replace("Z", "+00:00")),
        duration_hours=raw["duration_hours"],
        airbases=[Airbase(**a) for a in raw["airbases"]],
        aircraft=aircraft_objs,
        crews=[Crew(**c) for c in raw["crews"]],
        weapons=[Weapon(**w) for w in raw["weapons"]],
        missions=[Mission(**m) for m in raw["missions"]],
        threat_zones=[ThreatZone(**t) for t in raw["threat_zones"]],
        weather=weather,
        data_freshness={
            "scenario": {"source": "seed", "age_minutes": 0},
            "weather":  {"source": "cache", "age_minutes": 0},
            "threats":  {"source": "seed",  "age_minutes": 0},
        },
    )


# Module-level mutable state (single-process dev server; works fine for demo scale)
_raw_seed: dict = {}
_base_scenario: ScenarioState | None = None
_current_scenario: ScenarioState | None = None
_disruption_log: list[DisruptionEvent] = []


def load() -> ScenarioState:
    global _raw_seed, _base_scenario, _current_scenario
    _raw_seed = _load_seed()
    weather   = _load_weather()
    _base_scenario    = _parse_scenario(_raw_seed, weather)
    _current_scenario = copy.deepcopy(_base_scenario)
    return _current_scenario


def get() -> ScenarioState:
    global _current_scenario
    if _current_scenario is None:
        load()
    return _current_scenario


def reset() -> ScenarioState:
    global _disruption_log, _current_scenario, _base_scenario
    _disruption_log = []
    _current_scenario = copy.deepcopy(_base_scenario)
    return _current_scenario


def apply_disruption(event: DisruptionEvent) -> ScenarioState:
    """Mutate current scenario state based on disruption type."""
    global _current_scenario, _disruption_log
    sc = copy.deepcopy(_current_scenario)
    _disruption_log.append(event)

    if event.type == "AIRCRAFT_UNSERVICEABLE" and event.target_id:
        for ac in sc.aircraft:
            if ac.id == event.target_id or ac.callsign == event.target_id:
                ac.status = "UNSERVICEABLE"

    elif event.type == "CREW_UNAVAILABLE" and event.target_id:
        for cr in sc.crews:
            if cr.id == event.target_id or cr.name == event.target_id:
                cr.available = False

    elif event.type == "WEATHER_CLOSING" and event.target_id:
        # Mark weather confidence degraded
        sc.data_freshness["weather"] = {"source": "degraded", "age_minutes": 999, "confidence": 0.3}
        sc.contested = True

    elif event.type == "NEW_THREAT" and event.detail:
        # Parse "lat,lon,radius" from detail if provided
        try:
            parts = event.detail.split(",")
            tz_id = f"TZ{len(sc.threat_zones)+1:02d}"
            sc.threat_zones.append(ThreatZone(
                id=tz_id, name=f"NEW THREAT {tz_id}",
                lat=float(parts[0]), lon=float(parts[1]),
                radius_km=float(parts[2]) if len(parts) > 2 else 50,
                type="SAM", severity=event.severity, active=True,
            ))
        except Exception:
            pass

    elif event.type == "PRIORITY_CHANGE" and event.target_id:
        for m in sc.missions:
            if m.id == event.target_id or m.name == event.target_id:
                # Promote to priority 1 if detail says so
                try:
                    m.priority = int(event.detail)
                except Exception:
                    m.priority = max(1, m.priority - 1)

    elif event.type == "COMMS_JAM":
        sc.contested = True
        sc.data_freshness["comms"] = {"source": "jammed", "age_minutes": 999, "confidence": 0.1}

    sc.disruptions.append(event.model_dump(mode="json"))
    _current_scenario = sc
    return sc


def get_disruption_log() -> list[DisruptionEvent]:
    return list(_disruption_log)
