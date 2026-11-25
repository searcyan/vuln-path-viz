---
name: vuln-path-viz
description: 把漏洞/攻击链做成单文件交互讲解页——左侧逐步讲解、右侧按调用深度分列的源码卡片与彩色调用边。含数据契约、视觉规范、lint（可核对源码行）与无头截图脚本。
whenToUse: 用户要为 CVE、漏洞、攻击链、调用栈、鉴权链做可视化或交互式讲解页；要把一篇漏洞分析文档转成「能一步步点着读」的 HTML；要做「从一条 curl 走到 impact」的执行路径图；要给安全报告配一张可深链、可截图的调用链大图。
---

# 漏洞执行路径讲解页

## 这是什么

一个**数据驱动的单文件 HTML**：左边一栏按「下一步」逐步讲解，右边一张可拖动缩放的大画布，按调用深度分列摆放**真实源码卡片**，卡片之间用带颜色的曲线连出调用关系。它讲的不是"漏洞原理"，而是**一条真实请求在代码里走过的那条线**：哪一行进了哪个函数、在哪一行分叉、在哪一行被拦下或被放行。

成品形态：

- 单文件、无外链、无构建、无网络请求 —— 双击 `index.html` 就能讲，能直接发给别人
- 支持 `?scene=KEY&step=N` 深链，任意一步可分享、可无头截图
- 键盘 `←/→/空格` 翻步、拖动平移、`Ctrl+滚轮` 缩放、`总览` 一键看全图
- 多漏洞/多链 = 多个 scene + 顶部 tab，共用一套引擎

## 五步产出

下文 `<SKILL>` 指**本 SKILL.md 所在目录**（也就是这个仓库的根目录）。所有命令都在那里运行。

```bash
# 1. 拷模板到交付位置（交付物路径由任务决定，例如 <项目>/viz/index.html）
cp <SKILL>/assets/viz-template.html ./viz/index.html

# 2. 只改 /* ==== SCENES:BEGIN ==== */ 到 /* ==== SCENES:END ==== */ 之间的数据
#    卡片/边/步骤的字段与规则：references/data-model.md
#    配色、行样式、文案写法：references/style.md
#    怎么从源码推出一张图：references/authoring.md
#    不知道长什么样：先打开 examples/acme-reports/viz/index.html

# 3. 数据自检（error 必修，warn 逐条确认）
node <SKILL>/scripts/lint-scene.mjs ./viz/index.html

#    如果能指定源码根目录，顺手把每个卡片行都回源码核对一遍（强推）
node <SKILL>/scripts/lint-scene.mjs --src-root ./src ./viz/index.html

# 4. 无头截图确认版式没崩（按 step 深链截任意一步）
node <SKILL>/scripts/shot.mjs ./viz/index.html 5 ./viz/shot-s5.png
#    再看一眼图：卡片是否重叠、长行是否被截、边是否指错卡片

# 5. 交付 + 在回复里给出「先看哪一步、哪几步是重点」
```

Windows PowerShell 把 `cp` 换成 `Copy-Item`，其余命令相同。需要 Node 18+（仅自检与截图用；页面本身不需要）。

## 三条铁律

1. **行号必须是真的。** 每张卡片的 `loc` 是 `文件:行`，`lines[].n` 是真实行号，代码内容是从那个文件里抄出来的（版本要写明）。凭记忆写的行号会在读者点开源码的那一刻崩塌。能给 `src` 就给 —— `--src-root` 会逐行核对。
2. **一条路径一条线。** 一次只讲一条能走完的路径：`curl → handler → authz → … → impact`。分叉（拒绝/放行、401/200）用不同颜色的边各走一遍，而不是在一张卡里并列讲两种可能。
3. **一步只讲一件事。** 每步一条 `line`、一句结论。要说的第二件事 → 第二步。

## 数据模型速查

| 对象 | 字段 | 说明 |
|---|---|---|
| scene | `title` `tab` `pageTitle` `paths` `legend` `cards` `edges` `steps` | 一个 scene = 一条路径 = 一个 tab |
| card | `id` `kind` `depth` `fn` `loc` `lines[]` `w` `tag` `src` | 一个 card = 一个函数（或一块背景/响应/复盘）；`depth` = 调用栈深度 = 列号；`src` = 相对源码根的文件路径，供核对 |
| line | `n` `c` | 真实行号 + 源码原文（允许合并省略无关行，行号之间跳空即可） |
| edge | `from` `at` `to` `path` `dashed` `label` | `from` 卡片第 `at` 行 → 调用 `to` 卡片；`at:null` 表示非函数调用（背景/HTTP/响应），配 `dashed:true` |
| step | `card` `line` `via` `badge` `title` `text` | 当前讲到哪一卡的哪一行；`via` = 从哪儿来的（左侧提示 + 橙色标出调用行）；`ret:true` 表示"从下层返回" |

