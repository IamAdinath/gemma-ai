from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl

from core import tool_runner
from core.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/tools", tags=["tools"])



class RunPythonRequest(BaseModel):
    code: str


class RunPythonResponse(BaseModel):
    output: str


class FetchUrlResponse(BaseModel):
    url: str
    content: str

class SearchWebResponse(BaseModel):
    query: str
    results: str

@router.post("/run_python", response_model=RunPythonResponse)
async def run_python(payload: RunPythonRequest) -> RunPythonResponse:
    """
    Execute Python 3 code in a sandboxed subprocess.
    Returns stdout/stderr truncated to 2000 chars.
    Enforces a hard 5-second timeout.
    """
    logger.info("Tool invoked    tool=run_python  code_len=%d", len(payload.code))
    result = tool_runner.run_python(payload.code)
    return RunPythonResponse(output=result.get("output", result.get("error", "Unknown error")))


@router.get("/fetch_url", response_model=FetchUrlResponse)
async def fetch_url(url: str) -> FetchUrlResponse:
    """
    Fetch a remote URL and return readable plain-text content (HTML stripped).
    Content is capped at 4000 characters to stay within context window limits.
    """
    logger.info("Tool invoked    tool=fetch_url  url=%s", url)
    result = tool_runner.fetch_url(url)
    if "error" in result:
        logger.warning("Tool error      tool=fetch_url  err=%s", result["error"])
        return FetchUrlResponse(url=url, content=f"Error: {result['error']}")
    logger.info("Tool success    tool=fetch_url  bytes=%d", len(result["content"]))
    return FetchUrlResponse(url=result["url"], content=result["content"])

@router.get("/search_web", response_model=SearchWebResponse)
async def search_web(query: str) -> SearchWebResponse:
    """Search DuckDuckGo via duckduckgo_search lib."""
    logger.info("Tool invoked    tool=search_web  query=%s", query)
    result = tool_runner.search_web(query)
    if "error" in result:
        logger.warning("Tool error      tool=search_web  err=%s", result["error"])
        return SearchWebResponse(query=query, results=f"Error: {result['error']}")
    logger.info("Tool success    tool=search_web")
    return SearchWebResponse(query=result["query"], results=result["results"])
