"""
api/routes/chats.py
Namespace: /api/chats
Manages per-session chat history as individual JSON files in backend/data/chats/.
"""
import json
from fastapi import APIRouter, HTTPException, Request, Response
from core.config import DATA_DIR
from core.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/chats", tags=["chats"])

CHATS_DIR = DATA_DIR / "chats"


def _safe_id(session_id: str) -> str:
    """Sanitise session ID to prevent path traversal."""
    return "".join(c for c in session_id if c.isalnum() or c in "-_")


def _chat_path(session_id: str):
    CHATS_DIR.mkdir(parents=True, exist_ok=True)
    return CHATS_DIR / f"{_safe_id(session_id)}.json"


@router.get("/{session_id}")
async def get_chat(session_id: str):
    """Return the full chat session (messages + metadata)."""
    path = _chat_path(session_id)
    if not path.exists():
        logger.warning("Chat not found  session=%s", session_id)
        raise HTTPException(status_code=404, detail="Chat not found.")
    content = path.read_text(encoding="utf-8")
    logger.info("Chat loaded     session=%s  bytes=%d", session_id, len(content))
    return Response(content=content, media_type="application/json")


@router.post("/{session_id}")
async def save_chat(session_id: str, request: Request):
    """Overwrite the chat session file with the full session payload."""
    body = await request.body()
    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON payload  session=%s  err=%s", session_id, exc)
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")
    _chat_path(session_id).write_bytes(body)
    msg_count = len(data.get("messages", []))
    logger.info("Chat saved      session=%s  messages=%d  bytes=%d", session_id, msg_count, len(body))
    return {"status": "saved", "session_id": session_id}


@router.delete("/{session_id}")
async def delete_chat(session_id: str):
    """Delete the chat session file (and its context file if present)."""
    from core.config import CONTEXTS_DIR
    chat_path = _chat_path(session_id)
    ctx_path  = CONTEXTS_DIR / f"{_safe_id(session_id)}.json"
    deleted = []
    if chat_path.exists():
        chat_path.unlink()
        deleted.append("chat")
    if ctx_path.exists():
        ctx_path.unlink()
        deleted.append("context")
    logger.info("Chat deleted    session=%s  files=%s", session_id, deleted)
    return {"status": "deleted", "session_id": session_id}
