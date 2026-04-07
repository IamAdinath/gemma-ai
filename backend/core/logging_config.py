"""
core/logging_config.py
Centralised logging setup for the Gemma AI backend.

Usage (in any module):
    from core.logging_config import get_logger
    logger = get_logger(__name__)
"""
import logging
import sys
from datetime import datetime


# ── ANSI colour codes ──────────────────────────────────────────────────────────
RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"

BLACK   = "\033[30m"
RED     = "\033[31m"
GREEN   = "\033[32m"
YELLOW  = "\033[33m"
BLUE    = "\033[34m"
MAGENTA = "\033[35m"
CYAN    = "\033[36m"
WHITE   = "\033[37m"

LEVEL_COLOURS = {
    "DEBUG":    DIM + WHITE,
    "INFO":     CYAN,
    "WARNING":  YELLOW,
    "ERROR":    RED,
    "CRITICAL": BOLD + RED,
}

# Maps logger name prefixes → label colours for easy module identification
MODULE_COLOURS = {
    "api.routes.chats":   MAGENTA,
    "api.routes.context": BLUE,
    "api.routes.tools":   GREEN,
    "core.tool_runner":   GREEN,
    "main":               CYAN,
}


class ColourFormatter(logging.Formatter):
    """Custom formatter that adds colours, timestamps, and module labels."""

    def format(self, record: logging.LogRecord) -> str:
        level_colour = LEVEL_COLOURS.get(record.levelname, WHITE)
        # Shorten logger name for display
        name = record.name.replace("api.routes.", "").replace("core.", "")
        module_colour = next(
            (v for k, v in MODULE_COLOURS.items() if record.name.startswith(k)),
            WHITE,
        )

        ts        = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
        level     = f"{level_colour}{record.levelname:<8}{RESET}"
        module    = f"{module_colour}{name:<16}{RESET}"
        message   = record.getMessage()

        # Attach exception info if present
        if record.exc_info:
            message += "\n" + self.formatException(record.exc_info)

        return f"{DIM}{ts}{RESET}  {level}  {module}  {message}"


def setup_logging(level: str = "INFO") -> None:
    """Call once at application startup."""
    root = logging.getLogger()
    root.setLevel(level)

    # Remove any existing handlers (e.g. uvicorn's defaults)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColourFormatter())
    root.addHandler(handler)

    # Quieten noisy third-party loggers
    for noisy in ("uvicorn.access", "uvicorn.error", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger. Call at module level: logger = get_logger(__name__)"""
    return logging.getLogger(name)
