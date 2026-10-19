#!/usr/bin/env python3
"""
Fetch and cache Open-Meteo weather for all scenario locations.
Run once to populate data/cache/weather_*.json before deployment.
Usage: python fetch_weather.py
"""
import json, pathlib, sys, time
from datetime import datetime, timezone

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

CACHE_DIR = pathlib.Path(__file__).parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude={lat}&longitude={lon}"
    "&hourly=windspeed_10m,winddirection_10m,cloudcover,visibility,precipitation"
    "&wind_speed_unit=ms&forecast_days=1&timezone=UTC"
)


def fetch_weather(lat: float, lon: float, name: str) -> dict:
    """Fetch hourly forecast from Open-Meteo; returns dict with data + metadata."""
    url = OPEN_METEO_URL.format(lat=lat, lon=lon)
    if not HAS_REQUESTS:
        raise RuntimeError("requests not installed")
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    payload = resp.json()
    return {
        "source": "open-meteo",
        "location": name,
        "lat": lat,
        "lon": lon,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "hourly": payload.get("hourly", {}),
    }


def synthetic_weather(lat: float, lon: float, name: str) -> dict:
    """Fallback: generate plausible monsoon-season weather synthetically."""
    hours = [f"2024-10-14T{h:02d}:00" for h in range(24)]
    import random, math
    rng = random.Random(abs(int(lat * 1000 + lon * 100)))
    return {
        "source": "synthetic-fallback",
        "location": name,
        "lat": lat,
        "lon": lon,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "hourly": {
            "time": hours,
            "windspeed_10m":    [round(4 + rng.gauss(0, 2), 1) for _ in hours],
            "winddirection_10m":[round(rng.uniform(180, 270), 1) for _ in hours],
            "cloudcover":       [min(100, max(0, int(40 + rng.gauss(0, 20)))) for _ in hours],
            "visibility":       [round(max(1000, 9000 + rng.gauss(0, 2000)), 0) for _ in hours],
            "precipitation":    [round(max(0, rng.gauss(0.5, 0.5)), 2) for _ in hours],
        },
    }


def main():
    seed = json.loads((pathlib.Path(__file__).parent / "seed_scenario.json").read_text())
    coords = seed["weather_cache_coords"]

    for loc in coords:
        cache_file = CACHE_DIR / f"weather_{loc['name'].lower()}.json"
        print(f"  {loc['name']} ({loc['lat']}, {loc['lon']}) -> ", end="", flush=True)
        try:
            data = fetch_weather(loc["lat"], loc["lon"], loc["name"])
            print("OK (live)")
        except Exception as exc:
            print(f"FALLBACK ({exc})")
            data = synthetic_weather(loc["lat"], loc["lon"], loc["name"])
        cache_file.write_text(json.dumps(data, indent=2))
        time.sleep(0.4)   # respect Open-Meteo rate limit

    print(f"\nWeather cached to {CACHE_DIR}")


if __name__ == "__main__":
    main()
