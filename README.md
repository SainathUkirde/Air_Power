# TEMPO – Air Operations Dynamic Retasking Console

> **EXERCISE – UNCLASSIFIED**
> Operational data is simulated. The data pipeline accepts real feeds.

TEMPO fuses aircraft availability, crew status, weapon loads, airspace, weather, threat intelligence and mission priorities into a single tactical picture. It predicts disruptions, optimises allocation via constraint programming, and re-plans live when something changes — while keeping the commander in the loop.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        TEMPO  (monorepo)                                 │
│                                                                          │
│  /frontend  React 18 + Vite + Tailwind + react-leaflet + Zustand        │
│    Offline SIM mode when backend unreachable (full mock-data fallback)  │
│    → Deploy on Vercel (CDN, zero-config SPA)                             │
│                                                                          │
│  /backend   Python FastAPI + OR-Tools CP-SAT + numpy + scikit-learn     │
│    CP-SAT optimiser  < 1 s  (12 AC / 10 CR / 8 MSN)                   │
│    Monte Carlo robustness  500 runs/plan                                 │
│    Multi-agent negotiation  bid / veto / award                           │
│    NL parser  regex + optional OpenAI GPT-4o-mini                       │
│    → Deploy on Render (free tier, Python web service)                    │
│                                                                          │
│  /data      Raw datasets · processed models · cached weather             │
│    seed_scenario.json  12 AC · 10 CR · 8 MSN · 4 airbases · 4 SAMs    │
│    fetch_weather.py    Open-Meteo → data/cache/                         │
│    train_cmapss.py     NASA C-MAPSS → data/processed/                   │
└──────────────────────────────────────────────────────────────────────────┘

Browser ──HTTPS──► Vercel CDN ──► React SPA
                                      │  VITE_API_URL
                                      ▼
                                Render Web Service ──► FastAPI
                                      │
                   ┌──────────────────┼──────────────────────┐
                   ▼                  ▼                       ▼
             CP-SAT solver     C-MAPSS model          Open-Meteo cache
             (ortools)         (joblib)                (weather_*.json)
```

---

## Data Sources

| Source | Type | Usage |
|--------|------|-------|
| [OurAirports](https://ourairports.com/data/) | Real | Airbase coordinates, runways, elevation — 4 Indian airfields: Poona VAPO, Lohegaon VABB, Nagpur VANP, Hyderabad VOHY |
| [Open-Meteo](https://open-meteo.com/) | Real | Hourly wind, cloud cover, visibility, precipitation; cached to `data/cache/` for offline use |
| [NASA C-MAPSS](https://data.nasa.gov/Aeropropulsion/CMAPSS-Jet-Engine-Simulated-Data/ff5v-kuh6) | Real (optional) | Turbofan degradation dataset; trains GBM failure-probability model. Synthetic fallback if not present. |
| 12 aircraft (VIPER/RAPTOR/HAWK/GHOST) | Synthetic | Fictional callsigns, roles, engine hours, weapon loads |
| 10 crews, 8 missions, 4 SAM threat zones | Synthetic | Fictional exercise scenario |

---

## Quick Start (local dev)

### Prerequisites
- Python ≥ 3.11
- Node.js ≥ 18

### Step 1 — Prepare data (first time only)

**Windows PowerShell:**
```powershell
cd data
python train_cmapss.py      # trains failure model  → data/processed/
python fetch_weather.py     # caches weather        → data/cache/
cd ..
```

**macOS / Linux (bash):**
```bash
cd data
python train_cmapss.py
python fetch_weather.py
cd ..
```

### Step 2 — Start the backend

**Windows PowerShell:**
```powershell
cd backend
Copy-Item .env.example .env    # edit ALLOWED_ORIGINS if needed
python -m uvicorn app.main:app --reload --port 8000
```

**macOS / Linux:**
```bash
cd backend
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/api/docs

### Step 3 — Start the frontend (new terminal)

**Windows PowerShell:**
```powershell
cd frontend
npm install
Copy-Item .env.example .env    # set VITE_API_URL=http://localhost:8000
npm run dev
```

**macOS / Linux:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App: http://localhost:5173

> **No backend?** Leave `VITE_API_URL` blank (or omit `.env`).
> The app runs in **OFFLINE SIM** mode on built-in mock data —
> all UI interactions work, no server needed.

### One-liner helper scripts

Two scripts are included for convenience:

**Windows — `start-backend.ps1`:**
```powershell
.\start-backend.ps1
```

**Windows — `start-frontend.ps1`:**
```powershell
.\start-frontend.ps1
```

---

## Deploy to Production

### Render (backend)

1. Fork / push this repo to GitHub.
2. Render → **New → Web Service** → connect repo.
3. **Root Directory:** `backend`
4. **Build Command:**
   ```
   pip install -r requirements.txt
   ```
   Then add a pre-deploy hook or include in build:
   ```
   cd ../data && python train_cmapss.py && python fetch_weather.py
   ```
   Or simply commit the pre-generated files from `data/processed/` and `data/cache/` — they are already committed in this repo so the backend starts without downloading anything.
