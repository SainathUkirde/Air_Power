# start-frontend.ps1
# Starts the TEMPO React frontend dev server on port 5173.
# Run from the repo root: .\start-frontend.ps1
# Make sure VITE_API_URL is set in frontend/.env (see frontend/.env.example).

Set-Location frontend
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created frontend/.env from .env.example."
    Write-Host "Edit VITE_API_URL if your backend is not on http://localhost:8000"
}
if (-not (Test-Path node_modules)) {
    Write-Host "Installing npm dependencies..."
    npm install
}
Write-Host "Starting TEMPO frontend on http://localhost:5173 ..."
Write-Host "Press Ctrl+C to stop."
npm run dev
