import { createRequire } from "node:module"; import path from "node:path";
const require = createRequire(path.join(process.env.HOME, "Documents/projects/simulator/talks/umich-causal-ai-2026/node_modules/"));
const { chromium } = require("playwright-core");
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("file://" + process.cwd() + "/index.html"); await page.waitForTimeout(600);
const hash = (sel) => page.evaluate((s) => { const c = document.querySelector(s); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 13) h = (h * 31 + d[i]) >>> 0; return h; }, sel);
await page.evaluate(() => window.Deck.go(2)); await page.waitForTimeout(300);
const h0 = await hash("#logregCanvas"); await page.click("#logregRandom"); await page.waitForTimeout(200); const h1 = await hash("#logregCanvas");
console.log("slide 3 another digit changes canvas:", h0 !== h1);
// overfitting claim: run the preset to its max epochs
await page.evaluate(() => window.Deck.go(9)); await page.waitForTimeout(300);
await page.evaluate(() => window.Widgets.overfit.T.toggle());
await page.waitForFunction(() => !window.Widgets.overfit.T.running, null, { timeout: 600000 });
const E = await page.evaluate(() => window.Widgets.overfit.T.epochs.map((e) => [e.ep, +(100 * e.trainAcc).toFixed(1), +(100 * e.testAcc).toFixed(1)]));
console.log("overfit preset (500 img, 128 units, lr .3): epochs", E.length - 1);
console.log(" ep/train/test every 5:", E.filter((e) => e[0] % 5 === 0).map((e) => e.join("/")).join("  "));
const best = E.reduce((a, b) => (b[2] > a[2] ? b : a)); console.log(" best test", best.join("/"), " final", E[E.length - 1].join("/"));
// main trainer default: 5 epochs
await page.evaluate(() => window.Deck.go(7)); await page.waitForTimeout(300);
await page.evaluate(() => { const T = window.Widgets.trainer.T; T.o.maxEpochs = 5; T.toggle(); });
await page.waitForFunction(() => !window.Widgets.trainer.T.running, null, { timeout: 600000 });
const E2 = await page.evaluate(() => window.Widgets.trainer.T.epochs.map((e) => [e.ep, +(100 * e.trainAcc).toFixed(1), +(100 * e.testAcc).toFixed(1)]));
console.log("trainer default (5000 img, 64 units, lr .1, batch 32):", E2.map((e) => e.join("/")).join("  "));
await browser.close();
