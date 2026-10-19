"""
Multi-agent negotiation service.
AircraftAgent, CrewAgent, WeaponsAgent, WeatherAgent each bid or veto
per mission. CoordinatorAgent resolves via priority → risk → scarcity.
Returns ordered log of events and final assignment.
"""
from __future__ import annotations
import datetime
from app.models.domain import ScenarioState, PlanResult, Assignment


# ────────── agent primitives ─────────────────────────────────────────────────

class AgentMessage:
    def __init__(self, agent: str, action: str, mission_id: str, reason: str,
                 score: float = 0.0):
        self.agent      = agent
        self.action     = action        # BID | VETO | AWARD | RESOLVE
        self.mission_id = mission_id
        self.reason     = reason
        self.score      = score
        self.zulu       = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%d%H%MZ %b %y").upper()

    def to_dict(self) -> dict:
        return {
            "agent":      self.agent,
            "action":     self.action,
            "mission_id": self.mission_id,
            "reason":     self.reason,
            "score":      round(self.score, 3),
            "zulu":       self.zulu,
        }


class AircraftAgent:
    def evaluate(self, mission, aircraft_list, airbases) -> list[tuple]:
        """Returns list of (aircraft, score, reason) bids for the mission."""
        from app.services.optimiser import _can_reach, _haversine_km
        bids = []
        for ac in aircraft_list:
            if ac.status != "READY": continue
            if ac.role != mission.required_role: continue
            if not _can_reach(ac, None, mission, airbases): continue
            base_ab = next((a for a in airbases if a.id == ac.base), None)
            if not base_ab: continue
            dist  = _haversine_km(base_ab.lat, base_ab.lon, mission.target_lat, mission.target_lon)
            score = 1.0 - ac.fail_probability - dist / 5000.0
            bids.append((ac, score, f"range {dist:.0f}km, fail_prob {ac.fail_probability:.2f}"))
        return bids


class CrewAgent:
    def evaluate(self, mission, crew_list) -> list[tuple]:
        bids = []
        for c in crew_list:
            if not c.available: continue
            if mission.required_role not in c.qualifications: continue
            remaining = c.max_duty_hrs - c.flight_hrs_today
            if remaining < mission.duration_hrs: continue
            score = remaining / c.max_duty_hrs
            bids.append((c, score, f"{remaining:.1f}h duty remaining, qualified"))
        return bids


class WeaponsAgent:
    def evaluate(self, mission, weapons, aircraft) -> list[tuple]:
        from app.services.optimiser import _weapon_matches
        bids = []
        for w in weapons:
            if not _weapon_matches(w, mission, aircraft): continue
            score = min(1.0, w.count / 4.0)
            bids.append((w, score, f"{w.type} x{w.count} available at {w.base}"))
        return bids


class WeatherAgent:
    def __init__(self, weather_impact_fn):
        self._impact = weather_impact_fn

    def evaluate(self, mission) -> tuple[float, str]:
        """Returns (veto_prob, reason). veto_prob > 0.6 issues a VETO."""
        import datetime as dt
        t    = dt.datetime.fromisoformat(str(mission.time_window_start).replace("Z", "+00:00"))
        imp  = self._impact(t.hour)
        if imp > 0.6:
            return imp, f"weather severity {int(imp*100)}% – VETO"
        return imp, f"weather severity {int(imp*100)}% – acceptable"


class CoordinatorAgent:
    """
    Resolution strategy:
    1. Collect all bids per mission
    2. Apply vetoes
    3. Score = priority_boost + ac_score + crew_score + weapon_score - weather_penalty
    4. Award best feasible combo; break ties by scarcity (fewest alternative candidates)
    """

    def resolve(
        self,
        mission,
        ac_bids:   list[tuple],
        crew_bids: list[tuple],
        wp_bids:   list[tuple],
        weather_veto: float,
        log: list,
    ) -> tuple | None:
        if weather_veto > 0.8:
            log.append(AgentMessage("COORDINATOR", "RESOLVE", mission.id,
                f"Mission {mission.name} blocked by weather veto ({int(weather_veto*100)}%)",
                score=0).to_dict())
            return None

        if not ac_bids or not crew_bids or not wp_bids:
            log.append(AgentMessage("COORDINATOR", "RESOLVE", mission.id,
                "Insufficient resources – no assignment possible", score=0).to_dict())
            return None

        priority_boost = (4 - mission.priority) / 3.0

        best_score = -999.0
        best_combo = None
        for (ac, ac_s, _) in ac_bids:
            for (cr, cr_s, _) in crew_bids:
                for (wp, wp_s, _) in wp_bids:
                    score = priority_boost + ac_s + cr_s + wp_s - weather_veto
                    if score > best_score:
                        best_score = score
                        best_combo = (ac, cr, wp)

        if best_combo:
            ac, cr, wp = best_combo
            log.append(AgentMessage("COORDINATOR", "AWARD", mission.id,
                f"Awarded {ac.callsign}/{cr.name}/{wp.type} score={best_score:.2f}",
                score=best_score).to_dict())
        return best_combo


