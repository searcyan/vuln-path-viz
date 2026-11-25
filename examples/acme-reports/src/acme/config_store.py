"""全局配置：文件 + 内存缓存 + 进程环境。"""

import json
import os
from pathlib import Path
from typing import Any

CONFIG_PATH = Path("/var/acme/config.json")
_cache: dict[str, Any] = {}


def set_env(key: str, value: str) -> None:
    """写进进程环境 —— 供各处 os.getenv 读取。"""
    os.environ[key] = value


async def load_config() -> dict[str, Any]:
    """读配置：文件 → 内存缓存。"""
    if _cache:
        return dict(_cache)
    if CONFIG_PATH.exists():
        _cache.update(json.loads(CONFIG_PATH.read_text()))
    return dict(_cache)


async def save_config(cfg: dict[str, Any]) -> None:
    """落盘。"""
    _cache.clear()
    _cache.update(cfg)
    CONFIG_PATH.write_text(json.dumps(cfg))
