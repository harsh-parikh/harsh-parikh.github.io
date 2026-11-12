// Render every slide in headless Chromium, log console errors, save screenshots to build/shots/.
// Usage: node build/render_check.mjs   (needs playwright-core; path below points at a local install)
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const require = createRequire(path.join(process.env.HOME, "Documents/projects/simulator/talks/umich-causal-ai-2026/node_modules/"));
const { chromium } = require("playwright-core");

const exe = fs.readdirSync(path.join(process.env.HOME, "Library/Caches/ms-playwright")).filter((d) => d.startsWith("chromium-")).sort().pop();
const exePath = path.join(process.env.HOME, "Library/Caches/ms-playwright", exe, "chrome-mac/Chromium.app/Contents/MacOS/Chromium");
const browser = await chromium.launch({ executablePath: fs.existsSync(exePath) ? exePath : undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
const url = "file://" + path.join(root, process.argv[2] || "index.html");
await page.goto(url);
await page.waitForTimeout(800);
if (errors.length) { console.log("load errors:"); errors.forEach((e) => console.log("  " + e)); }
const n = await page.evaluate(() => document.querySelectorAll(".slide").length);
fs.mkdirSync(path.join(here, "shots"), { recursive: true });
const actions = {
  playground: async () => { await page.click("#pgRun"); await page.waitForTimeout(2500); },
  gd: async () => { await page.click("#gdRun"); await page.waitForTimeout(1500); },
  backprop: async () => { for (let k = 0; k < 3; k++) await page.click("#bpFwd"); for (let k = 0; k < 4; k++) await page.click("#bpBwd"); },
  sgd: async () => { await page.click("#sgdRun"); await page.waitForTimeout(1500); },
  trainer: async () => { await page.click("#trControls button:nth-of-type(2)"); await page.waitForTimeout(6000); },
  overfit: async () => { await page.click("#ofControls button:nth-of-type(2)"); await page.waitForTimeout(3000); },
  conv: async () => { await page.click("#convAnim"); await page.waitForTimeout(600); },
};
for (let i = 1; i <= n; i++) {
  await page.evaluate((k) => window.Deck.go(k - 1), i);
  await page.waitForTimeout(400);
  const wid = await page.evaluate(() => document.querySelector(".slide.current").dataset.widget || "");
  if (actions[wid]) await actions[wid]();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(here, "shots", `slide-${String(i).padStart(2, "0")}.png`) });
  // overflow check: any element extending beyond the stage?
  const over = await page.evaluate(() => {
    const st = document.getElementById("stage").getBoundingClientRect(); const bad = [];
    document.querAll = null;
    document.querySelectorAll(".slide.current *").forEach((el) => { if (el.closest(".katex-mathml") || el.closest(".notes")) return; const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return; if (r.right > st.right + 1 || r.bottom > st.bottom + 1) bad.push(el.tagName + (el.id ? "#" + el.id : "") + ` right=${(r.right - st.right).toFixed(0)} bottom=${(r.bottom - st.bottom).toFixed(0)}`); });
    return bad.slice(0, 5);
  });
  console.log(`slide ${i}: ${over.length ? "OVERFLOW " + over.join(" | ") : "ok"}`);
}
console.log("console errors:", errors.length); errors.forEach((e) => console.log("  " + e));
await browser.close();
