"""
api/routes/tools.py
Namespace: /api/tools
Exposes sandboxed tool execution endpoints used by the agentic loop in the UI.
"""
from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl

from core import tool_runner

router = APIRouter(prefix="/api/tools", tags=["tools"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RunPythonRequest(BaseModel):
    code: str


class RunPythonResponse(BaseModel):
    output: str


class FetchUrlResponse(BaseModel):
    url: str
    content: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run_python", response_model=RunPythonResponse)
async def run_python(payload: RunPythonRequest) -> RunPythonResponse:
    """
    Execute Python 3 code in a sandboxed subprocess.
    Returns stdout/stderr truncated to 2000 chars.
    Enforces a hard 5-second timeout.
    """
    result = tool_runner.run_python(payload.code)
    return RunPythonResponse(output=result.get("output", result.get("error", "Unknown error")))


@router.get("/fetch_url", response_model=FetchUrlResponse)
async def fetch_url(url: str) -> FetchUrlResponse:
    """
    Fetch a remote URL and return readable plain-text content (HTML stripped).
    Content is capped at 4000 characters to stay within context window limits.
    """
    result = tool_runner.fetch_url(url)
    if "error" in result:
        return FetchUrlResponse(url=url, content=f"Error: {result['error']}")
    return FetchUrlResponse(url=result["url"], content=result["content"])