5. **Start Command:**
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
6. **Environment variables:**

   | Key | Value |
   |-----|-------|
   | `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
   | `SEED` | `42` |
   | `OPENAI_API_KEY` | *(optional)* |

7. **Health check path:** `/api/health`
8. Copy the service URL (e.g. `https://tempo-backend.onrender.com`).

> **Free tier cold-start:** First request after inactivity takes ~15–30 s.
> The frontend shows a **WAKING SERVER…** badge and polls until alive.

### Vercel (frontend)

1. Vercel → **New Project** → import this repo → **Root Directory** = `frontend`.
2. **Environment variable:**

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://tempo-backend.onrender.com` |

3. Deploy. Vercel auto-detects Vite from `vercel.json`.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health, model status |
| GET | `/api/scenario` | Full fused scenario state |
| POST | `/api/plan` | Generate optimised plan A/B/C `{ priority_weight, include_robustness }` |
| POST | `/api/disruption` | Inject disruption, return new plan + diff |
| GET | `/api/predictions` | Aircraft failure probs + mission risk |
| POST | `/api/robustness` | Monte Carlo on submitted plan `{ plan, n_runs }` |
| POST | `/api/nl` | NL/voice command `{ text, commit }` |
| POST | `/api/negotiate` | Multi-agent negotiation |
| GET | `/api/advisory` | Pre-emptive advisory cards with backup plans |
| POST | `/api/contested` | Toggle contested mode `{ enable, jammed_sources }` |

Full interactive docs: `GET /api/docs`

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `I` | Open INJECT DISRUPTION modal |
| `A` | Accept pending plan diff |
| `R` | Reject pending plan diff |
| `M` | Toggle NL command bar (mic + typed) |
| `C` | Toggle CONTESTED mode |
| `Esc` | Close open modal / NL bar |

---

## Features

### Core
1. **Mission allocation** — aircraft + crew + weapon + route + time slot per mission; map + Gantt timeline
2. **Dynamic re-tasking** — disruption → CP-SAT re-optimise → diff with reasons → Accept / Reject
3. **Plan options A / B / C** — scored on coverage, utilisation, risk; priority ↔ risk slider (debounced)
4. **Decision explanations** — one-line reason per assignment (range fit, weapon match, crew duty)
5. **Predictions** — C-MAPSS failure probability, Open-Meteo weather impact, threat approach

### Extra Five
6. **Multi-agent negotiation** — AircraftAgent / CrewAgent / WeaponsAgent / WeatherAgent bid and veto; CoordinatorAgent resolves (priority → risk → scarcity); animated log streams in real-time
7. **Monte Carlo robustness** — 500 runs per plan, survival %, 20-bin histogram, top-3 failure causes, weakest mission
8. **Voice + NL** — Web Speech API mic + typed fallback; WHAT-IF (no state change) vs COMMIT; OpenAI or regex parser; command history; rotating placeholders
9. **Pre-emptive advisories** — C-MAPSS + weather + threat → advisory cards; HIGH/CRITICAL cards include a one-click backup plan
10. **Contested-environment mode** — jamming polygon on map; per-source confidence %, data age; LOW CONF tags on diff lines; fallback to mock state offline

---

## Demo Script

Full end-to-end walkthrough (~5 minutes):

```
1. LOAD SCENARIO
   Open http://localhost:5173
   Top strip: "EXERCISE IRON MONSOON", resource bars show 12 AC / 10 CR
   Map loads: 4 airbases, 4 SAM threat rings (red dashed circles), 8 targets
   Gantt timeline: 12 aircraft rows, initial mission assignments

2. PLAN GENERATED
   Right panel DIFF tab: initial assignments with one-line reasons
   Switch tabs A / B / C — robustness bars: Plan A 87%, B 61%, C 74%
   Right panel ROB tab: histogram comparison, failure causes, weakest mission

3. ADVISORY WARNS
   Left panel ADVISORIES: "VIPER 12 maint risk 52% in 1.5 hrs"
   Click advisory → right panel switches to PRED tab
   PRED → ADV sub-tab → card with LOAD backup button

4. INJECT DISRUPTION  [press I]
   Select: Aircraft Unserviceable / VIPER 12 / HIGH / "hydraulic failure"
   Click INJECT
   2-second recomputing overlay with stage progress bar
   Left feed: new entry appears
   Right DIFF tab: auto-activates, BEFORE → AFTER for affected missions

5. NEGOTIATION LOG
   Right panel → NEG tab → press RUN
   Watch log stream: BID (green), VETO (red), AWARD (amber) animate in
   Stats row: AWARDED / VETOED / RESOLVED / elapsed time

6. NEW PLAN + DIFF
   DIFF tab: "PENDING DIFF" badge, 2 changes shown
   Press A to ACCEPT → diff committed, history records snapshot
   Press R to REJECT → reverts without applying

7. ROBUSTNESS COMPARE A vs B
   ROB tab: Plan A 84% survival vs Plan B 58%
   Histogram shows distribution of outcomes across 500 MC runs

8. VOICE WHAT-IF  [press M]
   NL command bar opens
   Type: "What if GHOST 41 is unavailable?"
   WHAT-IF badge (amber): explanation shown, no state change
   Toggle to COMMIT → resend → diff appears, state changes

9. ENABLE CONTESTED MODE  [press C]
   Map: red "CONTESTED ENVIRONMENT ACTIVE" banner + source badges
   Top strip: RAD LOST, IFF LOST, WX DEGRADED badges appear
   Re-run plan: assignments tagged LOW CONF in diff

10. FINAL ACCEPT
    DIFF tab → ACCEPT  [A]
    HISTORY tab: snapshot saved with Zulu timestamp
    STATS tab: SYSTEM PLAN TIME 230ms vs MANUAL 18 MIN
```

