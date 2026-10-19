"""
GET /api/advisory – Pre-emptive retasking advisories.
Combines C-MAPSS failure probabilities, weather-window predictions, and threat
approach rates into prioritised advisory cards.  Each HIGH/CRITICAL advisory
includes a pre-computed backup plan option.
"""
from __future__ import annotations
import datetime
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import scenario as sc_svc, predictions as pred_svc, optimiser, robustness as rob_svc

router = APIRouter()


class BackupSummary(BaseModel):
    plan_id:          str
    missions_covered: int
    robustness_score: float
    diff_summary:     str


class AdvisoryCard(BaseModel):
    id:          str
    level:       str            # LOW | MEDIUM | HIGH | CRITICAL
    category:    str            # MAINTENANCE | WEATHER | THREAT | CREW
    title:       str
    detail:      str
    zulu:        str
    aircraft_id: str = ""
    mission_id:  str = ""
    backup_plan: BackupSummary | None = None


@router.get("/advisory", response_model=list[AdvisoryCard])
def get_advisories():
    sc   = sc_svc.get()
    now  = datetime.datetime.now(datetime.timezone.utc)
    zulu = now.strftime("%d%H%MZ %b %y").upper()

    cards: list[AdvisoryCard] = []
    weather_files = pred_svc._load_weather_cache()

    # ── Aircraft maintenance advisories ──────────────────────────────────────
    ac_preds = pred_svc.build_aircraft_predictions(sc.aircraft)
    for p in ac_preds:
        if p.risk_level not in ("HIGH", "CRITICAL"):
            continue
        pct    = int(p.fail_probability * 100)
        level  = p.risk_level
        detail = (
            f"{p.callsign} engine-hours {next((a.engine_hours for a in sc.aircraft if a.id == p.aircraft_id), 0):.0f}/"
            f"{next((a.max_engine_hours for a in sc.aircraft if a.id == p.aircraft_id), 3000):.0f}. "
            f"Failure probability {pct}% within next 40 flight-hours. "
            f"RUL estimated {p.rul_hrs:.0f} hrs."
        )

        # Pre-compute backup plan with this aircraft marked unserviceable
        import copy
        sc_backup = copy.deepcopy(sc)
        for a in sc_backup.aircraft:
            if a.id == p.aircraft_id:
                a.status = "UNSERVICEABLE"
        backup_plan = optimiser.optimise(sc_backup, priority_weight=0.5)
        backup_plan = rob_svc.attach_robustness(backup_plan, n_runs=200)
        best_backup = next(o for o in backup_plan.options if o.label == backup_plan.best_option)

        cards.append(AdvisoryCard(
            id=f"maint-{p.aircraft_id}",
            level=level,
            category="MAINTENANCE",
            title=f"{p.callsign} MAINT RISK {pct}%",
            detail=detail,
            zulu=zulu,
            aircraft_id=p.aircraft_id,
            backup_plan=BackupSummary(
                plan_id=backup_plan.plan_id,
                missions_covered=best_backup.missions_covered,
                robustness_score=best_backup.robustness_score,
                diff_summary=f"Without {p.callsign}: {best_backup.missions_covered} missions covered, "
                             f"robustness {best_backup.robustness_score:.0f}%",
            ),
        ))

    # ── Mission weather advisories ────────────────────────────────────────────
    m_preds = pred_svc.build_mission_predictions(sc.missions, weather_files)
    for mp in m_preds:
        if not mp.at_risk:
            continue
        wi  = int(mp.weather_impact * 100)
        ta  = int(mp.threat_approach * 100)
        lvl = "HIGH" if wi > 60 or ta > 30 else "MEDIUM"
        cards.append(AdvisoryCard(
            id=f"wx-{mp.mission_id}",
            level=lvl,
            category="WEATHER",
            title=f"{mp.mission_name} WEATHER IMPACT {wi}%",
            detail=mp.reason,
            zulu=zulu,
            mission_id=mp.mission_id,
        ))

    # ── Sort by severity ──────────────────────────────────────────────────────
    sev_order = {"CRITICAL":0, "HIGH":1, "MEDIUM":2, "LOW":3}
    cards.sort(key=lambda c: sev_order.get(c.level, 4))

    return cards
