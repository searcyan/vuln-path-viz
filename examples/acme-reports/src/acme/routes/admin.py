"""管理接口：全局配置读写。

这是 examples/acme-reports 这个**合成样本**的一部分：它不是真实项目，
存在的唯一目的是给讲解页提供「行号可核对」的源码。
"""

from typing import Any

from fastapi import APIRouter, Depends, Request

from acme.auth.deps import require_session
from acme.config_store import load_config, save_config, set_env

router = APIRouter()


# ---- 管理接口：本该只有 admin 能调 ----
@router.post(
    "/admin/config",
    tags=["admin"],
    dependencies=[Depends(require_session)],
)
async def update_admin_config(request: Request) -> dict[str, Any]:
    """Admin UI 用来改全局配置。"""
    body = await request.json()

    for key, value in (body.get("env") or {}).items():
        set_env(key.upper(), value)

    cfg = await load_config()
    cfg.update(body.get("config") or {})
    await save_config(cfg)

    return {"ok": True}