# ────────── public entry point ────────────────────────────────────────────────

def negotiate(sc: ScenarioState, plan: PlanResult) -> tuple[PlanResult, list[dict]]:
    """
    Run multi-agent negotiation and return (refined_plan, negotiation_log).
    Negotiation may alter the best-option assignments based on agent scores.
    """
    from app.services import predictions as pred
    from app.services.optimiser import _route, _reason, _build_assignments
    import copy, uuid, datetime

    log: list[dict] = []

    ac_agent   = AircraftAgent()
    crew_agent = CrewAgent()
    wp_agent   = WeaponsAgent()
    weather_agent = WeatherAgent(
        lambda hour: pred.weather_impact_at_hour(pred._load_weather_cache(), hour)
    )
    coordinator = CoordinatorAgent()

    used_ac: set[str]  = set()
    used_cr: set[str]  = set()
    assignments_out: list[Assignment] = []

    aircraft_avail = [a for a in sc.aircraft if a.status == "READY"]
    crew_avail     = [c for c in sc.crews if c.available]

    for mission in sorted(sc.missions, key=lambda m: m.priority):
        # -- Bids --
        ac_bids  = ac_agent.evaluate(mission, [a for a in aircraft_avail if a.id not in used_ac], sc.airbases)
        crew_bids= crew_agent.evaluate(mission, [c for c in crew_avail if c.id not in used_cr])
        wp_bids  = wp_agent.evaluate(mission, sc.weapons, ac_bids[0][0] if ac_bids else aircraft_avail[0] if aircraft_avail else None)
        wi, w_reason = weather_agent.evaluate(mission)

        for (ac, s, r) in ac_bids[:3]:
            log.append(AgentMessage("AIRCRAFT_AGENT", "BID", mission.id, f"{ac.callsign}: {r}", s).to_dict())
        for (cr, s, r) in crew_bids[:3]:
            log.append(AgentMessage("CREW_AGENT", "BID", mission.id, f"{cr.name}: {r}", s).to_dict())
        for (wp, s, r) in wp_bids[:2]:
            log.append(AgentMessage("WEAPONS_AGENT", "BID", mission.id, f"{wp.type}: {r}", s).to_dict())

        if wi > 0.6:
            log.append(AgentMessage("WEATHER_AGENT", "VETO", mission.id, w_reason, wi).to_dict())
        else:
            log.append(AgentMessage("WEATHER_AGENT", "BID", mission.id, w_reason, 1.0 - wi).to_dict())

        combo = coordinator.resolve(mission, ac_bids, crew_bids, wp_bids, wi if wi > 0.6 else 0.0, log)
        if combo:
            ac, cr, wp = combo
            used_ac.add(ac.id)
            used_cr.add(cr.id)
            base_ab = next((a for a in sc.airbases if a.id == ac.base), None)
            t_start = mission.time_window_start
            t_end   = t_start + datetime.timedelta(hours=mission.duration_hrs)
            assignments_out.append(Assignment(
                mission_id=mission.id,
                aircraft_id=ac.id,
                crew_id=cr.id,
                weapon_id=wp.id,
                start_zulu=t_start,
                end_zulu=t_end,
                route=_route(ac, mission, sc.airbases),
                reason=_reason(ac, cr, wp, mission, base_ab) if base_ab else "negotiated",
                confidence=0.9,
            ))

    # Replace best-option assignments with negotiated ones
    refined = copy.deepcopy(plan)
    for opt in refined.options:
        if opt.label == refined.best_option:
            opt.assignments = assignments_out
            opt.missions_covered = len(assignments_out)
            break

    return refined, log
