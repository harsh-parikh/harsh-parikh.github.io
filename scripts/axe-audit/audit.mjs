// axe-core audit of a local page through headless Chrome and the DevTools protocol.
// Usage: node audit.mjs /path/to/page.html   or   node audit.mjs http://127.0.0.1:8765/page.html
// Serve the site over HTTP for a faithful run: from file:// the browser blocks fonts and CSS fetches (CORS noise).
// Runs WCAG 2.2 AA + best-practice rules in light and dark themes at 390px and 1280px,
// and reports page exceptions and console errors.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const page = /^https?:/.test(process.argv[2]) ? process.argv[2] : pathToFileURL(process.argv[2]).href;
const axeSrc = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const port = 9333;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
   `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/axe-chrome-profile', 'about:blank'],
  { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForChrome() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { const { res, rej } = this.pending.get(d.id); this.pending.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result); }
      else if (d.method) this.events.push(d); }; }
  send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

await waitForChrome();
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const cdp = new CDP(ws);
await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable');

let total = 0;
for (const theme of ['light', 'dark']) {
  for (const width of [390, 1280]) {
    cdp.events.length = 0;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 600 });
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await cdp.send('Page.navigate', { url: page });
    await sleep(1500);
    await cdp.send('Runtime.evaluate', { expression: axeSrc });
    const r = await cdp.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true,
      expression: `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } }).then(r => JSON.stringify({ v: r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0,3).map(n => n.target.join(' ')) })), passes: r.passes.length }))` });
    const out = JSON.parse(r.result.value);
    const errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'));
    total += out.v.length + errors.length;
    console.log(`${theme} ${width}px: ${out.v.length} violations, ${out.passes} rules passed, ${errors.length} page errors`);
    for (const v of out.v) console.log(`  ${v.impact} ${v.id} x${v.n}: ${v.targets.join(' | ')}`);
    for (const e of errors) console.log('  ERROR', JSON.stringify(e.params).slice(0, 300));
  }
}
// The chatbot: open it and ask what's due, to check that the page scripts run without throwing.
cdp.events.length = 0;
const chat = await cdp.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
  const fab = document.getElementById('chat-fab'); if (!fab) return 'no chat fab';
  fab.click(); await new Promise(r => setTimeout(r, 300));
  const input = document.getElementById('chat-input'); const form = document.getElementById('chat-form'); if (!input || !form) return 'no chat input';
  const answers = [];
  for (const q of ['what is due', 'lecture notes for k-means', 'project presentations', 'homework 2', 'reading for Lecture 12', 'what have we covered']) {
    input.value = q; form.requestSubmit();
    await new Promise(r => setTimeout(r, 1200));
    const msgs = document.querySelectorAll('#chat-messages .chat-msg.bot');
    answers.push(q + ' => ' + (msgs[msgs.length - 1] ? msgs[msgs.length - 1].textContent.trim().replace(/\\s+/g, ' ').slice(0, 260) : '(no reply element)'));
  }
  return answers.join('\\n');
})()` });
console.log('chatbot:\n' + chat.result.value);
const chatErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown');
total += chatErrors.length;
for (const e of chatErrors) console.log('  CHAT ERROR', JSON.stringify(e.params).slice(0, 300));
chrome.kill();
console.log(total === 0 ? 'AUDIT CLEAN' : `AUDIT: ${total} problems`);
process.exit(total === 0 ? 0 : 1);
