#!/usr/bin/env node
/**
 * 讲解页数据自检 —— 在交付前跑一遍。
 *
 *   node lint-scene.mjs <viz.html> [...更多 html]
 *   node lint-scene.mjs --src-root <源码根目录> <viz.html> [...]
 *
 * 检查的是 HTML 里 `SCENES:BEGIN` / `SCENES:END` 之间的场景数据：
 *   error  = 渲染会出错、或内容会错（必须修）
 *   warn   = 大概率是笔误或排版问题（逐条确认）
 *
 * 给了 `--src-root` 时，还会拿卡片里的 `src` 字段去核对源码原文：
 * 第 n 行的真实内容必须与卡片第 n 行的文字一致（允许卡片在后面追加注释）。
 * 这是防「行号漂移 / 代码凭记忆誊写」的那道闸。
 *
 * 退出码：有 error 时 1，否则 0。
 */
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const CIRCLE = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟";
const DEFAULT_PATHS = { ok: "#22c55e", bad: "#ef4444", warn: "#f59e0b", both: "#5d6b83" };
const MAX_CARDS = 18, MAX_STEPS = 60;

const dspLen = s => {
  let n = 0;
  for (const ch of String(s)) n += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/.test(ch) ? 2 : 1;
  return n;
};

function loadScenes(file) {
  const html = readFileSync(file, "utf8");
  const m = /\/\*\s*={2,}\s*SCENES:BEGIN\s*={2,}\s*\*\/([\s\S]*?)\/\*\s*={2,}\s*SCENES:END\s*={2,}\s*\*\//.exec(html);
  if (!m) throw new Error(`${file}: 找不到 /* ==== SCENES:BEGIN ==== */ 与 /* ==== SCENES:END ==== */ 标记`);
  const body = m[1];
  const SCENES = new Function(`${body}; return SCENES;`)();
  return { SCENES, html };
}

/* 源码核对缓存：srcRoot + 相对路径 → 行数组 */
const srcCache = new Map();
function sourceLines(srcRoot, rel) {
  const abs = isAbsolute(rel) ? rel : join(srcRoot, rel);
  if (!srcCache.has(abs)) {
    try {
      srcCache.set(abs, readFileSync(abs, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/));
    } catch {
      srcCache.set(abs, null);
    }
  }
  return { abs, lines: srcCache.get(abs) };
}

/**
 * 拿卡片里每一行的文字，回到源码同名行号处核对。
 * 允许卡片在源码行后面追加注释（以源码原文为前缀）；缩进差异不计。
 */
function checkSources(cards, srcRoot, E, W) {
  for (const c of cards) {
    if (c.kind === "term") continue;
    if (!c.src) { W(`卡片 ${c.id} 没有 src，跳过源码核对（无法证明行号是真的）`); continue; }
    const { abs, lines } = sourceLines(srcRoot, c.src);
    if (!lines) { E(`卡片 ${c.id} 的 src 打不开：${abs}`); continue; }
    let checked = 0;
    for (const l of c.lines) {
      if (l.n === "" || l.n == null) continue;
      const idx = Number(l.n) - 1;
      const actual = lines[idx];
      if (actual === undefined) { E(`卡片 ${c.id} 第 ${l.n} 行超出文件长度（${c.src} 只有 ${lines.length - 1} 行）`); continue; }
      const want = String(l.c).trim();
      const got = actual.trim();
      if (got === want) { checked++; continue; }
      if (want.startsWith(got) && got.length > 0) { checked++; continue; }   /* 卡片追加了行尾注释 */
      E(`卡片 ${c.id} 第 ${l.n} 行与源码不符\n           源码 ${c.src}:${l.n}  →  ${got}\n           卡片里写的        →  ${want}`);
    }
    if (checked) continue;
  }
}

