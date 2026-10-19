# start-backend.ps1
# Starts the TEMPO FastAPI backend on port 8000.
# Run from the repo root: .\start-backend.ps1

Set-Location backend
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created backend/.env from .env.example — edit ALLOWED_ORIGINS if needed."
}
Write-Host "Starting TEMPO backend on http://localhost:8000 ..."
Write-Host "API docs: http://localhost:8000/api/docs"
Write-Host "Press Ctrl+C to stop."
python -m uvicorn app.main:app --reload --port 8000
