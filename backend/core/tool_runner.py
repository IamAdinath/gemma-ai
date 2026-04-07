import re
import subprocess
import urllib.request
import urllib.parse
from typing import Any

import httpx
from duckduckgo_search import DDGS

from core.config import (
    PYTHON_EXEC_TIMEOUT,
    URL_FETCH_TIMEOUT,
    URL_CONTENT_MAX_CHARS,
)
from core.logging_config import get_logger

logger = get_logger(__name__)



def _strip_html(html: str) -> str:
    """Remove tags and collapse whitespace, capped to URL_CONTENT_MAX_CHARS."""
    text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:URL_CONTENT_MAX_CHARS]



def run_python(code: str) -> dict[str, Any]:
    """
    Execute arbitrary Python 3 code in a subprocess.
    Returns stdout/stderr, capped at 2000 chars.
    Timeout is enforced via PYTHON_EXEC_TIMEOUT.
    """
    try:
        result = subprocess.run(
            ["python3", "-c", code],
            capture_output=True,
            text=True,
            timeout=PYTHON_EXEC_TIMEOUT,
        )
        output = result.stdout or result.stderr or "(no output)"
        if result.returncode != 0:
            logger.warning("Tool warning    tool=run_python  exit=%d", result.returncode)
        else:
            logger.info("Tool success    tool=run_python  exit=0")
        return {"output": output[:2000]}
    except subprocess.TimeoutExpired:
        logger.error("Tool timeout    tool=run_python  timeout=%ds", PYTHON_EXEC_TIMEOUT)
        return {"output": f"Error: execution timed out after {PYTHON_EXEC_TIMEOUT}s"}
    except Exception as exc:  # noqa: BLE001
        logger.error("Tool error      tool=run_python  err=%s", exc)
        return {"error": str(exc)}


def fetch_url(url: str) -> dict[str, Any]:
    """
    Fetch a URL and return stripped plain-text content.
    Uses a browser-like User-Agent to avoid simple bot blocks.
    """
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (compatible; GemmaBot/1.0)"}
        )
        with urllib.request.urlopen(req, timeout=URL_FETCH_TIMEOUT) as resp:
            raw_html = resp.read().decode("utf-8", errors="ignore")
        return {"url": url, "content": _strip_html(raw_html)}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}

def search_web(query: str) -> dict[str, Any]:
    """
    Search the web using DuckDuckGo via duckduckgo_search.
    Returns the top 5 results as a formatted string.
    """
    try:
        results = DDGS().text(query, max_results=5)
        if not results:
            return {"results": f"No results found for: {query}. Try fetch_url with a direct website."}
        
        parsed = []
        for r in results:
            parsed.append(f"Title: {r.get('title')}\nURL: {r.get('href')}\nSnippet: {r.get('body')}")
        
        return {"query": query, "results": "\n\n".join(parsed)}
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Search engine error: {str(exc)}"}
