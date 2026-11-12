import { createRequire } from "node:module"; import path from "node:path";
const require = createRequire(path.join(process.env.HOME, "Documents/projects/simulator/talks/umich-causal-ai-2026/node_modules/"));
const { chromium } = require("playwright-core");
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file://" + process.cwd() + "/index.html#2"); await page.waitForTimeout(600);
const big = await page.$("#digitBig"); const rb = await big.boundingBox(); const sc = rb.width / 280;
for (const [row, col] of [[0, 0], [7, 14], [14, 14], [27, 27]]) { await page.mouse.move(rb.x + (col * 10 + 5) * sc, rb.y + (row * 10 + 5) * sc); await page.waitForTimeout(100); console.log(`aim row ${row + 1} col ${col + 1} ->`, (await page.textContent("#digitInfo")).split(":")[0]); }
// playground learns XOR with the new seeds?
await page.evaluate(() => window.Deck.go(3)); await page.waitForTimeout(300); await page.click("#pgRun"); await page.waitForTimeout(6000); await page.click("#pgRun");
console.log("playground XOR 4 units after 6 s:", await page.textContent("#pgStat"));
for (const d of ["rings", "spiral"]) { await page.selectOption("#pgData", d); await page.evaluate(() => { document.getElementById("pgHidden").value = 8; document.getElementById("pgHidden").dispatchEvent(new Event("change")); }); await page.click("#pgRun"); await page.waitForTimeout(6000); await page.click("#pgRun"); console.log(`playground ${d} 8 units after 6 s:`, await page.textContent("#pgStat")); }
await browser.close();
