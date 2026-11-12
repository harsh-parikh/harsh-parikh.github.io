import { createRequire } from "node:module"; import path from "node:path";
const require = createRequire(path.join(process.env.HOME, "Documents/projects/simulator/talks/umich-causal-ai-2026/node_modules/"));
const { chromium } = require("playwright-core");
const [file, slide, out, hidden] = process.argv.slice(2);
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("file://" + process.cwd() + "/" + file + "#" + slide); await page.waitForTimeout(800);
if (hidden) { await page.evaluate((h) => { const e = document.getElementById("pgHidden"); e.value = h; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); }, hidden); }
const run = await page.$("#pgRun"); if (run) { await run.click(); await page.waitForTimeout(3500); await run.click(); }
await page.screenshot({ path: out }); await browser.close();
