# acme-reports · 完整样例

一条**人为构造**的越权链，用来演示 `vuln-path-viz` 的成品长什么样，同时充当「行号可核对」的靶子：

```bash
# 就地核对：页面上每个卡片行，都回到 src/ 逐行比对
node ../../scripts/lint-scene.mjs --src-root . viz/index.html

# 输出版式截图（需要本机有 Chrome / Edge / Chromium）
node ../../scripts/shot.mjs viz/index.html 10 shots/fork.png
```

打开 `viz/index.html`（双击即可），从第 1 步点到第 17 步。

## 这条链

```
普通用户 token
  → POST /admin/config                        (curl 卡片)
  → update_admin_config()                     src/acme/routes/admin.py:23
      装饰器只挂 require_session，没有角色声明
  → require_session()                         src/acme/auth/deps.py:17
      ｜  查库拿到 token：role="user"、kind="api"
  → check_route()                             src/acme/auth/routes_guard.py:13
      ｜  kind == "ui" 为假 → 走白名单 → 不在名单里
  → raise_admin_only()                        src/acme/auth/models.py:18
      ｜  403，handler 的函数体一行没跑
  ＝ 换成 kind="ui" 的 Admin UI 会话 token，重放
  → check_route()                             src/acme/auth/routes_guard.py:15
      ｜  route.startswith(("/admin","/config")) → 直接 return（捷径）
  → update_admin_config() 函数体               src/acme/routes/admin.py:25
      ｜  没有第二道检查 → set_env("ACME_LOGO_PATH", "/etc/passwd")
  → set_env()                                 src/acme/config_store.py:14
      ｜  os.environ["ACME_LOGO_PATH"] = "/etc/passwd"
  ＝ 第二个请求：GET /logo
  → serve_logo()                              src/acme/files.py:12
      ｜  os.getenv("ACME_LOGO_PATH") → FileResponse("/etc/passwd")
```

## 两个条件

1. **路由层有前缀捷径**：`kind="ui"` 的 token，只要路由以 `/admin` 或 `/config` 开头就放行（`routes_guard.py:15`）
2. **handler 里没有第二道检查**：`update_admin_config()` 从不问 `role`（`admin.py:23` 之后）

缺一不可。修复补 (2) 最稳，同时把 (1) 的前缀匹配收窄成「精确路由 + 明确角色」。

## 注意

`src/` 里的代码**不是**任何真实产品，是照着常见形状写的最小复现，只为让行号可核对。它不能直接跑起来（缺 `main.py`、依赖、数据库），也不该被当成真实漏洞报告引用。
