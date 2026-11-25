"""静态资源端点：logo。"""

import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/logo")
async def serve_logo() -> FileResponse:
    """浏览器取 logo —— 没有任何鉴权。"""
    path = Path(os.getenv("ACME_LOGO_PATH", "static/logo.png"))

    if not path.exists():
        path = Path("static/logo.png")

    return FileResponse(path, media_type="image/png")
