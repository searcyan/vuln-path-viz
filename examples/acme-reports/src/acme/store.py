"""token 表查询（样本里用内存字典代替数据库）。"""

from acme.auth.models import Token

# key -> Token。真实系统里这是一张表 + 一次查询。
_TOKENS: dict[str, Token] = {
    "sk-user-0001": Token(key_hash="h1", team_id=None, role="user", kind="api"),
    "sk-ui-0002": Token(key_hash="h2", team_id="acme-dashboard", role="user", kind="ui"),
    "sk-admin-0003": Token(key_hash="h3", team_id=None, role="admin", kind="api"),
}


async def lookup_token(key: str) -> Token | None:
    """按 key 查记录。"""
    return _TOKENS.get(key)
