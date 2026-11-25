"""Token 记录与鉴权异常。"""

from dataclasses import dataclass

from fastapi import HTTPException


@dataclass
class Token:
    """数据库里的一行 token 记录。"""

    key_hash: str
    team_id: str | None
    role: str          # "user" / "auditor" / "admin"
    kind: str          # "api" / "ui"


def raise_admin_only(route: str, token: Token) -> None:
    """非管理员走了管理路由。"""
    raise HTTPException(
        403,
        f"admin only: route={route} role={token.role}",
    )
