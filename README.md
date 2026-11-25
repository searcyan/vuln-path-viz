# vuln-path-viz

**中文** | [English](README.en.md)

**一份 agent skill：让 agent 把漏洞做成能一步一步走完的执行路径图。**

装上之后，你说一句「把这个漏洞做成执行路径讲解页」，agent 自己去读源码、按调用栈排出卡片、写出逐步讲解，产出一个**单文件 HTML** —— 左边点「下一步」，右边是按调用深度分列的**真实源码卡片**和彩色的调用边：哪一行进了哪个函数、在哪分叉、在哪被拦下、最后落到什么 impact。

![example](examples/acme-reports/shots/step-10-fork.png)

## 它是什么

一个**技能包**（`SKILL.md` + 参考资料 + 脚本），不是一份模板文件。产出物单文件、零依赖、零构建，双击就能讲、能发给别人。

给 agent 用的东西，难点从来不是「画得出来」，而是**它会不会编**。所以这个仓库的重心是把纪律写进机器检查：

| 层次 | 内容 | 作用 |
|---|---|---|
| `SKILL.md` | 五步产出、三条铁律、交付清单 | agent 的任务书 |
| `references/authoring.md` | 从源码与实测证据推到图：粒度、depth、铺边顺序、证据分级 | 把「怎么想」写死，避免 agent 自由发挥 |
| `references/data-model.md` · `style.md` | card/edge/step 全部字段；配色、行状态、徽标词表、文案三段式 | 数据结构与审美都给定，不用它自己设计 |
| `scripts/lint-scene.mjs` | 结构校验 + `--src-root` **逐行回源码核对** | agent 编行号 / 誊错代码 / 指错卡片 → error |
| `examples/acme-reports/` | 合成漏洞代码 + 17 步成品页 | 少样本示例：形状照着抄 |

换句话说：**人只负责 review，不负责画。**

## 装上

仓库根目录就是 skill 目录，支持和 `SKILL.md`（YAML frontmatter：`name` / `description`）的工具直接安装：

```bash
# Claude Code（用户级）
git clone https://github.com/searcyan/vuln-path-viz.git ~/.claude/skills/vuln-path-viz

# DeepSeek Harness（用户级）
git clone https://github.com/searcyan/vuln-path-viz.git ~/.dsh/skills/vuln-path-viz

# 项目级：随仓库走，团队共享
git clone https://github.com/searcyan/vuln-path-viz.git .agents/skills/vuln-path-viz
```

也支持「子模块 / 软链 / 直接拷目录」—— 只要能读到 `SKILL.md` 即可。升级就 `git pull`。

## 怎么用

装上之后，正常说话就行，agent 会自己决定用不用这个技能：

> 把 CVE-XXXX-YYYY 做成执行路径讲解页，源码在 `./src/app-1.2.3`，PoC 输出在 `notes/repro.txt`

> 这条攻击链（见 `analysis.md`）帮我画成能一步步读的页面，控制在 15 步以内

> 照 `examples/acme-reports` 的样子，把我们后台这个越权问题做一页，给非开发的同事看

> 上次那页太长了，按阶段拆成两个 tab

agent 拿到任务后的动作，都写在 `SKILL.md` 里：**① 先锚定一条路径和一个可观测 impact → ② 把每张卡片的 `文件:行` 和代码从源码里取出来（不许凭记忆）→ ③ 按调用栈深度摆列、按结局给边染色 → ④ 写成 steps，拒绝路径先走完再走通过路径 → ⑤ 跑 `lint-scene.mjs`（能指到源码就加 `--src-root` 逐行核对）、无头截图自检，再交付并告诉你「先看哪几步、哪几步是重点」。

它不会问你要「模板怎么改」—— 那是它的事。

## 它凭什么不容易翻车

`node scripts/lint-scene.mjs [--src-root <dir>] <file.html>`

| 类型 | 例子 |
|---|---|
| error | 边指向不存在的卡片；步骤的行号不在卡片里；`via` 指错；`path` 颜色没声明；序号错位（①…⑯ 与位置不符） |
| error（`--src-root`） | 卡片第 18 行写的代码 ≠ 源码第 18 行 —— **这一条专治编行号** |
| warn | 单行太长会被省略号截断；正文超过 420 字；换了卡片却没有 `via`、也没有入边；正文引用了图里不存在的行号；缺复盘卡片 |

