# 数据模型

页面里只有三段数据：`cards`（代码块）、`edges`（调用关系）、`steps`（讲解顺序）。三者用 `id` 和**真实行号**互相引用，页面据此算出布局、连线和播放顺序。

全部数据写在 HTML 的这两行注释之间：

```js
/* ==== SCENES:BEGIN ==== */
const SCENES = { /* … */ };
/* ==== SCENES:END ==== */
```

> `lint-scene.mjs` 就是按这两个标记抽取并求值的；标记被改动或删掉，lint 会直接报错。

## scene

```js
{
  title:     "ACME Reports 2.4.1 · <span>两个条件</span>让普通用户读走 /etc/passwd",  // 页头标题，允许内联 HTML
  tab:       "ACME · <b>越权</b>",                       // 多场景时的 tab 文字（可省，回落到 title）
  pageTitle: "ACME Reports 2.4.1 · 两条越权链",           // 多场景时的页面级标题（统一放同一句）
  paths:     { ok:"#22c55e", bad:"#ef4444", warn:"#f59e0b", both:"#5d6b83" },
  legend:    [["ok","通过"],["bad","拒绝"],["warn","分叉"]],  // 可省：默认按"图里真正用到的 path"自动生成
  cards: [], edges: [], steps: []
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✔ | 页头标题；单场景时也是浏览器标题 |
| `tab` | | 多场景 tab 文字；不写就用 `title` |
| `pageTitle` | | 多场景时页头统一用这句，避免和 tab 重复 |
| `paths` | | 边的语义色。默认 `ok/bad/warn/both`；也可自定义任意 key（如 `"403"`）再在 `edge.path` 里用 |
| `legend` | | 图例。不写则自动 = 这些边里出现过的 path（`both` 除外） |

一个 scene = 一条能走完的路径 = 一个 tab。两个漏洞、两条不同的利用链 → 两个 scene。

## card

```js
{ id:"guard", kind:"code|term", depth:1, w:700, tag:"另一个请求",
  fn:"require_session()", loc:"app/auth/deps.py:17",
  src:"app/auth/deps.py",
  lines:[ { n:17, c:`async def require_session(request: Request, raw_key: str = Header(...)):` },
          { n:28, c:`    check_route(request.url.path, token)  # 分叉点` } ] }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✔ | 全局唯一，被 edge/step 引用 |
| `kind` | | `code`（默认）或 `term`：`term` 用于背景、请求/响应原文、时序、复盘，青绿色等宽、无需行号 |
| `depth` | ✔ | **调用栈深度** = 画布列号（0 起）。跳号会留空列 |
| `fn` | ✔ | 卡片标题：函数名全称带 `()`；term 卡写一句话主题 |
| `loc` | | `文件:行`。代码卡必填；term 卡留空 |
| `lines` | ✔ | 逐行 `{n, c}`；`n` 用真实行号，`term` 卡用 `""` |
| `src` | | 源码文件路径，**相对 `--src-root`**。填了它，`lint-scene.mjs --src-root <dir>` 就会回到源码逐行核对 |
| `w` | | 宽度，默认按最长行估算（700~920 之间）；超长行建议手动加宽或拆行 |
| `tag` | | 卡片右上角小标签（如 `另一个请求`），用于标记"这条边跨了另一个 HTTP 请求" |

**行号规则**：只保留与这条路径有关的行；行号之间可以不连续（`11936` 之后直接 `11940`），这本身就在告诉读者"中间省略了"。禁止改行号让视觉好看。

**`src` 核对规则**（`node scripts/lint-scene.mjs --src-root examples/acme-reports examples/acme-reports/viz/index.html`）：

- 卡片 `{n:18, c:"    dependencies=[Depends(require_session)],"}` 必须与 `src` 文件第 18 行**内容一致**
- 允许卡片在源码行后面追加行尾注释（源码原文是前缀即可）；缩进差异不计
- 行号超出文件长度、内容不一致、`src` 打不开 → error

没有 `src` 的代码卡片会在带 `--src-root` 时收到 warn（"无法证明行号是真的"）。模板骨架里的卡片没有 `src`（路径是占位符），只有真项目里才填。

**term 卡写什么**：
- `背景`：这类接口/角色/字段是什么（讲清前提，否则后面看不懂）
- `$ 请求`：真实的 curl（含 header、body），占位符 `TARGET` / `TOKEN`
- `响应`：真实返回的 HTTP 状态行 + JSON 片段
- `时序`：A/B/C 多个请求的先后与副作用落点
- `复盘`：N 个条件、修复点、边界（每条路径结尾必须有）