function checkScene(key, sc, html, srcRoot) {
  const errs = [], warns = [];
  const E = m => errs.push(m), W = m => warns.push(m);
  const paths = { ...DEFAULT_PATHS, ...(sc.paths || {}) };
  const cards = sc.cards || [], edges = sc.edges || [], steps = sc.steps || [];
  const byId = new Map(cards.map(c => [c.id, c]));

  if (!sc.title) E("缺 scene.title（页头标题）");
  if (!cards.length) E("没有 cards");
  if (!steps.length) E("没有 steps");
  if (cards.length > MAX_CARDS) W(`卡片 ${cards.length} 张，超过 ${MAX_CARDS} 张时建议拆成两个 scene / 用 tab 切换`);
  if (steps.length > MAX_STEPS) W(`步骤 ${steps.length} 步，超过 ${MAX_STEPS} 步听众会跟丢`);

  if (byId.size !== cards.length) E("卡片 id 有重复");
  const depths = new Set();
  for (const c of cards) {
    if (!c.id) E("有卡片缺 id");
    if (!c.fn) E(`卡片 ${c.id} 缺 fn`);
    if (typeof c.depth !== "number") E(`卡片 ${c.id} 缺 depth`);
    else depths.add(c.depth);
    if (!Array.isArray(c.lines) || !c.lines.length) { E(`卡片 ${c.id} 没有 lines`); continue; }
    const ns = c.lines.filter(l => l.n !== "" && l.n != null).map(l => String(l.n));
    if (new Set(ns).size !== ns.length) E(`卡片 ${c.id} 行号重复`);
    if (c.kind !== "term" && !c.loc) W(`卡片 ${c.id} 是代码卡片但没有 loc（文件:行）`);
    if (c.kind === "term" && ns.length) W(`卡片 ${c.id} 是 term 卡片但带了行号`);
    const w = c.w || Math.min(920, Math.max(700, 78 + Math.max(...c.lines.map(l => dspLen(l.c))) * 7.3));
    c.lines.forEach(l => {
      if (typeof l.c !== "string") E(`卡片 ${c.id} 第 ${l.n} 行缺 c`);
      const need = 56 + dspLen(l.c) * 7.3;
      if (need > w + 4) W(`卡片 ${c.id} 第 ${l.n || "?"} 行过长（需要 ${Math.round(need)}px > 卡宽 ${Math.round(w)}px），会被省略号截断`);
    });
  }
  const sortedDepths = [...depths].sort((a, b) => a - b);
  sortedDepths.forEach((d, i) => { if (d !== i) W(`depth 不连续：出现 ${d}，期望 ${i}（列间距按 depth 计算，跳号会留空白列）`); });

  const jumpRows = new Set();
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) { E(`边 ${e.from} → ${e.to} 指向不存在的卡片`); continue; }
    if (!(e.path in paths)) E(`边 ${e.from}@${e.at} 的 path="${e.path}" 不在 paths 里（可用：${Object.keys(paths).join(" / ")}）`);
    if (e.at == null) {
      if (a.depth === b.depth && !e.dashed) W(`边 ${e.from} → ${e.to} 同列且无 at 行号、非 dashed，看起来像漏了行号`);
    } else if (!a.lines.some(l => String(l.n) === String(e.at))) {
      E(`边 ${e.from}@${e.at} 的行号在卡片 ${e.from} 里不存在`);
    } else {
      jumpRows.add(`${e.from}@${e.at}`);
    }
    if (b.depth < a.depth) W(`边 ${e.from}(depth ${a.depth}) → ${e.to}(depth ${b.depth}) 是回边；回调用 via+ret 表达，别画边`);
  }

  const lineRefs = new Set();
  /* 序号基准：首步用 ⓪（背景）时后一步偏移一位；否则从 ① 起 */
  const zeroBased = [...(steps[0]?.title || "")][0] === "⓪";
  steps.forEach((s, i) => {
    const tag = `第 ${i + 1} 步`;
    const c = byId.get(s.card);
    if (!c) { E(`${tag} 指向不存在的卡片 ${s.card}`); return; }
    if (!s.title) E(`${tag} 缺 title`);
    if (!s.text) E(`${tag} 缺 text`);
    if (!Array.isArray(s.badge) || s.badge.length !== 2) E(`${tag} badge 应为 [类型, 文字]`);
    else if (!["ok", "bad", "warn", "info"].includes(s.badge[0])) E(`${tag} badge 类型 "${s.badge[0]}" 只能是 ok/bad/warn/info`);
    if (s.line == null) {
      if (c.kind !== "term") W(`${tag} 落在代码卡片 ${c.id} 上却没有 line，画布上不会高亮任何一行`);
    } else if (!c.lines.some(l => String(l.n) === String(s.line))) {
      E(`${tag} 的行号 ${s.line} 不在卡片 ${s.card} 里`);
    } else {
      lineRefs.add(String(s.line));
      const prev = steps[i - 1];
      const sameCard = prev && prev.card === s.card;
      if (!s.via && !sameCard && !jumpRows.has(`${s.card}@${s.line}`))
        W(`${tag}（${s.card}:${s.line}）换了卡片，但既没有 via，也没有入边——读者不知道执行流怎么到这儿`);
    }
    if (s.via) {
      const v = byId.get(s.via.card);
      if (!v) E(`${tag} via 指向不存在的卡片 ${s.via.card}`);
      else if (s.via.line != null && !v.lines.some(l => String(l.n) === String(s.via.line)))
        E(`${tag} via 行号 ${s.via.line} 不在卡片 ${s.via.card} 里`);
      if (!v) return;
      if (!s.via.text && !s.via.ret && s.via.line == null) W(`${tag} via 既没 line 也没 text，左侧提示会写成「第 null 行」`);
    }
    const mark = [...(s.title || "")][0];
    const wantIdx = zeroBased ? i - 1 : i;
    if (mark === "⓪") {
      if (i !== 0) E(`${tag} 用了 ⓪，但 ⓪ 只允许出现在第 1 步（背景）`);
    } else if (CIRCLE.includes(mark)) {
      if (CIRCLE.indexOf(mark) !== wantIdx) E(`${tag} 序号写的是「${mark}」，与位置不符（这里应是「${CIRCLE[wantIdx] || "?"}」）`);
    } else {
      W(`${tag} 标题没用带圈序号（① ② ③ …），与整体风格不一致`);
    }
    /* 正文里出现的 "NNN 行" 引用，必须真在某张卡片里 */
    for (const m of String(s.text).matchAll(/(\d{2,5})\s*行/g)) {
      const n = m[1];
      const anywhere = cards.some(c => c.lines.some(l => String(l.n) === n));
      if (!anywhere) W(`${tag} 正文引用了「${n} 行」，但没有卡片展示这一行（确认它不是笔误或臆造）`);
    }
    if (String(s.text).length > 420) W(`${tag} 正文 ${String(s.text).length} 字，讲不完；拆成两步`);
  });

  /* 复盘卡片应存在 */
  const hasSummary = cards.some(c => /复盘|小结|结论|summary/i.test(c.fn + " " + c.id));
  if (!hasSummary) W("没有「复盘」卡片：结尾应有一张卡片收口（N 个条件 / 修复 / 边界）");

  if (srcRoot) checkSources(cards, srcRoot, E, W);
  return { key, errs, warns };
}

