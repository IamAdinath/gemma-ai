"""
api/routes/context.py
Namespace: /api/context
Handles per-session knowledge context files stored in backend/data/contexts/.
"""
from fastapi import APIRouter, HTTPException, Request, Response

from core.config import CONTEXTS_DIR

router = APIRouter(prefix="/api/context", tags=["context"])


def _context_path(session_id: str):
    CONTEXTS_DIR.mkdir(parents=True, exist_ok=True)
    # Sanitise session_id to prevent path traversal
    safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
    return CONTEXTS_DIR / f"{safe_id}.json"


@router.get("/{session_id}")
async def get_context(session_id: str):
    """Return the raw context file content for a session."""
    path = _context_path(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="No context file found.")
    return Response(content=path.read_text(encoding="utf-8"), media_type="application/json")


@router.post("/{session_id}")
async def save_context(session_id: str, request: Request):
    """Overwrite the context file with the raw request body."""
    body = await request.body()
    path = _context_path(session_id)
    path.write_bytes(body)
    return {"status": "saved", "session_id": session_id}


@router.delete("/{session_id}")
async def delete_context(session_id: str):
    """Delete the context file for a session."""
    path = _context_path(session_id)
    if path.exists():
        path.unlink()
    return {"status": "deleted", "session_id": session_id}
