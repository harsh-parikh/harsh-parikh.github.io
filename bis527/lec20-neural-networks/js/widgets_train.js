/* widgets_train.js -- slides 16-21: live MNIST trainer, learned features, overfitting, convolution, ladder, summary. */
(function () {
  "use strict";
  const C = NN.COLORS, H = window.WH, W = window.Widgets, State = H.State;
  const { $, text, line, arrow, circle, rect, bars, fmt, heatmap, run, stop } = H;
  const ACCENT = "#00356b";

  // ========== Trainer (used by slides 16 and 18) ==========================
  function Trainer(opts) {
    this.o = Object.assign({ hidden: 64, act: "relu", lr: 0.1, batch: 32, nTrain: 4000, l2: 0, maxEpochs: 40 }, opts);
    this.M = NN.getMNIST();
  }
  Trainer.prototype.buildControls = function (box, presets) {
    const mk = (html) => { const d = document.createElement("label"); d.innerHTML = html; box.appendChild(d); return d; };
    const sel = (lab, name, vals, cur, f) => { const l = mk(`${lab} <select></select>`); const s = l.querySelector("select"); vals.forEach((v) => { const o = document.createElement("option"); o.value = v; o.textContent = f ? f(v) : v; if (String(v) === String(cur)) o.selected = true; s.appendChild(o); }); s.addEventListener("change", () => { this.o[name] = isNaN(+s.value) ? s.value : +s.value; this.reset(); }); return s; };
    this.c = {};
    this.c.hidden = sel("hidden units", "hidden", [0, 16, 32, 64, 128, 256], this.o.hidden, (v) => (v === 0 ? "0 (logistic regression)" : v));
    this.c.act = sel("g", "act", ["relu", "tanh", "sigmoid"], this.o.act, (v) => NN.ACT[v].name);
    this.c.lr = sel("η", "lr", [0.001, 0.01, 0.03, 0.1, 0.3, 1, 3], this.o.lr);
    this.c.batch = sel("batch", "batch", [1, 8, 32, 128, 512], this.o.batch);
    this.c.nTrain = sel("training images", "nTrain", [200, 500, 1000, 2000, 4000], this.o.nTrain, (v) => v.toLocaleString());
    this.c.l2 = sel("weight decay λ", "l2", [0, 0.0001, 0.001, 0.01], this.o.l2);
    const btn = (label, cls, f) => { const b = document.createElement("button"); b.textContent = label; if (cls) b.className = cls; b.addEventListener("click", f); box.appendChild(b); return b; };
    this.runBtn = btn("run", "primary", () => this.toggle());
    btn("one epoch", "", () => { this.oneEpoch = true; this.running = true; this.runBtn.textContent = "pause"; run(this, () => this.frame()); });
    btn("reset", "", () => this.reset());
    const st = document.createElement("span"); st.className = "stat"; box.appendChild(st); this.stat = st;
  };
  Trainer.prototype.toggle = function () { this.running = !this.running; this.oneEpoch = false; this.runBtn.textContent = this.running ? "pause" : "run"; if (this.running) run(this, () => this.frame()); };
  Trainer.prototype.pause = function () { stop(this); this.runBtn.textContent = "run"; };
  Trainer.prototype.reset = function () {
    this.pause(); this.oneEpoch = false;
    this.model = new NN.MLP({ inDim: 784, hidden: this.o.hidden, outDim: 10, act: this.o.act, seed: 31 });
    this.rng = new NN.RNG(37); this.epoch = 0; this.pos = 0; this.perm = this.rng.shuffle(Array.from({ length: this.o.nTrain }, (_, i) => i));
    this.batchLoss = []; this.epochs = []; this.evalNow(); this.draw();
  };
  Trainer.prototype.evalNow = function () {
    const m = this.model, nTr = Math.min(this.o.nTrain, 2000);
    const tr = m.evaluate(this.M.trainX, this.M.trainY, nTr, false), va = m.evaluate(this.M.valX, this.M.valY, this.M.nVal, true), te = m.evaluate(this.M.testX, this.M.testY, this.M.nTest, false);
    this.epochs.push({ ep: this.epoch, trainAcc: tr.acc, trainLoss: tr.loss, valAcc: va.acc, valLoss: va.loss, testAcc: te.acc }); this.conf = va.conf; this.wrong = va.wrong;
    if (this.o.hidden > 0) State.liveModel = m;
  };
  Trainer.prototype.frame = function () {
    const t0 = performance.now(), n = this.o.nTrain, B = this.o.batch;
    let epochDone = false;
    while (performance.now() - t0 < 30) {
      const idx = this.perm.slice(this.pos, this.pos + B); this.pos += B;
      const l = this.model.trainBatch(this.M.trainX, this.M.trainY, idx, this.o.lr, this.o.l2, 0);
      if (!isFinite(l)) { this.pause(); this.diverged = true; break; }
      this.batchLoss.push(l);
      if (this.pos >= n) { this.pos = 0; this.perm = this.rng.shuffle(this.perm); this.epoch++; epochDone = true; break; }
    }
    if (epochDone) { this.evalNow(); if (this.oneEpoch || this.epoch >= this.o.maxEpochs) this.pause(); }
    this.draw(epochDone);
  };
  Trainer.prototype.draw = function () {
    const ctx = this.ctx, Wd = this.w, Hd = this.h; ctx.clearRect(0, 0, Wd, Hd);
    const E = this.epochs, last = E[E.length - 1];
    // panel 1: batch loss
    const p1 = { x: 0, y: 20, w: 330, h: 200 }; rect(ctx, p1.x, p1.y, p1.w, p1.h, "#fafafa", "#ddd"); text(ctx, "training loss per mini-batch", p1.x + 6, p1.y - 6, { size: 14, color: C.loss });
    if (this.batchLoss.length > 1) {
      const L = this.batchLoss, step = Math.max(1, Math.floor(L.length / 400)), mx = Math.min(5, Math.max(...L.slice(0, 50)));
      ctx.save(); ctx.strokeStyle = C.loss; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5; ctx.beginPath();
      for (let i = 0; i < L.length; i += step) { const px = p1.x + 4 + (p1.w - 8) * i / (L.length - 1), py = p1.y + p1.h - 4 - Math.min(1, L[i] / mx) * (p1.h - 12); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); ctx.restore();
      // smoothed
      ctx.save(); ctx.strokeStyle = C.loss; ctx.lineWidth = 2.5; ctx.beginPath(); let acc = L[0]; for (let i = 0; i < L.length; i += step) { acc = 0.95 * acc + 0.05 * L[i]; const px = p1.x + 4 + (p1.w - 8) * i / (L.length - 1), py = p1.y + p1.h - 4 - Math.min(1, acc / mx) * (p1.h - 12); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); ctx.restore();
      text(ctx, fmt(mx, 1), p1.x + 6, p1.y + 14, { size: 12, color: "#777" }); text(ctx, "0", p1.x + 6, p1.y + p1.h - 6, { size: 12, color: "#777" });
    }
    // panel 2: accuracy per epoch
    const wide = Wd >= 1000; const p2 = { x: wide ? 350 : 390, y: 20, w: 330, h: 200 }; rect(ctx, p2.x, p2.y, p2.w, p2.h, "#fafafa", "#ddd"); text(ctx, "accuracy per epoch", p2.x + 6, p2.y - 6, { size: 14, color: "#555" });
    const maxEp = Math.max(10, this.o.maxEpochs), X = (e) => p2.x + 6 + (p2.w - 12) * e / maxEp, Y = (a) => p2.y + p2.h - 6 - (p2.h - 24) * a;
    for (const a of [0.5, 0.9, 1]) { line(ctx, p2.x, Y(a), p2.x + p2.w, Y(a), "#e8e8e8"); text(ctx, (100 * a).toFixed(0) + "%", p2.x + p2.w - 4, Y(a) - 3, { size: 11, color: "#999", align: "right" }); }
    const plot = (key, col) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); E.forEach((e, i) => { i ? ctx.lineTo(X(e.ep), Y(e[key])) : ctx.moveTo(X(e.ep), Y(e[key])); }); ctx.stroke(); ctx.restore(); E.forEach((e) => circle(ctx, X(e.ep), Y(e[key]), 3, col)); };
    plot("trainAcc", C.h); plot("valAcc", C.p);
    let best = E[0]; for (const e of E) if (e.valAcc > best.valAcc) best = e; this.best = best;
    if (E.length > 2) { line(ctx, X(best.ep), p2.y + 8, X(best.ep), p2.y + p2.h - 4, C.p, 1.2, [4, 4]); text(ctx, "best validation", X(best.ep), p2.y + p2.h + 14, { size: 11, align: "center", color: C.p }); }
    text(ctx, "train", p2.x + 8, p2.y + 16, { size: 13, color: C.h, weight: 600 }); text(ctx, "validation", p2.x + 52, p2.y + 16, { size: 13, color: C.p, weight: 600 });
    // panel 3: confusion matrix
    const p3 = { x: 700, y: 20, s: 20 }; if (wide) text(ctx, "validation confusion: true (rows) × predicted (columns)", p3.x, p3.y - 6, { size: 14, color: "#555" });
    if (this.conf && wide) {
      let mx = 1; for (let i = 0; i < 100; i++) if (i % 11) mx = Math.max(mx, this.conf[i]);
      for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) { const v = this.conf[r * 10 + c]; const t = r === c ? v / Math.max(1, this.M.nVal / 10) : v / mx; const col = r === c ? `rgba(42,157,92,${0.1 + 0.9 * Math.min(1, t)})` : `rgba(192,57,43,${v ? 0.15 + 0.85 * t : 0})`; rect(ctx, p3.x + 22 + c * p3.s, p3.y + 10 + r * p3.s, p3.s - 1, p3.s - 1, v ? col : "#f4f4f4"); if (v && r !== c && t > 0.45) text(ctx, String(v), p3.x + 22 + c * p3.s + p3.s / 2, p3.y + 10 + r * p3.s + 14, { size: 10, align: "center", color: "#fff" }); }
      for (let k = 0; k < 10; k++) { text(ctx, String(k), p3.x + 10, p3.y + 10 + k * p3.s + 14, { size: 11, align: "center", color: "#777" }); text(ctx, String(k), p3.x + 22 + k * p3.s + p3.s / 2, p3.y + 10 + 10 * p3.s + 12, { size: 11, align: "center", color: "#777" }); }
    }
    // panel 4: wrong examples
    const p4 = { x: 0, y: 280 }; text(ctx, "validation digits the network gets wrong (predicted → true)", p4.x, p4.y - 6, { size: 14, color: "#555" });
    if (this.wrong) { const ws = this.wrong.slice().sort((a, b) => b.conf - a.conf).slice(0, Math.floor(Wd / 72)); ws.forEach((w, i) => { const x0 = p4.x + i * 72; NN.drawDigit(ctx, this.M.image("val", w.i), x0, p4.y, 2); rect(ctx, x0, p4.y, 56, 56, null, "#ddd"); text(ctx, `${w.pred} → ${w.y}`, x0 + 28, p4.y + 72, { size: 13, align: "center", color: C.loss, mono: true }); }); }
    const cur = last;
    this.stat.innerHTML = `epoch <b>${this.epoch}</b> &nbsp; train <b>${(100 * cur.trainAcc).toFixed(1)}%</b> &nbsp; validation <b>${(100 * cur.valAcc).toFixed(1)}%</b> &nbsp; test at best validation epoch (${this.best.ep}): <b>${(100 * this.best.testAcc).toFixed(1)}%</b> &nbsp; ${this.model.nParams().toLocaleString()} parameters` + (this.diverged ? ' &nbsp; <span style="color:#c0392b">diverged (η too large)</span>' : "");
    if (this.diverged && !this.running) this.diverged = false;
  };
  Trainer.prototype.attach = function (canvas, w, h) { this.w = w; this.h = h; this.ctx = NN.setupCanvas(canvas, w, h); };

  W.trainer = {
    init() { this.T = new Trainer({}); this.T.buildControls($("trControls")); this.T.attach($("trCanvas"), 1150, 370); this.T.reset(); },
    leave() { this.T.pause(); },
  };
  W.overfit = {
    init() { this.T = new Trainer({ hidden: 128, nTrain: 500, lr: 0.3, batch: 32, maxEpochs: 60 }); this.T.buildControls($("ofControls")); this.T.attach($("ofCanvas"), 760, 370); this.T.reset(); },
    leave() { this.T.pause(); },
  };

  // ========== 17. learned features ========================================
  W.features = {
    init() {
      this.M = NN.getMNIST(); this.pre = H.loadPretrainedMLP(); this.ctx = NN.setupCanvas($("featCanvas"), 760, 450); this.cv = $("featCanvas"); this.sel = 0;
      $("featSrc").addEventListener("change", () => this.draw());
      this.cv.addEventListener("click", (e) => { const [x, y] = NN.localXY(e, this.cv); const g = this.grid; if (!g) return; const c = Math.floor((x - g.x) / g.cell), rr = Math.floor((y - g.y) / g.cell); if (c >= 0 && c < g.cols && rr >= 0 && rr < g.rows) { const j = rr * g.cols + c; if (j < this.model.hidden) { this.sel = j; this.draw(); } } });
    },
    enter() { this.draw(); },
    draw() {
      const ctx = this.ctx; ctx.clearRect(0, 0, 760, 450);
      const live = $("featSrc").value === "live";
      this.model = live && State.liveModel ? State.liveModel : this.pre;
      if (live && !State.liveModel) text(ctx, "No live model yet: train one on the previous slide with hidden units > 0.", 10, 30, { size: 16, color: C.loss });
      const m = this.model, Hn = m.hidden, cols = Hn <= 64 ? 8 : 16, rows = Math.ceil(Hn / cols), cell = Math.min(52, Math.floor(420 / rows)), gx = 0, gy = 10;
      this.grid = { x: gx, y: gy, cell, cols, rows }; this.sel = Math.min(this.sel, Hn - 1);
      let vmax = 0; for (let i = 0; i < m.W1.length; i++) vmax = Math.max(vmax, Math.abs(m.W1[i])); vmax *= 0.7;
      const s = (cell - 4) / 28;
      for (let j = 0; j < Hn; j++) { const x0 = gx + (j % cols) * cell + 2, y0 = gy + Math.floor(j / cols) * cell + 2; NN.drawWeightImage(ctx, m.W1, j, Hn, x0, y0, s, 28, vmax); if (j === this.sel) rect(ctx, x0 - 2, y0 - 2, cell, cell, null, ACCENT, 3); }
      text(ctx, `${Hn} rows of W₁, each drawn as 28 × 28`, gx, gy + rows * cell + 18, { size: 14, color: "#555" });
      // right panel: top activating digits + output weights
      const rx = 450; text(ctx, `hidden unit ${this.sel + 1}`, rx, 28, { size: 17, weight: 600, color: C.h });
      NN.drawWeightImage(ctx, m.W1, this.sel, Hn, rx, 40, 3, 28, vmax); rect(ctx, rx, 40, 84, 84, null, "#ccc");
      // top-9 test digits
      const acts = []; for (let i = 0; i < this.M.nVal; i++) { const x = this.M.image("val", i); let z = m.b1[this.sel]; for (let k = 0; k < 784; k++) { const v = x[k]; if (v) z += v * m.W1[k * Hn + this.sel]; } acts.push([z, i]); }
      acts.sort((a, b) => b[0] - a[0]);
      text(ctx, "validation digits that activate it most", rx + 100, 52, { size: 14, color: "#555" });
      for (let k = 0; k < 9; k++) { const [, i] = acts[k]; const x0 = rx + 100 + (k % 3) * 60, y0 = 60 + Math.floor(k / 3) * 60; NN.drawDigit(ctx, this.M.image("val", i), x0, y0, 2); rect(ctx, x0, y0, 56, 56, null, "#ddd"); }
      // output weights of the unit
      const wout = Array.from({ length: 10 }, (_, k) => m.W2[this.sel * 10 + k]); const wm = Math.max(0.01, ...wout.map(Math.abs));
      text(ctx, "its weights into the ten outputs (row of W₂)", rx, 275, { size: 14, color: C.w });
      bars(ctx, wout, rx, 285, 300, 110, { min: -wm, max: wm, color: (k, v) => (v >= 0 ? C.loss : C.x), labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      text(ctx, "red: evidence for the digit · blue: evidence against", rx, 425, { size: 13, color: "#555" });
    },
  };

  // ========== 19. convolution ===========================================
  const KERNELS = { vert: [-1, 0, 1, -2, 0, 2, -1, 0, 1], horiz: [-1, -2, -1, 0, 0, 0, 1, 2, 1], blur: [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9], sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0] };
  W.conv = {
    init() {
      this.M = NN.getMNIST(); this.ctx = NN.setupCanvas($("convCanvas"), 740, 400); this.rng = new NN.RNG(41); this.idx = State.digitIdx || 0; this.K = KERNELS.vert.slice(); this.pos = -1;
      const grid = $("convGrid"); this.inputs = [];
      for (let i = 0; i < 9; i++) { const inp = document.createElement("input"); inp.value = fmt(this.K[i], 1); inp.addEventListener("input", () => { const v = parseFloat(inp.value); if (isFinite(v)) { this.K[i] = v; $("convPreset").value = "custom"; this.draw(); } }); grid.appendChild(inp); this.inputs.push(inp); }
      $("convPreset").addEventListener("change", () => { const k = $("convPreset").value; if (KERNELS[k]) { this.K = KERNELS[k].slice(); this.inputs.forEach((inp, i) => (inp.value = fmt(this.K[i], k === "blur" ? 2 : 1))); this.draw(); } });
      $("convRandom").addEventListener("click", () => { this.idx = Math.floor(this.rng.next() * this.M.nTest); this.draw(); });
      $("convAnim").addEventListener("click", () => { if (this.running) { stop(this); this.pos = -1; this.draw(); return; } this.pos = 0; this.running = true; run(this, () => { this.pos += 3; if (this.pos >= 26 * 26) { stop(this); this.pos = -1; } this.draw(); }); });
      this.draw();
    },
    leave() { stop(this); this.pos = -1; },
    draw() {
      const ctx = this.ctx, x = this.M.image("test", this.idx), K = this.K; ctx.clearRect(0, 0, 740, 400);
      const s = 10, ix = 10, iy = 50; NN.drawDigit(ctx, x, ix, iy, s); rect(ctx, ix, iy, 280, 280, null, C.x, 2);
      text(ctx, "x   28 × 28", ix + 140, iy - 10, { size: 15, align: "center", color: C.x, weight: 600 });
      // kernel
      const kx = 320, ky = 150, ks = 30; let km = Math.max(0.01, ...K.map(Math.abs));
      for (let i = 0; i < 9; i++) { rect(ctx, kx + (i % 3) * ks, ky + Math.floor(i / 3) * ks, ks - 1, ks - 1, NN.divergeColor(K[i], km)); text(ctx, fmt(K[i], 1).replace(/\.0$/, ""), kx + (i % 3) * ks + ks / 2, ky + Math.floor(i / 3) * ks + 20, { size: 12, align: "center", color: "#333", mono: true }); }
      rect(ctx, kx, ky, 3 * ks, 3 * ks, null, C.w, 2); text(ctx, "K   3 × 3", kx + 45, ky - 10, { size: 15, align: "center", color: C.w, weight: 600 });
      text(ctx, "∗", kx + 45, ky + 125, { size: 26, align: "center", color: "#555" });
      // output
      const out = new Float32Array(26 * 26); let om = 1e-6;
      for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) { let v = 0; for (let u = 0; u < 3; u++) for (let w = 0; w < 3; w++) v += K[u * 3 + w] * x[(i + u) * 28 + j + w]; out[i * 26 + j] = v; om = Math.max(om, Math.abs(v)); }
      const ox = 450, oy = 60, os = 10;
      const nShow = this.pos >= 0 ? this.pos : 26 * 26;
      for (let i = 0; i < 26 * 26; i++) { if (i > nShow) break; rect(ctx, ox + (i % 26) * os, oy + Math.floor(i / 26) * os, os, os, NN.divergeColor(out[i], om)); }
      rect(ctx, ox, oy, 260, 260, null, C.h, 2); text(ctx, "K ∗ x   26 × 26", ox + 130, oy - 10, { size: 15, align: "center", color: C.h, weight: 600 });
      arrow(ctx, kx + 100, ky + 45, ox - 10, ky + 45, "#888", 1.5);
      if (this.pos >= 0 && this.pos < 26 * 26) { const i = Math.floor(this.pos / 26), j = this.pos % 26; rect(ctx, ix + j * s, iy + i * s, 3 * s, 3 * s, null, C.w, 3); rect(ctx, ox + j * os, oy + i * os, os, os, null, C.w, 3); text(ctx, `output (${i + 1}, ${j + 1}) = ${fmt(out[this.pos], 2)}`, ox, oy + 285, { size: 14, color: C.w, mono: true }); }
      text(ctx, "each output cell: the 3 × 3 patch times K, summed", ox, 365, { size: 13, color: "#555" });
      text(ctx, "blue negative, red positive", ox, 385, { size: 13, color: "#555" });
    },
  };

  // ========== 20. ladder ===============================================
  W.ladder = {
    init() {
      const draw = (id, kind) => {
        const ctx = NN.setupCanvas($(id), 300, 120); const r = new NN.RNG(43), pts = [];
        for (let i = 0; i < 24; i++) { const x = i / 23; const y = 0.5 + 0.35 * Math.sin(2.2 * Math.PI * x + 0.5) * Math.exp(-1.5 * x) + 0.12 * (r.normal()); pts.push([x, y]); }
        const X = (x) => 10 + 280 * x, Y = (y) => 110 - 100 * Math.max(0, Math.min(1, y));
        pts.forEach(([x, y]) => circle(ctx, X(x), Y(y), 3.5, C.x));
        ctx.save(); ctx.strokeStyle = kind === "nn" ? C.h : C.w; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i <= 100; i++) { const x = i / 100; let y; if (kind === "glm") y = 0.68 - 0.3 * x; else if (kind === "basis") y = 0.5 + 0.33 * Math.sin(2.2 * Math.PI * x + 0.5) * Math.exp(-1.5 * x); else { const relu = (v) => Math.max(0, v); y = 0.72 + 1.2 * relu(x - 0.0) * 0.6 - 2.4 * relu(x - 0.17) + 2.2 * relu(x - 0.42) - 0.9 * relu(x - 0.7); } i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
        ctx.stroke(); ctx.restore();
        if (kind === "nn") for (const kx of [0.17, 0.42, 0.7]) line(ctx, X(kx), 10, X(kx), 110, C.h, 1, [3, 4]);
      };
      draw("ladA", "glm"); draw("ladB", "basis"); draw("ladC", "nn");
    },
  };

  // ========== 21. summary loop ============================================
  W.summary = {
    init() {
      const ctx = NN.setupCanvas($("sumCanvas"), 560, 420);
      const box = (x, y, w, h, title, sub, col) => { rect(ctx, x, y, w, h, "#fff", col, 2.5); text(ctx, title, x + w / 2, y + 32, { size: 20, align: "center", color: col, weight: 600 }); text(ctx, sub, x + w / 2, y + 60, { size: 15, align: "center", color: "#555" }); };
      box(40, 40, 200, 80, "forward pass", "x → h → p", C.x); box(320, 40, 200, 80, "loss", "L = −log p_y", C.loss);
      box(320, 290, 200, 80, "backward pass", "δ₂, δ₁ by the chain rule", C.loss); box(40, 290, 200, 80, "update", "θ ← θ − η ∇L", C.w);
      arrow(ctx, 245, 80, 315, 80, "#555", 2); arrow(ctx, 420, 125, 420, 285, "#555", 2); arrow(ctx, 315, 330, 245, 330, "#555", 2); arrow(ctx, 140, 285, 140, 125, "#555", 2);
      text(ctx, "one mini-batch", 280, 215, { size: 16, align: "center", color: "#555" }); text(ctx, "repeat for many epochs", 280, 240, { size: 16, align: "center", color: "#555" });
      // small network glyph in the middle-left
      const layers = [3, 4, 2], xs = [95, 140, 185], cols = [C.x, C.h, C.p];
      const pos = layers.map((n, li) => Array.from({ length: n }, (_, j) => [xs[li], 215 + (j - (n - 1) / 2) * 24]));
      for (let li = 0; li < 2; li++) for (const a of pos[li]) for (const b of pos[li + 1]) line(ctx, a[0], a[1], b[0], b[1], "#ddd", 1);
      pos.forEach((L, li) => L.forEach((p) => circle(ctx, p[0], p[1], 7, "#fff", cols[li], 2)));
      text(ctx, "Monitor test accuracy every epoch; stop when it stops improving.", 280, 405, { size: 15, align: "center", color: "#555" });
    },
  };
})();