## line

```js
{ n: 21, c:`    dependencies=[Depends(require_session)],  # 只有"验 token"` }
```

- `c` 是**源码原文**（可以加行尾注释解释，但不要改写代码语义）；模板的 `hl()` 会做轻量高亮，`` ` `` 反引号里出现 `${` 会当模板插值 —— 代码里有 `${` 时改写成 `\${`。
- `n` 是数字时渲染成行号；行内代码若超过卡片宽度会被省略号截断（lint 会 warn）。

## edge

```js
{ from:"admin", at:21, to:"deps", path:"both" }                        // 21 行调用 require_session()
{ from:"curl",  at:null, to:"admin", path:"both", dashed:true, label:"HTTP" }
{ from:"guard", at:23, to:"raise", path:"bad" }                        // 这条路被拒
```

| 字段 | 说明 |
|---|---|
| `from` / `to` | 卡片 id；`to` 的 `depth` 必须 > `from` 的 `depth`（回边不要画，用 `via+ret`） |
| `at` | `from` 卡片里的**调用行号**；`null` 表示不是函数调用（背景/HTTP/响应） |
| `path` | 语义色 key（默认 `ok`/`bad`/`warn`/`both`，或 `paths` 里自定义的 key） |
| `dashed` | 虚线：非函数调用，或"跨请求" |
| `label` | 边上文字；不写则显示 `at` 行号。`at:null` 的边一定要写 `label` |

**`path` 怎么选**：
- `both`（灰）—— 与结局无关的普通调用
- `ok`（绿）—— 走在这条边上的请求**最终通过**
- `bad`（红）—— 走在这条边上的请求**最终被拒**
- `warn`（橙）—— 分叉点本身，或"这条边看着正常但正是漏洞所在"

同一对父子函数如果既有通过又有拒绝（如白名单 vs 前缀捷径），**各画一条边**，颜色不同，读者一眼看出分岔。

`at` 不为 `null` 的行，页面会自动加 `↗` 标记（表示"这一行会跳走"），无需额外配置。

## step

```js
{ card:"guard", line:15, via:{ card:"deps", line:28 }, badge:["warn","分叉点"],
  title:"④ 一行代码决定能否进门",
  text:`…允许内联 <b>/<code>/<br>…` }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `card` | ✔ | 当前聚焦的卡片（画布会把这张卡移到视野中并高亮） |
| `line` | | 当前聚焦的行号；`null` 用于 term 卡 |
| `via` | | 从哪儿来的：`{card, line}` + 可选 `text`（自定义左侧提示）+ `ret:true`（"从下层返回"，措辞会变） |
| `badge` | ✔ | `[类型, 文字]`，类型 ∈ `ok / bad / warn / info` |
| `title` | ✔ | 带圈序号 + 一句结论（序号见 style.md） |
| `text` | ✔ | 允许内联 HTML 的讲解正文（`<b>` `<code>` `<br>`） |

**`via` 的三种写法**

| 写法 | 渲染效果 | 用在哪 |
|---|---|---|
| `via:{card,line}` | `← 由 xxx() 第 N 行调用`，父卡片该行标橙 | 进入被调函数 |
| `via:{card,line,ret:true}` | `← 从 xxx() 返回（第 N 行）` | 执行流回到上层 |
| `via:{card,text:"…"}` | `← 自定义文字` | 跨请求、换身份、换场景的跳转 |

**同一张卡连续推进多步**（在同一函数里一行行往下走）：不需要 `via`，直接从第 i 行讲到第 i+1 行即可。

**换卡片却没有入边**（比如换了一把 key 重放请求）：必须给 `via`，否则读者不知道执行流从哪接上 —— lint 会 warn。

## 多场景

```js
const SCENES = { cveA: {/*…*/}, cveB: {/*…*/} };
```

- 顺序 = `SCENES` 的 key 顺序 = tab 顺序 = `?scene=` 的取值
- 顶部自动生成 tab；只有一个场景时 tab 隐藏
- 多场景共用一个页头：每个 scene 写同一个 `pageTitle`
- 深链：`index.html?scene=cveB&step=12`

## 页面内自检

打开页面时若数据有错，控制台会打出 `[sceneKey] 场景数据有 N 处问题：…`（卡片 id 重复、边指向不存在卡片、步骤行号不存在、序号错位等）。交付前除了看版式，也把 DevTools 控制台扫一眼。
