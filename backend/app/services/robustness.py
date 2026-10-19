"""
Monte Carlo robustness evaluation.
Runs N simulations of a plan under random perturbations and returns
survival %, failure causes, histogram of coverage outcomes.
"""
from __future__ import annotations
import numpy as np
from app.models.domain import PlanResult, PlanOption, RobustnessResult


def _simulate_once(option: PlanOption, rng: np.random.Generator) -> tuple[int, list[str]]:
    """
    Returns (missions_survived, list_of_failure_cause_labels).
    Perturbations: aircraft failure, weather shift, threat expansion, crew delay.
    """
    survived   = 0
    causes: list[str] = []

    for asgn in option.assignments:
        fail = False

        # Aircraft engine failure
        if rng.random() < max(0.0, asgn.confidence * 0.08 * (1 + (1 - asgn.confidence))):
            fail = True; causes.append("aircraft_failure")

        # Weather degrades route (random 15% chance per assignment)
        if not fail and rng.random() < 0.15:
            fail = True; causes.append("weather_shift")

        # Crew scheduling delay (10% chance)
        if not fail and rng.random() < 0.10:
            fail = True; causes.append("crew_delay")

        # Threat zone expands into route (8% chance)
        if not fail and rng.random() < 0.08:
            fail = True; causes.append("threat_expansion")

        if not fail:
            survived += 1

    return survived, causes


def evaluate(plan: PlanResult, n_runs: int = 500, seed: int = 42) -> list[RobustnessResult]:
    """Evaluate each plan option and return RobustnessResult per option."""
    results: list[RobustnessResult] = []

    for option in plan.options:
        rng = np.random.default_rng(seed)
        total_possible = max(1, option.missions_covered)
        survival_counts: list[int] = []
        all_causes: list[str] = []

        for _ in range(n_runs):
            s, c = _simulate_once(option, rng)
            survival_counts.append(s)
            all_causes.extend(c)

        survival_arr = np.array(survival_counts)
        # "Survival" = all assigned missions complete
        full_survival = int(np.sum(survival_arr == total_possible))
        survival_pct  = round(full_survival / n_runs * 100, 1)

        # Top 3 causes by frequency
        cause_counts: dict[str,int] = {}
        for cause in all_causes:
            cause_counts[cause] = cause_counts.get(cause, 0) + 1
        top3 = [c for c, _ in sorted(cause_counts.items(), key=lambda x: -x[1])[:3]]

        # Weakest mission = one that fails most across runs; proxy by index
        if option.assignments:
            # Track per-assignment failure rate
            per_assign_fails = np.zeros(len(option.assignments))
            rng2 = np.random.default_rng(seed)
            for _ in range(n_runs):
                _, causes_this = _simulate_once(option, rng2)
                for i, asgn in enumerate(option.assignments):
                    # assign failure evenly to a random assignment
                    if causes_this:
                        idx = rng2.integers(0, len(option.assignments))
                        per_assign_fails[idx] += 1
            weakest_idx    = int(np.argmax(per_assign_fails))
            weakest_mid    = option.assignments[weakest_idx].mission_id
        else:
            weakest_mid = "N/A"

        # 20-bin histogram of coverage counts
        bins, _     = np.histogram(survival_arr, bins=20, range=(0, total_possible))
        histogram   = [round(float(b) / n_runs, 4) for b in bins]

        results.append(RobustnessResult(
            plan_id=f"{plan.plan_id}-{option.label}",
            survival_pct=survival_pct,
            top_failure_causes=top3,
            weakest_mission=weakest_mid,
            histogram=histogram,
            n_runs=n_runs,
        ))

    return results


def attach_robustness(plan: PlanResult, n_runs: int = 500, seed: int = 42) -> PlanResult:
    """Mutate plan in-place, adding robustness scores to each option."""
    rob_results = evaluate(plan, n_runs=n_runs, seed=seed)
    for option, rob in zip(plan.options, rob_results):
        option.robustness_score     = rob.survival_pct
        option.robustness_histogram = rob.histogram
        option.top_failure_causes   = rob.top_failure_causes
        option.weakest_mission      = rob.weakest_mission
    return plan