/* ---- A neural network is a weighting estimator: yhat(x) = sum_i w_i(x) Y_i with learned features. */
(function () {
  "use strict";
  const C = NN.COLORS, H = window.WH, W = window.Widgets, State = H.State;
  const { $, text, rect, bars, fmt, circle } = H;
  const ACCENT = "#00356b";

  // Gauss-Jordan inverse of a symmetric positive definite d x d matrix (Float64Array, row-major).
  function invert(A, d) {
    const M = Float64Array.from(A), I = new Float64Array(d * d); for (let i = 0; i < d; i++) I[i * d + i] = 1;
    for (let c = 0; c < d; c++) {
      let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(M[r * d + c]) > Math.abs(M[p * d + c])) p = r;
      if (p !== c) for (let k = 0; k < d; k++) { let t = M[c * d + k]; M[c * d + k] = M[p * d + k]; M[p * d + k] = t; t = I[c * d + k]; I[c * d + k] = I[p * d + k]; I[p * d + k] = t; }
      const piv = M[c * d + c] || 1e-12;
      for (let k = 0; k < d; k++) { M[c * d + k] /= piv; I[c * d + k] /= piv; }
      for (let r = 0; r < d; r++) { if (r === c) continue; const f = M[r * d + c]; if (!f) continue; for (let k = 0; k < d; k++) { M[r * d + k] -= f * M[c * d + k]; I[r * d + k] -= f * I[c * d + k]; } }
    }
    return I;
  }

  W.weights = {
    init() {
      this.M = NN.getMNIST(); this.net = H.loadPretrainedMLP(); this.ctx = NN.setupCanvas($("wtCanvas"), 760, 440); this.rng = new NN.RNG(53);
      this.cache = {}; this.idx = State.digitIdx || 0;
      $("wtRandom").addEventListener("click", () => { this.idx = Math.floor(this.rng.next() * this.M.nTest); this.draw(); });
      $("wtFeat").addEventListener("change", () => this.draw());
    },
    enter() { this.idx = State.digitIdx || this.idx; this.draw(); },
    // feature map: learned hidden layer (+1) or raw pixels (+1)
    feat(kind, x) {
      if (kind === "hidden") { const h = this.net.forward1(x).h; const f = new Float64Array(h.length + 1); f.set(h); f[h.length] = 1; return f; }
      const f = new Float64Array(785); f.set(x); f[784] = 1; return f;
    },
    build(kind) {
      if (this.cache[kind]) return this.cache[kind];
      const M = this.M, n = M.nTrain, lam = kind === "hidden" ? 1e-3 : 1.0;
      const F = []; let d = 0;
      for (let i = 0; i < n; i++) { const f = this.feat(kind, M.image("train", i)); F.push(f); d = f.length; }
      const G = new Float64Array(d * d);
      for (let i = 0; i < n; i++) { // sparse-aware outer product accumulation
        const f = F[i], nz = []; for (let a = 0; a < d; a++) if (f[a] !== 0) nz.push(a);
        for (const a of nz) { const fa = f[a], row = a * d; for (const b of nz) G[row + b] += fa * f[b]; }
      }
      for (let a = 0; a < d - 1; a++) G[a * d + a] += lam; // intercept (last feature) unpenalized
      const A = invert(G, d);
      // beta = A H^T Y (d x 10) for the proxy's test accuracy
      const HtY = new Float64Array(d * 10); for (let i = 0; i < n; i++) { const f = F[i], y = M.label("train", i); for (let a = 0; a < d; a++) if (f[a] !== 0) HtY[a * 10 + y] += f[a]; }
      const beta = new Float64Array(d * 10); for (let a = 0; a < d; a++) for (let k = 0; k < 10; k++) { let s = 0; for (let b = 0; b < d; b++) s += A[a * d + b] * HtY[b * 10 + k]; beta[a * 10 + k] = s; }
      let correct = 0; for (let i = 0; i < M.nTest; i++) { const f = this.feat(kind, M.image("test", i)); let best = 0, bv = -Infinity; for (let k = 0; k < 10; k++) { let s = 0; for (let a = 0; a < d; a++) if (f[a] !== 0) s += f[a] * beta[a * 10 + k]; if (s > bv) { bv = s; best = k; } } if (best === M.label("test", i)) correct++; }
      return (this.cache[kind] = { F, A, d, lam, acc: correct / M.nTest });
    },
    draw() {
      const ctx = this.ctx, kind = $("wtFeat").value, M = this.M; ctx.clearRect(0, 0, 760, 440);
      if (!this.cache[kind]) { text(ctx, kind === "hidden" ? "computing the 65 × 65 smoother …" : "computing the 785 × 785 smoother (a few seconds) …", 10, 40, { size: 16, color: "#555" }); setTimeout(() => { this.build(kind); this.draw(); }, 30); return; }
      const S = this.build(kind), x = M.image("test", this.idx), y = M.label("test", this.idx), f = this.feat(kind, x), d = S.d;
      const v = new Float64Array(d); for (let a = 0; a < d; a++) { let s = 0; for (let b = 0; b < d; b++) s += S.A[a * d + b] * f[b]; v[a] = s; }
      const w = new Float64Array(M.nTrain), yhat = new Float64Array(10); let sum = 0, sq = 0;
      for (let i = 0; i < M.nTrain; i++) { const fi = S.F[i]; let s = 0; for (let a = 0; a < d; a++) if (fi[a] !== 0) s += fi[a] * v[a]; w[i] = s; sum += s; sq += s * s; yhat[M.label("train", i)] += s; }
      const order = Array.from(w.keys()).sort((a, b) => Math.abs(w[b]) - Math.abs(w[a]));
      // query digit
      rect(ctx, 10, 30, 112, 112, "#fff", C.x, 2); NN.drawDigit(ctx, x, 10, 30, 4); text(ctx, `x   (true label ${y})`, 66, 160, { size: 14, align: "center", color: C.x, weight: 600 });
      const netPred = this.net.predict(x); text(ctx, `network predicts ${netPred}`, 66, 180, { size: 13, align: "center", color: "#555" });
      // top training images
      text(ctx, "training digits with the largest |wᵢ(x)|", 150, 22, { size: 14, color: "#555" });
      for (let k = 0; k < 12; k++) { const i = order[k], x0 = 150 + (k % 6) * 62, y0 = 30 + Math.floor(k / 6) * 92; NN.drawDigit(ctx, M.image("train", i), x0, y0, 2); rect(ctx, x0, y0, 56, 56, null, w[i] >= 0 ? C.loss : C.x, 2); text(ctx, `${w[i] >= 0 ? "+" : "−"}${fmt(Math.abs(w[i]), 3)}`, x0 + 28, y0 + 72, { size: 12, align: "center", mono: true, color: w[i] >= 0 ? C.loss : C.x }); text(ctx, `y=${M.label("train", i)}`, x0 + 28, y0 + 86, { size: 11, align: "center", color: "#777" }); }
      text(ctx, "red: positive weight · blue: negative weight", 150, 222, { size: 12, color: "#777" });
      // yhat bars
      const bx = 540; text(ctx, "ŷₖ(x) = Σᵢ wᵢ(x) 1{yᵢ = k}", bx, 22, { size: 14, color: C.p });
      let ymax = 0.05; for (let k = 0; k < 10; k++) ymax = Math.max(ymax, Math.abs(yhat[k]));
      let pred = 0; for (let k = 1; k < 10; k++) if (yhat[k] > yhat[pred]) pred = k;
      bars(ctx, Array.from(yhat), bx, 30, 210, 150, { min: -ymax, max: ymax, color: (k) => (k === pred ? C.p : "#cdb6e0"), labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      text(ctx, `smoother predicts ${pred}`, bx, 215, { size: 14, color: pred === y ? C.h : C.loss, weight: 600 });
      // weight profile: all 5000 weights sorted
      const px = 10, py = 260, pw = 730, ph = 120; rect(ctx, px, py, pw, ph, "#fafafa", "#ddd");
      text(ctx, `all ${M.nTrain.toLocaleString()} weights wᵢ(x), sorted`, px + 6, py - 6, { size: 14, color: "#555" });
      const sorted = Array.from(w).sort((a, b) => b - a); let wm = Math.max(1e-6, Math.abs(sorted[0]), Math.abs(sorted[sorted.length - 1]));
      const y0 = py + ph / 2; ctx.save(); ctx.strokeStyle = "#999"; ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px + pw, y0); ctx.stroke(); ctx.restore();
      for (let i = 0; i < sorted.length; i++) { const xx = px + 2 + (pw - 4) * i / sorted.length, hh = sorted[i] / wm * (ph / 2 - 6); rect(ctx, xx, Math.min(y0, y0 - hh), Math.max(0.5, (pw - 4) / sorted.length), Math.abs(hh), sorted[i] >= 0 ? C.loss : C.x); }
      text(ctx, `Σᵢ wᵢ(x) = ${fmt(sum, 3)}`, px, py + ph + 24, { size: 15, mono: true });
      text(ctx, `effective neighbours (Σw)²/Σw² = ${Math.round(sum * sum / sq)}`, px + 230, py + ph + 24, { size: 15, mono: true });
      text(ctx, `smoother test accuracy ${(100 * S.acc).toFixed(1)}%`, px + pw, py + ph + 48, { size: 15, mono: true, color: ACCENT, align: "right" });
      text(ctx, kind === "hidden" ? "features: 64 learned hidden units + intercept, ridge λ = 0.001" : "features: 784 raw pixels + intercept, ridge λ = 1", px, py + ph + 48, { size: 13, color: "#777" });
    },
  };
})();