页面本身打开时也会跑同一套检查并打控制台。仓库的 GitHub Actions 每次 push 都跑：模板结构自检 + 样例带 `--src-root` 的源码核对 —— 保证「引擎 + 样例」永远是可用的，agent 抄到的一定不是坏样本。

三条铁律（写进 `SKILL.md`，也是 review 时你唯一需要盯的地方）：

1. **行号必须是真的** —— 凭记忆写的行号会在读者点开源码的那一刻崩塌
2. **一条路径一条线** —— 分叉用不同颜色的边各走一遍，不在一张卡里并列讲两种可能
3. **一步只讲一件事** —— 要说的第二件事 → 第二步

## 手动模式：不装 skill 也能用

只想先看看长什么样，或者你的工具还不支持 skill：

```bash
git clone https://github.com/searcyan/vuln-path-viz.git
cd vuln-path-viz

open assets/viz-template.html              # 骨架场景：6 卡片 / 6 步，看形状
open examples/acme-reports/viz/index.html  # 完整样例：17 步走完一条越权链
```

真要自己做一页，就把模板拷走、只改 `SCENES` 段（`/* ==== SCENES:BEGIN ==== */` 到 `SCENES:END` 之间），引擎不用动：

```bash
cp assets/viz-template.html my-viz/index.html
node scripts/lint-scene.mjs my-viz/index.html
node scripts/lint-scene.mjs --src-root ./src my-viz/index.html   # 顺带核对源码行
node scripts/shot.mjs my-viz/index.html 8 my-viz/step8.png       # 无头截图看版式
```

字段与规则见 `references/data-model.md`，配色与文案写法见 `references/style.md`。这条路径下 Node 只用于自检和截图，**页面本身不需要 Node**；截图脚本会自动找本机 Chrome / Edge / Chromium，也可以用 `VULN_VIZ_BROWSER` 指定。

## 仓库结构

```
SKILL.md                     技能正文（agent 读这个）：五步产出、三条铁律、交付清单
references/
  authoring.md               源码 → 图：粒度决策、depth 分配、铺边顺序、证据分级（实测/代码级/推断）
  data-model.md              card / edge / step 全字段、不变量、via/ret/jump 语义
  style.md                   配色、布局常数、行级状态、徽标词表、文案三段式
assets/viz-template.html     引擎 + 骨架场景；agent 拷它当起点，产出物只改 SCENES
scripts/
  lint-scene.mjs             数据自检（含 --src-root 逐行核对源码）
  shot.mjs                   无头 Chrome/Edge 截图（跨平台）
examples/acme-reports/
  src/                       合成样本的「漏洞代码」—— 行号是权威，供核对
  viz/index.html             10 卡片 / 7 边 / 17 步的完整成品
  shots/                     截图
.github/                     CI（每次 push 校验模板与样例）+ issue 模板（投稿通道）
```

## 样例在讲什么

`examples/acme-reports` 是一条**人为构造**的越权链，形状很常见：

普通用户的 token → `POST /admin/config` → `require_session()` 查库 → `check_route()` 遇到「`kind="ui"` 就按前缀放行」的捷径 → 进 handler，而 handler 里没有角色检查 → `set_env()` 把 `ACME_LOGO_PATH=/etc/passwd` 写进 `os.environ` → 换 `GET /logo` 读走文件。

它不是任何真实产品的漏洞，存在的唯一目的是让每个行号都能被 `--src-root` 核对上 —— 同时当一个「agent 可以照着学的形状」。

## 投稿你的讲解页

用这个 skill 做出了什么？开一条 [Show your viz](https://github.com/searcyan/vuln-path-viz/issues/new?template=show-your-viz.yml) 贴出来 —— 真实案例是这个仓库最有说服力的部分。长期征集位见 [#1](https://github.com/searcyan/vuln-path-viz/issues/1)。

## 许可

MIT，见 [LICENSE](LICENSE)。样例代码与文档可随意修改、二次分发。

英文版说明见 [README.en.md](README.en.md)。