完整字段、不变量、`via/ret/jump` 的精确语义见 [references/data-model.md](references/data-model.md)。

## 视觉语义（不要改）

| 元素 | 含义 |
|---|---|
| 卡片透明度 0.42 / 1 | 未涉及 / 当前步所在 |
| 行尾 `↗` + 淡蓝竖条 | 这一行会跳到别的卡片（有出边） |
| 橙色竖条（`row.src`） | 当前步的**调用发起行**（在父卡片里） |
| 蓝色竖条 + `▶`（`row.hit`） | 当前步**命中的那一行** |
| 边：绿 / 红 / 橙 / 灰 | 通过 / 拒绝 / 分叉 / 普通调用（可通过 `paths` 自定义） |
| 虚线边 | 不是函数调用（背景、HTTP 往返、响应） |
| 徽标 ok/bad/warn/info | 通过 / 拒绝 / 分叉与风险 / 背景与说明 |

配色、字号、间距、文案写法、徽标词表见 [references/style.md](references/style.md)。

## 交付前自检

机器查（`lint-scene.mjs`）：卡片/边/步骤互相指向的行号是否都存在、`via` 是否指得准、序号是否连续、`path` 颜色是否声明过、长行是否会被截、正文里引用的「NNN 行」是否真在图里、是否缺复盘卡、`--src-root` 下每个卡片行是否与源码逐字一致。**error 一条都不能留。**

人眼查（截图或打开看）：

- [ ] 每张卡片的 `loc` 能对上一个真实文件；随机抽 3 行去源码里核对
- [ ] 从第 1 步连按到末步：每步的画面都变了、都能看出"我从哪来、现在在哪、下一步去哪"
- [ ] 拒绝路径与通过路径的颜色从头到尾没串
- [ ] 结尾有一张「复盘」卡：N 个条件、修复点、边界
- [ ] 正文里没有「可能 / 大概 / 应该是」这种没核实的推断词；推断就明说「推断」
- [ ] 顶部 tab（多场景时）与页头标题不重复、能区分

## 常见反模式

- **一张卡塞三个函数** → 读者无法跟。一卡一函数。
- **把整个文件贴进卡片** → 只留与这条路径有关的行，其余用行号跳空表示。
- **depth 乱填** → depth 是调用栈深度，跳号会在画布上留空列。
- **回边画成箭头** → 返回不用画边，用 `via:{…, ret:true}` 表达。
- **每步都从第 1 步讲起** → 逐步推进，不要复述。
- **没有「impact」** → 路径必须走到一个具体后果（读文件、密钥外带、RCE、越权写库），并给出可观测证据（响应体、字节数、状态码）。

## 参考成品

`examples/acme-reports/viz/index.html` —— 10 卡片 / 7 边 / 17 步，走完一条越权读文件链。配套的 `examples/acme-reports/src/` 是**合成**的漏洞代码，所以它的每个行号都能用 `--src-root examples/acme-reports` 核对上：这是这套东西唯一值得信任的地方。

值得偷的三点：① 先用一张 `term` 卡讲清"两类接口 + token 里有什么"再进代码；② 同一个分叉点卡片的两行分别连着红边和绿边，读到分叉那一步结论已经不言自明；③ 拒绝路径先走完（403 死在守卫里），再换身份走通过路径 —— 顺序比反过来有力。

## 文件

- `assets/viz-template.html` —— 引擎 + 骨架场景；只改 `SCENES` 段
- `examples/acme-reports/` —— 完整样例：合成源码 + 17 步讲解页 + 截图
- `references/data-model.md` —— 字段、不变量、`via/ret/jump`、多场景、`src` 核对
- `references/style.md` —— 配色/布局常数/行样式/文案写法/徽标词表
- `references/authoring.md` —— 从源码与实测证据推到图的工作流、粒度决策、证据分级
- `scripts/lint-scene.mjs` —— 数据自检（node，无依赖；`--src-root` 核对源码行）
- `scripts/shot.mjs` —— 无头 Chrome/Edge 截图（node，跨平台）
