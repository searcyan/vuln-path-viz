"""路由白名单：这个身份能不能走这条路由。"""

from acme.auth.models import Token, raise_admin_only

ROUTE_WHITELIST = {
    "user": ["/api/reports", "/api/me"],
    "auditor": ["/api/reports", "/api/me", "/api/audit"],
}

UI_PREFIXES = ("/admin", "/config")


def check_route(method: str, route: str, token: Token) -> None:
    """路由层的第一道（也是唯一一道）判断。"""
    if token.kind == "ui" and route.startswith(UI_PREFIXES):
        # Admin UI 的会话 token 走前缀捷径
        return

    allowed = ROUTE_WHITELIST.get(token.role, [])
    if any(route.startswith(prefix) for prefix in allowed):
        return

    raise_admin_only(route, token)
