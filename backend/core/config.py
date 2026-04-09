from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent          # backend/
DATA_DIR = BASE_DIR / "data"
CONTEXTS_DIR = DATA_DIR / "contexts"
UI_DIR = BASE_DIR.parent / "ui"
UI_BUILD_DIR = UI_DIR / "dist"

# ── Server ─────────────────────────────────────────────────────────────────────
PORT: int = 8000
HOST: str = "0.0.0.0"

# ── Tool Sandboxing ────────────────────────────────────────────────────────────
PYTHON_EXEC_TIMEOUT: int = 5       # seconds
URL_FETCH_TIMEOUT: int = 8         # seconds
URL_CONTENT_MAX_CHARS: int = 4000  # truncate long pages

# ── CORS ───────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:8000",   # FastAPI self (production)
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]
