import re
import subprocess
import urllib.request
import urllib.parse
from html import unescape
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

def _search_web_fallback(query: str) -> list[dict[str, str]]:
    """
    Fallback search path using DuckDuckGo's HTML endpoint.
    This is less structured than the API-backed library, but it keeps
    web access available when the primary endpoint is rate-limited.
    """
    encoded_query = urllib.parse.urlencode({"q": query})
    url = f"https://html.duckduckgo.com/html/?{encoded_query}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    with httpx.Client(follow_redirects=True, timeout=URL_FETCH_TIMEOUT, headers=headers) as client:
        response = client.get(url)
        response.raise_for_status()
        html = response.text

    pattern = re.compile(
        r'<a[^>]+class="result__a"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>.*?'
        r'<a[^>]+class="result__snippet"[^>]*>(?P<body>.*?)</a>',
        flags=re.DOTALL | re.IGNORECASE,
    )
    results = []
    for match in pattern.finditer(html):
        raw_href = urllib.parse.unquote(match.group("href"))
        parsed_href = urllib.parse.urlparse(raw_href)
        href_query = urllib.parse.parse_qs(parsed_href.query)
        href = href_query.get("uddg", [raw_href])[0]
        title = unescape(_strip_html(match.group("title")))
        body = unescape(_strip_html(match.group("body")))
        if "duckduckgo.com/y.js" in href or "ad_domain=" in href:
            continue
        if title and href:
            results.append({"title": title, "href": href, "body": body})
        if len(results) >= 5:
            break
    return results


def search_web(query: str) -> dict[str, Any]:
    """
    Search the web using DuckDuckGo via duckduckgo_search.
    Returns the top 5 results as a formatted string.
    """
    try:
        try:
            results = list(DDGS().text(query, max_results=5))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Primary search failed, using fallback  err=%s", exc)
            results = _search_web_fallback(query)

        if not results:
            return {"results": f"No results found for: {query}. Try fetch_url with a direct website."}

        parsed = []
        for r in results:
            parsed.append(f"Title: {r.get('title')}\nURL: {r.get('href')}\nSnippet: {r.get('body')}")

        return {"query": query, "results": "\n\n".join(parsed)}
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Search engine error: {str(exc)}"}