/* ---------- CLI ---------- */
const argv = process.argv.slice(2);
const files = [];
let srcRoot = "";
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--src-root") { srcRoot = resolve(argv[++i] || ""); continue; }
  if (a.startsWith("--src-root=")) { srcRoot = resolve(a.slice(11)); continue; }
  if (a === "-h" || a === "--help") {
    console.log("用法:\n  node lint-scene.mjs <viz.html> [...]\n  node lint-scene.mjs --src-root <源码根目录> <viz.html> [...]");
    process.exit(0);
  }
  files.push(a);
}
if (!files.length) {
  console.error("用法:\n  node lint-scene.mjs <viz.html> [...]\n  node lint-scene.mjs --src-root <源码根目录> <viz.html> [...]");
  process.exit(2);
}
let failed = false;
for (const file of files) {
  let pack;
  try { pack = loadScenes(file); }
  catch (e) { console.error(`\n✗ ${file}\n  ${e.message}`); failed = true; continue; }

  const keys = Object.keys(pack.SCENES);
  console.log(`\n=== ${file} ===\n场景：${keys.join(", ")}${srcRoot ? `\n源码根：${srcRoot}` : ""}`);
  if (!keys.length) failed = true;

  for (const key of keys) {
    const { errs, warns } = checkScene(key, pack.SCENES[key], pack.html, srcRoot);
    const sc = pack.SCENES[key];
    const head = `[${key}] ${sc.cards?.length || 0} 卡片 / ${sc.edges?.length || 0} 边 / ${sc.steps?.length || 0} 步`;
    if (!errs.length && !warns.length) { console.log(`✓ ${head}`); continue; }
    console.log(`${errs.length ? "✗" : "!"} ${head}`);
    errs.forEach(m => console.log(`    error  ${m}`));
    warns.forEach(m => console.log(`    warn   ${m}`));
    if (errs.length) failed = true;
  }
}
process.exit(failed ? 1 : 0);