---

## Running Tests

**Windows PowerShell:**
```powershell
cd backend
python test_phase1.py    # 43 tests  – scenario, plan, disruption, predictions
python test_phase3.py    # 39 tests  – disruption → diff → replan flow
python test_phase4.py    # 140 tests – negotiation, robustness, advisory
python test_phase5.py    # 81 tests  – NL parser, contested mode
# Total: 303 tests, 0 failures
```

---

## Project Structure

```
26250/
├── README.md
├── start-backend.ps1              PowerShell convenience script
├── start-frontend.ps1             PowerShell convenience script
├── frontend/
│   ├── vercel.json
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx
│       ├── api/client.js              fetch + cold-start polling
│       ├── store/useStore.js          Zustand state + all actions
│       ├── hooks/useKeyboardShortcuts.js
│       ├── utils/format.js
│       ├── mock/data.js               full offline dataset
│       └── components/
│           ├── TopStrip.jsx           resource bars + Zulu clock
│           ├── TacticalMap.jsx        Leaflet map
│           ├── ContestedOverlay.jsx   source confidence badges
│           ├── GanttTimeline.jsx      per-aircraft mission bars
│           ├── LeftPanel.jsx          feed + advisories + inject
│           ├── RightPanel.jsx         tabbed: DIFF/ROB/NEG/PRED/STATS/HIST
│           ├── NegotiationPanel.jsx   animated agent log
│           ├── RobustnessPanel.jsx    MC histogram comparison
│           ├── PredictionsPanel.jsx   risk cards + advisory + backup
│           ├── NLCommandBar.jsx       voice + typed command bar
│           ├── DisruptModal.jsx       disruption injection form
│           ├── PrioritySlider.jsx     priority vs risk slider
│           ├── RecomputingOverlay.jsx stage progress overlay
│           └── Footer.jsx             classification + shortcuts
├── backend/
│   ├── render.yaml
│   ├── .env.example
│   ├── requirements.txt
│   ├── test_phase1.py  test_phase3.py  test_phase4.py  test_phase5.py
│   └── app/
│       ├── main.py
│       ├── models/domain.py           all Pydantic types
│       ├── services/
│       │   ├── scenario.py            seed loader + disruption state
│       │   ├── optimiser.py           CP-SAT + greedy fallback
│       │   ├── predictions.py         C-MAPSS model + weather impact
│       │   ├── robustness.py          Monte Carlo
│       │   ├── negotiation.py         multi-agent bid/veto/award
│       │   └── nl_parser.py           regex + OpenAI NL parser
│       └── routers/
│           ├── scenario.py  health.py  plan.py  disruption.py
│           ├── predictions.py  robustness.py  nl.py
│           └── contested.py  negotiate.py  advisory.py
└── data/
    ├── seed_scenario.json
    ├── fetch_weather.py
    ├── train_cmapss.py
    ├── raw/                    place train_FD001.txt here (optional)
    ├── processed/              cmapss_model.joblib (committed)
    └── cache/                  weather_*.json (committed)
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `SEED` | `42` | Deterministic seed for optimiser |
| `OPENAI_API_KEY` | *(empty)* | Optional — enables GPT-4o-mini NL parser |
| `LOG_LEVEL` | `info` | uvicorn log level |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | *(empty)* | Backend base URL; empty = OFFLINE SIM mode |

---

## Notes

- **PowerShell:** Use `;` to chain commands, not `&&`. Example: `cd backend; python -m uvicorn app.main:app --port 8000`
- **Render cold-start:** Free tier sleeps after inactivity. The `WAKING SERVER…` badge in the UI polls until alive (up to 30 s), then switches to `LINK LIVE`.
- **OpenAI key:** Optional. Without it, the NL parser uses a regex rule engine that handles all demo commands. Set `OPENAI_API_KEY` in `backend/.env` for richer natural-language understanding.
- **C-MAPSS dataset:** Optional. Without `data/raw/train_FD001.txt`, the model trains on synthetic turbofan data (already done — `data/processed/cmapss_model.joblib` is committed). Place the real file and re-run `python data/train_cmapss.py` to use actual NASA data.

---

*TEMPO was built as a complete, working, deployable project — no TODOs, no stubs, no placeholders.*
