#!/usr/bin/env node
/**
 * 无头截图 —— 讲解页版式自检（跨平台，不需要 Playwright）。
 *
 *   node scripts/shot.mjs <index.html> [step] [out.png]
 *   node scripts/shot.mjs examples/acme-reports/viz/index.html 10 shots/fork.png
 *   node scripts/shot.mjs viz/index.html --scene acme --step 3 --size 1440,900 --out shots/a.png
 *
 * 页面支持 ?scene=&step= 深链，所以不用浏览器自动化就能定格任意一步。
 * 截完用图片查看/read_image 看一眼：卡片是否重叠、长行是否被截、边是否指错卡片。
 *
 * 浏览器查找顺序：$VULN_VIZ_BROWSER → 系统 Chrome / Edge / Chromium → PATH。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const pos = [];
const opt = { scene: "", step: "0", out: "", size: "1680,940", wait: "3000" };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    const val = v !== undefined ? v : argv[++i];
    if (!(k in opt)) { console.error(`未知参数 --${k}`); process.exit(2); }
    opt[k] = val;
  } else pos.push(a);
}
if (!pos.length) {
  console.error("用法: node scripts/shot.mjs <index.html> [step] [out.png] [--scene KEY] [--step N] [--size W,H] [--wait MS]");
  process.exit(2);
}
const html = resolve(pos[0]);
if (!existsSync(html)) { console.error(`找不到文件：${html}`); process.exit(2); }
if (pos[1] !== undefined) opt.step = pos[1];
if (pos[2] !== undefined) opt.out = pos[2];
if (!opt.out) opt.out = html.replace(/\.html?$/i, "") + `-step${opt.step}.png`;
const out = resolve(opt.out);

const candidates = [
  process.env.VULN_VIZ_BROWSER,
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
  "/snap/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
].filter(Boolean);

let browser = candidates.find(p => existsSync(p));
if (!browser) {
  const probe = process.platform === "win32" ? ["where", ["chrome.exe"]] : ["which", ["google-chrome", "chromium", "microsoft-edge"]];
  for (const name of probe[1]) {
    const r = spawnSync(probe[0], [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const first = String(r.stdout || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
    if (first && existsSync(first)) { browser = first; break; }
  }
}
if (!browser) {
  console.error("找不到 Chrome / Edge / Chromium。装一个，或用环境变量指定：");
  console.error("  PowerShell:  $env:VULN_VIZ_BROWSER='C:\\path\\to\\chrome.exe'");
  console.error("  bash:        export VULN_VIZ_BROWSER=/path/to/chrome");
  process.exit(2);
}

const url = new URL(pathToFileURL(html).href);
if (opt.scene) url.searchParams.set("scene", opt.scene);
url.searchParams.set("step", String(opt.step));

/* 独立 user-data-dir，避免与正在运行的浏览器抢实例 */
const profile = mkdtempSync(join(tmpdir(), "vuln-viz-shot-"));
const args = [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--no-default-browser-check", `--user-data-dir=${profile}`,
  `--window-size=${opt.size}`, `--virtual-time-budget=${opt.wait}`,
  `--screenshot=${out}`, url.href,
];
const r = spawnSync(browser, args, { stdio: "ignore" });
rmSync(profile, { recursive: true, force: true });

if (!existsSync(out)) {
  console.error(`截图失败（exit=${r.status}）。可直接手动打开：\n  ${url.href}`);
  process.exit(1);
}
const kb = Math.round(statSync(out).size / 1024);
console.log(`OK  ${out}  (${kb} KB)  step=${opt.step}${opt.scene ? ` scene=${opt.scene}` : ""}`);
