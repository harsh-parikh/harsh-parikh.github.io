// Screenshot a region of a page: node shot.mjs <url> <fromSelector> <toSelector> <out.png> [width]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [url, fromSel, toSel, out, w] = process.argv.slice(2);
const width = Number(w || 1280);
const port = 9334;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/shot-chrome-profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
await send('Page.navigate', { url }); await sleep(2000);
if (process.env.PRE) { await send('Runtime.evaluate', { expression: process.env.PRE }); await sleep(500); }
const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => { window.scrollTo(0,0); const a = document.querySelector(${JSON.stringify(fromSel)}).getBoundingClientRect(); const b = document.querySelector(${JSON.stringify(toSel)}).getBoundingClientRect(); return { x: 0, y: a.top + window.scrollY - 8, width: ${width}, height: b.bottom - a.top + 16 }; })()` });
const clip = { ...r.result.value, scale: 1 };
await send('Emulation.setDeviceMetricsOverride', { width, height: Math.ceil(clip.y + clip.height + 50), deviceScaleFactor: 1, mobile: width < 600 });
await sleep(500);
const shot = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
chrome.kill(); console.log('wrote', out, JSON.stringify(clip));
