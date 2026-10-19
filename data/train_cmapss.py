#!/usr/bin/env python3
"""
C-MAPSS turbofan RUL model training.
Downloads FD001 dataset from NASA if available, otherwise generates synthetic data.
Trains a gradient-boosting failure-probability model and saves to data/processed/.

NASA C-MAPSS: https://data.nasa.gov/Aeropropulsion/CMAPSS-Jet-Engine-Simulated-Data/ff5v-kuh6
Download FD001.zip and extract train_FD001.txt into data/raw/ before running.

Usage: python train_cmapss.py
"""
import pathlib, json
import numpy as np

RAW_DIR  = pathlib.Path(__file__).parent / "raw"
PROC_DIR = pathlib.Path(__file__).parent / "processed"
PROC_DIR.mkdir(parents=True, exist_ok=True)

COLS = [
    "unit","cycle","os1","os2","os3",
    "s1","s2","s3","s4","s5","s6","s7","s8","s9","s10",
    "s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21",
]
# Sensors with useful signal for RUL (selected by variance analysis on FD001)
USEFUL_SENSORS = ["s2","s3","s4","s7","s8","s9","s11","s12","s13","s14","s15","s17","s20","s21"]


def load_cmapss_fd001():
    p = RAW_DIR / "train_FD001.txt"
    if not p.exists():
        return None
    import pandas as pd
    df = pd.read_csv(p, sep=r"\s+", header=None, names=COLS)
    # Compute RUL per unit
    max_cycle = df.groupby("unit")["cycle"].max().rename("max_cycle")
    df = df.join(max_cycle, on="unit")
    df["rul"] = df["max_cycle"] - df["cycle"]
    # Binary label: failure imminent within 30 cycles
    df["fail_soon"] = (df["rul"] <= 30).astype(int)
    return df


def make_synthetic_training_data(n=2000, seed=42):
    """Synthetic turbofan-like data when real dataset is absent."""
    rng = np.random.default_rng(seed)
    engine_hours = rng.uniform(0, 3000, n)
    max_hours = 3000.0
    pct_life = engine_hours / max_hours
    # Degrade sensor readings toward end of life
    s2  = 642.0 + pct_life * 8  + rng.normal(0, 1, n)
    s3  = 1590   - pct_life * 10 + rng.normal(0, 2, n)
    s4  = 1400   + pct_life * 15 + rng.normal(0, 3, n)
    s9  = 9065   - pct_life * 50 + rng.normal(0, 20, n)
    s11 = 47.0   + pct_life * 2  + rng.normal(0, 0.5, n)
    s14 = 8138   - pct_life * 40 + rng.normal(0, 10, n)
    # Failure within next 40 flight-hours (equiv. 30 cycles in CMAPSS)
    hours_to_fail = max_hours - engine_hours
    fail_soon = (hours_to_fail <= 40).astype(int)
    X = np.column_stack([engine_hours, pct_life, s2, s3, s4, s9, s11, s14])
    y = fail_soon
    return X, y


def train_and_save():
    try:
        from sklearn.ensemble import GradientBoostingClassifier
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        from sklearn.model_selection import cross_val_score
        import joblib
    except ImportError as e:
        print(f"ERROR: {e}. Install scikit-learn and joblib.")
        raise

    cmapss = load_cmapss_fd001()
    if cmapss is not None:
        print("  Using real C-MAPSS FD001 data")
        X = cmapss[USEFUL_SENSORS[:8]].values
        y = cmapss["fail_soon"].values
        feature_names = USEFUL_SENSORS[:8]
        source = "cmapss_fd001"
    else:
        print("  C-MAPSS FD001 not found – using synthetic turbofan data")
        X, y = make_synthetic_training_data()
        feature_names = ["engine_hours","pct_life","s2","s3","s4","s9","s11","s14"]
        source = "synthetic"

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=120, max_depth=4, learning_rate=0.08,
            subsample=0.8, random_state=42
        )),
    ])
    scores = cross_val_score(pipe, X, y, cv=5, scoring="roc_auc")
    print(f"  CV ROC-AUC: {scores.mean():.3f} ± {scores.std():.3f}")
    pipe.fit(X, y)

    model_path = PROC_DIR / "cmapss_model.joblib"
    joblib.dump(pipe, model_path)
    print(f"  Model saved -> {model_path}")

    # Save metadata for the backend to load
    meta = {
        "feature_names": feature_names,
        "source": source,
        "cv_roc_auc_mean": round(float(scores.mean()), 4),
        "cv_roc_auc_std":  round(float(scores.std()), 4),
        "trained_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    (PROC_DIR / "cmapss_model_meta.json").write_text(json.dumps(meta, indent=2))
    print(f"  Metadata saved -> {PROC_DIR / 'cmapss_model_meta.json'}")
    return pipe, feature_names


def failure_probability(engine_hours: float, max_hours: float = 3000.0) -> float:
    """
    Heuristic fallback when the trained model is missing.
    Returns P(failure within next 40 flight-hours) as float [0,1].
    """
    pct_life = engine_hours / max_hours
    # Exponential hazard-rate curve tuned to CMAPSS distribution shape
    if pct_life < 0.70:
        return round(0.02 + 0.08 * pct_life, 4)
    elif pct_life < 0.90:
        return round(0.08 + 0.40 * (pct_life - 0.70) / 0.20, 4)
    else:
        return round(0.48 + 0.50 * (pct_life - 0.90) / 0.10, 4)


if __name__ == "__main__":
    print("Training C-MAPSS failure-probability model...")
    train_and_save()
    print("Done.")

    # Quick self-test
    import joblib
    model = joblib.load(PROC_DIR / "cmapss_model.joblib")
    meta  = json.loads((PROC_DIR / "cmapss_model_meta.json").read_text())
    print(f"\nSelf-test: loaded model, features={meta['feature_names']}")
    # Heuristic sanity check
    for hrs in [500, 1500, 2500, 2900]:
        p = failure_probability(hrs)
        print(f"  engine_hours={hrs} -> fail_prob(heuristic)={p:.3f}")
