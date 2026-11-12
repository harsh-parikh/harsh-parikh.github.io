// Exhaustive control sweep at a projector-like scale: every select option, slider extreme, button; pointer tests; pageerrors.
import { createRequire } from "node:module"; import path from "node:path";
const require = createRequire(path.join(process.env.HOME, "Documents/projects/simulator/talks/umich-causal-ai-2026/node_modules/"));
const { chromium } = require("playwright-core");
const file = process.argv[2] || "index.html", vp = { width: 1920, height: 1080 };
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: vp });
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.goto("file://" + process.cwd() + "/" + file); await page.waitForTimeout(800);
const n = await page.evaluate(() => document.querySelectorAll(".slide").length);
const canvasHash = async (sel) => page.evaluate((s) => { const c = document.querySelector(s); if (!c) return null; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h; }, sel);
let report = [];
for (let i = 1; i <= n; i++) {
  await page.evaluate((k) => window.Deck.go(k - 1), i); await page.waitForTimeout(300);
  const canvases = await page.evaluate(() => Array.from(document.querySelectorAll(".slide.current canvas")).map((c) => c.id).filter(Boolean));
  const mainCv = canvases.length ? "#" + canvases[0] : null;
  const before = mainCv ? await canvasHash(mainCv) : null;
  const sels = await page.$$(".slide.current select"), ranges = await page.$$(".slide.current input[type=range]"), btns = await page.$$(".slide.current button");
  let changed = 0, acts = 0;
  for (const s of sels) { const opts = await s.$$eval("option", (o) => o.map((x) => x.value)); for (const v of opts) { await s.selectOption(v); await page.waitForTimeout(i === 12 && v === "pixels" ? 15000 : 250); acts++; } await s.selectOption(opts[0]); await page.waitForTimeout(250); }
  for (const r of ranges) { const [min, max, cur] = await r.evaluate((e) => [e.min, e.max, e.value]); for (const v of [min, max, cur]) { await r.evaluate((e, val) => { e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, v); await page.waitForTimeout(150); acts++; } }
  for (const b of btns) { const label = await b.textContent(); await b.click(); await page.waitForTimeout(label.match(/run|epoch|slide/) ? 1500 : 250); acts++; if (label.match(/pause/)) {} }
  // stop anything running
  for (const b of await page.$$(".slide.current button")) { const t = await b.textContent(); if (t === "pause") await b.click(); }
  const after = mainCv ? await canvasHash(mainCv) : null; if (before !== after) changed = 1;
  report.push(`slide ${i}: ${acts} control actions, canvas ${mainCv ? (changed ? "changed" : "UNCHANGED") : "none"}`);
}
// pointer tests at scale 1.5
await page.evaluate(() => window.Deck.go(4)); await page.waitForTimeout(300); // slide 5 forward pass
await page.click("#fwClear"); const pad = await page.$("#fwCanvas"); const r = await pad.boundingBox(); const scale = r.width / 740;
const cx = r.x + (10 + 112) * scale, cy = r.y + (60 + 112) * scale; // centre of the draw pad
await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 2 * scale, cy + 2 * scale); await page.mouse.up(); await page.waitForTimeout(200);
const stamp = await page.evaluate(() => { const w = window.Widgets.forward; let best = -1, bi = -1; w.raw.forEach((v, i) => { if (v > best) { best = v; bi = i; } }); return [Math.floor(bi / 28), bi % 28, best]; });
report.push(`pointer test: stamp at row ${stamp[0]}, col ${stamp[1]} (expect 13-14, 13-14) at stage scale ${scale.toFixed(2)}`);
await page.evaluate(() => window.Deck.go(1)); await page.waitForTimeout(300); // slide 2 digit grid hover
const big = await page.$("#digitBig"); const rb = await big.boundingBox(); await page.mouse.move(rb.x + rb.width * 0.5, rb.y + rb.height * 0.25 * 280 / 304);
await page.waitForTimeout(200); report.push("hover test: " + (await page.textContent("#digitInfo")) + " (expect row 8, column 15)");
console.log(report.join("\n")); console.log("errors:", errs.length); errs.forEach((e) => console.log("  " + e));
await browser.close();
