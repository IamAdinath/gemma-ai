"""
main.py — FastAPI application entry point.

Responsibilities:
  - Create the FastAPI app instance
  - Register all API routers (namespaced under /api/*)
  - Mount the ui/ directory as static files at root "/"
  - Configure CORS
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import ALLOWED_ORIGINS, UI_DIR
from api.routes import context, tools

app = FastAPI(
    title="Gemma AI Backend",
    description="Local agentic AI backend — serves UI and tool execution APIs.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ───────────────────────────────────────────────────────────────
app.include_router(context.router)
app.include_router(tools.router)

# ── Static UI (must be last — catch-all) ─────────────────────────────────────
app.mount("/", StaticFiles(directory=str(UI_DIR), html=True), name="ui")
