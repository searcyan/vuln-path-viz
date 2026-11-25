"""会话 token 校验。"""

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from acme.auth.routes_guard import check_route
from acme.store import lookup_token

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


def _strip_bearer(raw: str) -> str:
    """去掉 Bearer 前缀。"""
    return raw.split(" ", 1)[1] if " " in raw else raw


async def require_session(
    request: Request,
    raw_key: str = Security(api_key_header),
) -> "Token":
    """把这个请求的 token 查出来，然后交给路由守卫。"""
    key = _strip_bearer(raw_key or "")
    token = await lookup_token(key)

    if token is None:
        raise HTTPException(401, "invalid token")

    check_route(request.method, request.url.path, token)
    return token
