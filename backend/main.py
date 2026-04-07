import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import ALLOWED_ORIGINS, UI_DIR
from core.logging_config import setup_logging, get_logger
from api.routes import context, tools, chats

setup_logging(level="INFO")
logger = get_logger("main")

app = FastAPI(
    title="Gemma AI Backend",
    description="Local agentic AI backend — serves UI and tool execution APIs.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    # Colour-code by status
    status = response.status_code
    if status < 300:
        status_str = f"\033[32m{status}\033[0m"
    elif status < 400:
        status_str = f"\033[33m{status}\033[0m"
    else:
        status_str = f"\033[31m{status}\033[0m"

    logger.info(
        "%s  %s  %s  \033[2m%.1fms\033[0m",
        request.method.ljust(6),
        status_str,
        request.url.path,
        elapsed_ms,
    )
    return response


@app.on_event("startup")
async def on_startup():
    logger.info("\033[1;32m✓ Gemma AI backend started\033[0m")
    logger.info("  Docs → \033[34mhttp://localhost:8000/docs\033[0m")


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("\033[1;31m✗ Gemma AI backend shutting down\033[0m")


app.include_router(context.router)
app.include_router(tools.router)
app.include_router(chats.router)

app.mount("/", StaticFiles(directory=str(UI_DIR), html=True), name="ui")
