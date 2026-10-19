"""
TEMPO – Air Operations Dynamic Retasking Console
FastAPI application entry point.
"""
from __future__ import annotations
import os, logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "info").upper())
log = logging.getLogger("tempo")

from app.services import scenario as sc_svc
from app.routers import (
    scenario, plan, disruption, predictions,
    robustness, nl, contested, health, negotiate, advisory,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("TEMPO backend starting – loading scenario…")
    sc_svc.load()
    log.info(f"Scenario loaded: {sc_svc.get().name}")
    yield
    log.info("TEMPO backend shutting down")


app = FastAPI(
    title="TEMPO – Air Ops Retasking Console",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS – allow frontend origins
origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api
for router_mod in [scenario, plan, disruption, predictions, robustness, nl, contested, health, negotiate, advisory]:
    app.include_router(router_mod.router, prefix="/api")
