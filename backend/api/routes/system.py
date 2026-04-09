from fastapi import APIRouter

from core.model_selection import recommend_models

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/models")
async def get_recommended_models():
    return recommend_models()
