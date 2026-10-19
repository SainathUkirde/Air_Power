"""
Failure-probability predictions using trained C-MAPSS model (or heuristic fallback).
Also returns weather-impact scores per mission based on cached weather data.
"""
from __future__ import annotations
import json, math, pathlib, datetime
from typing import Optional

import numpy as np

PROC_DIR    = pathlib.Path(__file__).resolve().parents[3] / "data" / "processed"
CACHE_DIR   = pathlib.Path(__file__).resolve().parents[3] / "data" / "cache"
MODEL_PATH  = PROC_DIR / "cmapss_model.joblib"
META_PATH   = PROC_DIR / "cmapss_model_meta.json"

_model = None
_meta: dict = {}


def _load_model():
    global _model, _meta
    if _model is not None:
        return _model
    try:
        import joblib
        _model = joblib.load(MODEL_PATH)
        _meta  = json.loads(META_PATH.read_text())
    except Exception:
        _model = None
    return _model


def heuristic_fail_prob(engine_hours: float, max_hours: float = 3000.0) -> float:
    """
    Exponential-hazard heuristic when model is absent.
    Returns P(failure within next 40 flight-hours).
    """
    pct = engine_hours / max_hours
    if pct < 0.70:
        return round(0.02 + 0.08 * pct, 4)
    elif pct < 0.90:
        return round(0.08 + 0.40 * (pct - 0.70) / 0.20, 4)
    else:
        return round(min(0.98, 0.48 + 0.50 * (pct - 0.90) / 0.10), 4)


def model_fail_prob(engine_hours: float, pct_life: float) -> float:
    """Try ML model; fall back to heuristic."""
    m = _load_model()
    if m is None:
        return heuristic_fail_prob(engine_hours)
    try:
        # Feature vector matches synthetic training: [engine_hours, pct_life, s2..s14]
        # We estimate sensor readings from pct_life (same degradation model as training)
        s2  = 642.0 + pct_life * 8
        s3  = 1590   - pct_life * 10
        s4  = 1400   + pct_life * 15
        s9  = 9065   - pct_life * 50
        s11 = 47.0   + pct_life * 2
        s14 = 8138   - pct_life * 40
        X   = np.array([[engine_hours, pct_life, s2, s3, s4, s9, s11, s14]])
        return float(m.predict_proba(X)[0][1])
    except Exception:
        return heuristic_fail_prob(engine_hours)


def _risk_level(p: float) -> str:
    if p < 0.15: return "LOW"
    if p < 0.40: return "MEDIUM"
    if p < 0.65: return "HIGH"
    return "CRITICAL"


def _rul_hrs(engine_hours: float, max_hours: float) -> float:
    """Approximate remaining useful life in hours."""
    return max(0.0, round(max_hours - engine_hours, 1))


# ────────── weather impact ──────────────────────────────────────────────────

def _load_weather_cache() -> list[dict]:
    result = []
    for f in sorted(CACHE_DIR.glob("weather_*.json")):
        try:
            result.append(json.loads(f.read_text()))
        except Exception:
            pass
    return result


def weather_impact_at_hour(w_files: list[dict], target_hour: int) -> float:
    """
    Aggregate weather severity (0-1) across all cached locations at given UTC hour.
    Factors: cloud cover > 60%, wind > 12 m/s, visibility < 3000 m, precipitation > 1 mm/h.
    """
    if not w_files:
        return 0.2  # assume mild degradation if no data
    scores = []
    for w in w_files:
        h = w.get("hourly", {})
        idx = min(target_hour, len(h.get("time", [0])) - 1)
        cloud  = h.get("cloudcover", [50])[idx] / 100.0
        wind   = min(1.0, h.get("windspeed_10m", [5])[idx] / 20.0)
        vis    = h.get("visibility", [5000])[idx]
        vis_s  = max(0.0, 1.0 - vis / 5000.0)
        precip = min(1.0, h.get("precipitation", [0])[idx] / 5.0)
        scores.append((cloud * 0.3 + wind * 0.3 + vis_s * 0.2 + precip * 0.2))
    return round(float(np.mean(scores)), 3)


# ────────── public API ───────────────────────────────────────────────────────

def build_aircraft_predictions(aircraft_list: list) -> list[dict]:
    from app.models.domain import AircraftPrediction
    results = []
    for ac in aircraft_list:
        if ac.status == "UNSERVICEABLE":
            p = 1.0
        else:
            pct = ac.engine_hours / ac.max_engine_hours
            p   = model_fail_prob(ac.engine_hours, pct)
        rul  = _rul_hrs(ac.engine_hours, ac.max_engine_hours)
        lvl  = _risk_level(p)
        adv  = ""
        if lvl in ("HIGH", "CRITICAL"):
            adv = (
                f"{ac.callsign} maint risk {int(p*100)}% "
                f"in {int(rul)} hrs. Backup plan ready."
            )
        results.append(AircraftPrediction(
            aircraft_id=ac.id,
            callsign=ac.callsign,
            fail_probability=round(p, 4),
            rul_hrs=rul,
            risk_level=lvl,
            advisory=adv,
        ))
    return results


def build_mission_predictions(missions: list, weather_files: list) -> list[dict]:
    from app.models.domain import MissionPrediction
    results = []
    for m in missions:
        # Mission hour offset from scenario start (approx)
        t = datetime.datetime.fromisoformat(str(m.time_window_start).replace("Z", "+00:00"))
        hour = t.hour
        wi   = weather_impact_at_hour(weather_files, hour)
        # Simple threat approach: random but seeded per mission for determinism
        rng  = np.random.default_rng(abs(hash(m.id)) % (2**31))
        ta   = round(float(rng.uniform(0.05, 0.35)), 3)
        at_risk = wi > 0.5 or ta > 0.25
        reason  = []
        if wi > 0.4: reason.append(f"weather impact {int(wi*100)}%")
        if ta > 0.25: reason.append(f"threat approach probability {int(ta*100)}%")
        results.append(MissionPrediction(
            mission_id=m.id,
            mission_name=m.name,
            weather_impact=wi,
            threat_approach=ta,
            at_risk=at_risk,
            reason="; ".join(reason) if reason else "nominal",
        ))
    return results
