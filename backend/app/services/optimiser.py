"""
CP-SAT mission allocation optimiser.
Assigns aircraft, crew, and weapons to missions to maximise coverage
weighted by priority and risk tolerance.

Runs under ~1 s for 12 aircraft, 10 crews, 8 missions.
"""
from __future__ import annotations
import math, uuid, datetime, time
from typing import Optional

import numpy as np

from app.models.domain import (
    ScenarioState, Assignment, PlanOption, PlanResult,
    LatLon, Mission, Aircraft, Crew, Weapon,
)

try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False


# ────────── helpers ──────────────────────────────────────────────────────────

def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _can_reach(ac: Aircraft, base: dict, mission: Mission, airbases: list) -> bool:
    base_ab = next((a for a in airbases if a.id == ac.base), None)
    if not base_ab:
        return False
    dist = _haversine_km(base_ab.lat, base_ab.lon, mission.target_lat, mission.target_lon)
    return dist * 2 < ac.range_km   # round trip


def _crew_qualified(crew: Crew, mission: Mission) -> bool:
    return mission.required_role in crew.qualifications and crew.available


def _weapon_matches(wp: Weapon, mission: Mission, ac: Aircraft) -> bool:
    return (
        wp.type == mission.required_weapon
        and mission.required_role in wp.compatible_roles
        and wp.base == ac.base
        and wp.count >= 1
        and ac.payload_kg >= mission.min_payload_kg
    )


def _route(ac: Aircraft, mission: Mission, airbases: list) -> list[LatLon]:
    base_ab = next((a for a in airbases if a.id == ac.base), None)
    pts = []
    if base_ab:
        pts.append(LatLon(lat=base_ab.lat, lon=base_ab.lon))
    # Simple direct route with a midpoint waypoint
    mid_lat = (base_ab.lat + mission.target_lat) / 2 if base_ab else mission.target_lat
    mid_lon = (base_ab.lon + mission.target_lon) / 2 if base_ab else mission.target_lon
    pts.append(LatLon(lat=mid_lat, lon=mid_lon))
    pts.append(LatLon(lat=mission.target_lat, lon=mission.target_lon))
    return pts


def _reason(ac: Aircraft, crew: Crew, wp: Weapon, mission: Mission, base_ab) -> str:
    dist = _haversine_km(base_ab.lat, base_ab.lon, mission.target_lat, mission.target_lon)
    return (
        f"{ac.callsign}: range fit ({dist:.0f}km one-way, cap {ac.range_km/2:.0f}km), "
        f"weapon match ({wp.type}), crew {crew.name} within duty limit "
        f"({crew.flight_hrs_today+mission.duration_hrs:.1f}/{crew.max_duty_hrs}h)"
    )


# ────────── CP-SAT core ──────────────────────────────────────────────────────

def _solve_cp_sat(sc: ScenarioState, pw: float, rw: float, seed: int = 42) -> list[tuple]:
    """
    Returns list of (mission, aircraft, crew, weapon) tuples for accepted assignments.
    pw = priority weight, rw = risk weight (pw + rw = 1.0 enforced by caller).
    Uses CP-SAT binary assignment model.
    """
    model  = cp_model.CpModel()
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    solver.parameters.random_seed = seed

    missions  = [m for m in sc.missions]
    aircraft  = [a for a in sc.aircraft if a.status == "READY"]
    crews     = [c for c in sc.crews if c.available]
    weapons   = sc.weapons

    # x[m][a][c][w] = 1 if mission m assigned to aircraft a, crew c, weapon w
    # To keep variable count manageable: precompute feasible combos only
    combos: list[tuple] = []     # (m_idx, a_idx, c_idx, w_idx)
    vars_: dict         = {}

    for mi, m in enumerate(missions):
        for ai, a in enumerate(aircraft):
            if not _can_reach(a, None, m, sc.airbases):
                continue
            if a.role != m.required_role:
                continue
            for ci, c in enumerate(crews):
                if not _crew_qualified(c, m):
                    continue
                if c.flight_hrs_today + m.duration_hrs > c.max_duty_hrs:
                    continue
                for wi, w in enumerate(weapons):
                    if not _weapon_matches(w, m, a):
                        continue
                    key = (mi, ai, ci, wi)
                    v   = model.new_bool_var(f"x_{mi}_{ai}_{ci}_{wi}")
                    vars_[key] = v
                    combos.append(key)

    if not combos:
        return []

    # Each mission assigned at most once
    for mi in range(len(missions)):
        mv = [vars_[k] for k in combos if k[0] == mi]
        if mv:
            model.add(sum(mv) <= 1)

    # Each aircraft used at most once (simplified: no concurrent missions)
    for ai in range(len(aircraft)):
        av = [vars_[k] for k in combos if k[1] == ai]
        if av:
            model.add(sum(av) <= 1)

    # Each crew used at most once
    for ci in range(len(crews)):
        cv = [vars_[k] for k in combos if k[2] == ci]
        if cv:
            model.add(sum(cv) <= 1)

    # Objective: maximise priority coverage, penalise high-risk aircraft
    SCALE = 1000
    obj_terms = []
    for key in combos:
        mi, ai, ci, wi = key
        m = missions[mi]
        a = aircraft[ai]
        priority_score = int(SCALE * pw * (4 - m.priority) / 3)   # priority 1 = max 1000
        risk_penalty   = int(SCALE * rw * a.fail_probability)
        obj_terms.append(vars_[key] * (priority_score - risk_penalty))

    model.maximize(sum(obj_terms))

    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return []

    result = []
    for key in combos:
        if solver.value(vars_[key]):
            mi, ai, ci, wi = key
            result.append((missions[mi], aircraft[ai], crews[ci], weapons[wi]))
    return result


def _fallback_greedy(sc: ScenarioState, pw: float, rw: float) -> list[tuple]:
    """Pure-Python greedy fallback when OR-Tools is unavailable."""
    used_ac: set[str] = set()
    used_cr: set[str] = set()
    result: list[tuple] = []
    aircraft = [a for a in sc.aircraft if a.status == "READY"]
    crews    = [c for c in sc.crews if c.available]

    # Sort missions by priority desc
    for m in sorted(sc.missions, key=lambda x: x.priority):
        for a in aircraft:
            if a.id in used_ac: continue
            if a.role != m.required_role: continue
            if not _can_reach(a, None, m, sc.airbases): continue
            for c in crews:
                if c.id in used_cr: continue
                if not _crew_qualified(c, m): continue
                if c.flight_hrs_today + m.duration_hrs > c.max_duty_hrs: continue
                for w in sc.weapons:
                    if not _weapon_matches(w, m, a): continue
                    used_ac.add(a.id)
                    used_cr.add(c.id)
                    result.append((m, a, c, w))
                    break
                else:
                    continue
                break
            else:
                continue
            break
    return result


def _build_assignments(
    combos: list[tuple],
    sc: ScenarioState,
    confidence: float = 1.0,
    low_conf: bool = False,
) -> list[Assignment]:
    now = datetime.datetime.now(datetime.timezone.utc)
    assignments = []
    for (m, ac, crew, wp) in combos:
        base_ab = next((a for a in sc.airbases if a.id == ac.base), None)
        t_start = m.time_window_start
        t_end   = datetime.datetime(
            t_start.year, t_start.month, t_start.day,
            t_start.hour, t_start.minute, t_start.second,
            tzinfo=datetime.timezone.utc,
        ) + datetime.timedelta(hours=m.duration_hrs)
        assignments.append(Assignment(
            mission_id=m.id,
            aircraft_id=ac.id,
            crew_id=crew.id,
            weapon_id=wp.id,
            start_zulu=t_start,
            end_zulu=t_end,
            route=_route(ac, m, sc.airbases),
            reason=_reason(ac, crew, wp, m, base_ab) if base_ab else "assigned",
            confidence=confidence,
            low_conf=low_conf,
        ))
    return assignments


def _score_option(assignments: list[Assignment], sc: ScenarioState) -> tuple[float, float]:
    """Returns (utilisation_pct, risk_score)."""
    util = len(assignments) / max(1, len(sc.missions)) * 100
    risks = []
    for asgn in assignments:
        ac = next((a for a in sc.aircraft if a.id == asgn.aircraft_id), None)
        if ac:
            risks.append(ac.fail_probability)
    risk = float(np.mean(risks)) if risks else 0.0
    return round(util, 1), round(risk, 4)


def optimise(
    sc: ScenarioState,
    priority_weight: float = 0.5,
    seed: int = 42,
    contested: bool = False,
) -> PlanResult:
    """
    Main entry point.  Generates plans A, B, C with different weight profiles.
    pw + rw = 1.0 always.
    """
    t0   = time.perf_counter()
    rw   = 1.0 - priority_weight
    conf = 0.75 if contested else 1.0

    profiles = [
        ("A", priority_weight,        rw,            seed),
        ("B", max(0.1, priority_weight - 0.25), min(0.9, rw + 0.25), seed + 1),
        ("C", min(0.9, priority_weight + 0.25), max(0.1, rw - 0.25), seed + 2),
    ]

    options: list[PlanOption] = []
    for label, pw_, rw_, s in profiles:
        if HAS_ORTOOLS:
            combos = _solve_cp_sat(sc, pw_, rw_, seed=s)
        else:
            combos = _fallback_greedy(sc, pw_, rw_)
        assignments = _build_assignments(combos, sc, confidence=conf, low_conf=contested)
        util, risk  = _score_option(assignments, sc)
        options.append(PlanOption(
            label=label,
            assignments=assignments,
            missions_covered=len(assignments),
            utilisation_pct=util,
            risk_score=risk,
            notes=f"Priority weight {pw_:.2f} / Risk weight {rw_:.2f}",
        ))

    elapsed = time.perf_counter() - t0
    # Best = most missions covered; tie-break on risk
    best = max(options, key=lambda o: (o.missions_covered, -o.risk_score))

    return PlanResult(
        plan_id=str(uuid.uuid4())[:8],
        scenario_id=sc.scenario_id,
        generated_at=datetime.datetime.now(datetime.timezone.utc),
        options=options,
        best_option=best.label,
        planning_time_s=round(elapsed, 3),
        priority_weight=priority_weight,
        risk_weight=rw,
    )
