/* widgets_core.js -- shared helpers and the widgets for slides 1-7. */
(function () {
  "use strict";
  const C = NN.COLORS;
  const $ = (id) => document.getElementById(id);
  const W = (window.Widgets = window.Widgets || {});
  const State = (window.DeckState = window.DeckState || { digitIdx: 0, liveModel: null });

  // ---------- canvas helpers ----------------------------------------------
  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = `${o.weight || 400} ${o.size || 16}px ${o.mono ? '"SF Mono", Menlo, monospace' : '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif'}`;
    ctx.fillStyle = o.color || C.ink; ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
    ctx.fillText(s, x, y);
  }
  function line(ctx, x1, y1, x2, y2, color, width, dash) {
    ctx.save(); ctx.strokeStyle = color || C.ink; ctx.lineWidth = width || 1; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function arrow(ctx, x1, y1, x2, y2, color, width) {
    line(ctx, x1, y1, x2, y2, color, width);
    const a = Math.atan2(y2 - y1, x2 - x1), s = 6 + (width || 1) * 2;
    ctx.save(); ctx.fillStyle = color || C.ink; ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4)); ctx.lineTo(x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function circle(ctx, x, y, r, fill, stroke, width) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1.5; ctx.stroke(); }
  }
  function rect(ctx, x, y, w, h, fill, stroke, width) {
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.strokeRect(x, y, w, h); }
  }
  // Vertical bar chart. vals in [min,max]; zero line drawn when min<0.
  function bars(ctx, vals, x0, y0, w, h, o) {
    o = o || {};
    const n = vals.length, bw = w / n, min = o.min != null ? o.min : 0, max = o.max != null ? o.max : 1;
    const yOf = (v) => y0 + h - (v - min) / (max - min) * h;
    line(ctx, x0, yOf(0), x0 + w, yOf(0), "#999", 1);
    for (let k = 0; k < n; k++) {
      const v = Math.max(min, Math.min(max, vals[k]));
      const col = typeof o.color === "function" ? o.color(k, vals[k]) : (o.color || C.p);
      const y1 = yOf(v), y2 = yOf(0);
      rect(ctx, x0 + k * bw + bw * 0.15, Math.min(y1, y2), bw * 0.7, Math.abs(y2 - y1), col);
      if (o.labels) text(ctx, o.labels[k], x0 + k * bw + bw / 2, y0 + h + 15, { size: o.labelSize || 13, align: "center", color: "#555" });
    }
  }
  function fmt(v, d) { return (Math.abs(v) < 1e-12 ? 0 : v).toFixed(d == null ? 2 : d); }
  function bindVal(inputId, valId, f) { const i = $(inputId), v = $(valId); const upd = () => { v.textContent = f ? f(parseFloat(i.value)) : i.value; }; i.addEventListener("input", upd); upd(); return i; }
  // Draw an n x n scalar field onto a canvas region via ImageData (fast heatmap).
  function heatmap(ctx, field, n, x0, y0, w, h, colorFn) {
    const off = document.createElement("canvas"); off.width = n; off.height = n;
    const octx = off.getContext("2d"), img = octx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { const [r, g, b] = colorFn(field[i]); img.data[4 * i] = r; img.data[4 * i + 1] = g; img.data[4 * i + 2] = b; img.data[4 * i + 3] = 255; }
    octx.putImageData(img, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, x0, y0, w, h); ctx.restore();
  }
  // Two-class probability colour: 0 -> orange, 0.5 -> white, 1 -> blue.
  function probColor(p) {
    const t = (p - 0.5) * 2;
    if (t >= 0) return [Math.round(255 - 224 * t), Math.round(255 - 144 * t), Math.round(255 - 77 * t)];
    const a = -t; return [Math.round(255 - 38 * a), Math.round(255 - 152 * a), Math.round(255 - 225 * a)];
  }
  function parseRGB(s) { const m = s.match(/\d+/g); return [+m[0], +m[1], +m[2]]; }
  function run(widget, step) { // rAF loop helper: widget.running flag
    if (widget._raf) return;
    const loop = () => { if (!widget.running) { widget._raf = null; return; } step(); widget._raf = requestAnimationFrame(loop); };
    widget._raf = requestAnimationFrame(loop);
  }
  function stop(widget) { widget.running = false; if (widget._raf) { cancelAnimationFrame(widget._raf); widget._raf = null; } }

  window.WH = { $, text, line, arrow, circle, rect, bars, fmt, bindVal, heatmap, probColor, parseRGB, run, stop, State };

  // ========== 1. title network glyph =======================================
  W.titleNet = {
    init(s) { this.cv = $("titleCanvas"); this.ctx = NN.setupCanvas(this.cv, 520, 460); this.t = 0; },
    enter() { this.running = true; run(this, () => this.draw()); },
    leave() { stop(this); },
    draw() {
      const ctx = this.ctx, t = (this.t += 0.012);
      ctx.clearRect(0, 0, 520, 460);
      const layers = [5, 7, 7, 3], xs = [60, 190, 330, 460], cols = [C.x, C.h, C.h, C.p];
      const pos = layers.map((n, li) => Array.from({ length: n }, (_, j) => [xs[li], 230 + (j - (n - 1) / 2) * 52]));
      for (let li = 0; li < layers.length - 1; li++) for (const a of pos[li]) for (const b of pos[li + 1]) line(ctx, a[0], a[1], b[0], b[1], "#dedede", 1);
      // pulses
      const ph = (t % 1);
      for (let li = 0; li < layers.length - 1; li++) {
        const seg = ((t * 1.0) % (layers.length - 1)) | 0; if (seg !== li) continue;
        for (const a of pos[li]) for (const b of pos[li + 1]) {
          if (((a[1] * 7 + b[1] * 3) | 0) % 5 !== 0) continue;
          circle(ctx, a[0] + (b[0] - a[0]) * ph, a[1] + (b[1] - a[1]) * ph, 3, C.w);
        }
      }
      pos.forEach((L, li) => L.forEach((p) => circle(ctx, p[0], p[1], 15, "#fff", cols[li], 2.5)));
    },
  };

  // ========== 2. digits ====================================================
  W.digits = {
    init(s) {
      const M = NN.getMNIST(); this.M = M;
      const grid = $("digitGrid"); this.cells = [];
      for (let i = 0; i < 40; i++) {
        const cv = document.createElement("canvas"); const ctx = NN.setupCanvas(cv, 50, 50);
        NN.drawDigit(ctx, M.image("test", i), 0, 0, 50 / 28); cv.title = "label " + M.label("test", i);
        cv.addEventListener("click", () => this.select(i)); grid.appendChild(cv); this.cells.push(cv);
      }
      this.big = $("digitBig"); this.bctx = NN.setupCanvas(this.big, 280, 304);
      this.big.addEventListener("mousemove", (e) => { const [mx, my] = NN.localXY(e, this.big); const c = Math.floor(mx / 10), rr = Math.floor(my / 10); if (c < 0 || c > 27 || rr < 0 || rr > 27) return; const v = this.M.image("test", this.idx)[rr * 28 + c]; $("digitInfo").innerHTML = `row ${rr + 1}, column ${c + 1}: pixel value <b>${fmt(v)}</b>`; this.draw(rr, c); });
      this.big.addEventListener("mouseleave", () => this.draw());
      this.select(0);
    },
    select(i) { this.idx = i; State.digitIdx = i; this.cells.forEach((c, j) => c.classList.toggle("sel", j === i)); this.draw(); },
    draw(hr, hc) {
      const ctx = this.bctx, img = this.M.image("test", this.idx);
      ctx.clearRect(0, 0, 280, 304); rect(ctx, 0, 0, 280, 280, "#fff");
      NN.drawDigit(ctx, img, 0, 0, 10);
      for (let k = 0; k <= 28; k++) { line(ctx, k * 10, 0, k * 10, 280, "#eee"); line(ctx, 0, k * 10, 280, k * 10, "#eee"); }
      if (hr != null) rect(ctx, hc * 10, hr * 10, 10, 10, null, C.w, 2.5);
      text(ctx, `label y = ${this.M.label("test", this.idx)}`, 0, 300, { size: 18, weight: 600, color: C.accent || "#00356b" });
    },
  };

  // ========== 3. unroll ====================================================
  W.unroll = {
    init(s) {
      this.M = NN.getMNIST(); this.ctx = NN.setupCanvas($("unrollCanvas"), 680, 440);
      this.row = bindVal("unrollRow", "unrollRowVal", (v) => String(v + 1));
      this.row.addEventListener("input", () => this.draw());
    },
    enter() { this.idx = State.digitIdx || 0; this.draw(); },
    draw() {
      const ctx = this.ctx, img = this.M.image("test", this.idx), r = parseInt(this.row.value, 10);
      ctx.clearRect(0, 0, 680, 440);
      const s = 9, x0 = 10, y0 = 10;
      NN.drawDigit(ctx, img, x0, y0, s);
      for (let k = 0; k <= 28; k++) { line(ctx, x0 + k * s, y0, x0 + k * s, y0 + 28 * s, "#eee"); line(ctx, x0, y0 + k * s, x0 + 28 * s, y0 + k * s, "#eee"); }
      rect(ctx, x0, y0 + r * s, 28 * s, s, null, C.x, 3);
      text(ctx, `row ${r + 1}`, x0 + 28 * s + 10, y0 + r * s + s - 1, { size: 15, color: C.x, weight: 600 });
      // strip: 4 rows of 196 values, 3px each
      const sx = 10, sy = 300, cw = 3.3, rows = 4, per = 196;
      for (let i = 0; i < 784; i++) {
        const rr = Math.floor(i / per), cc = i % per, v = img[i];
        rect(ctx, sx + cc * cw, sy + rr * 22, cw, 18, v > 0.002 ? NN.grayColor(v) : "#fafafa");
      }
      for (let rr = 0; rr < rows; rr++) { text(ctx, `x${rr * per + 1}`, sx, sy + rr * 22 - 3, { size: 11, color: "#888", mono: true }); text(ctx, `x${(rr + 1) * per}`, sx + per * cw, sy + rr * 22 - 3, { size: 11, color: "#888", mono: true, align: "right" }); }
      // highlight the row's 28 entries in the strip
      const i0 = r * 28, rr = Math.floor(i0 / per), cc = i0 % per;
      rect(ctx, sx + cc * cw, sy + rr * 22, 28 * cw, 18, null, C.x, 3);
      // arrow from image row to strip
      arrow(ctx, x0 + 28 * s + 60, y0 + r * s + s / 2, sx + cc * cw + 14 * cw, sy + rr * 22 - 6, C.x, 1.5);
      text(ctx, "784 numbers, in four lines of 196", sx + 330, sy - 8, { size: 15, color: "#666" });
      // values of the row
      const vals = Array.from(img.subarray(i0, i0 + 28)).map((v) => fmt(v, 2).replace(/^0\./, "."));
      text(ctx, `x${i0 + 1} … x${i0 + 28} =  ` + vals.slice(0, 14).join("  "), sx, 418, { size: 13, mono: true, color: C.x });
      text(ctx, "                 " + vals.slice(14).join("  "), sx, 436, { size: 13, mono: true, color: C.x });
    },
  };

  // ========== 4. logistic regression templates =============================
  W.logreg = {
    init(s) {
      this.M = NN.getMNIST(); this.P = NN.getPretrained().logreg;
      this.model = new NN.MLP({ inDim: 784, hidden: 0, outDim: 10 }); this.model.setWeights({ W: this.P.W, b: this.P.b });
      this.cv = $("logregCanvas"); this.ctx = NN.setupCanvas(this.cv, 700, 480);
      this.sel = 0; this.rng = new NN.RNG(7);
      $("logregRandom").addEventListener("click", () => { this.idx = Math.floor(this.rng.next() * this.M.nTest); State.digitIdx = this.idx; this.draw(); });
      this.cv.addEventListener("click", (e) => { const [x, y] = NN.localXY(e, this.cv); if (y > 250 && y < 340) { const k = Math.floor((x - 10) / 69); if (k >= 0 && k < 10) { this.sel = k; this.draw(); } } });
      this.vmax = 0; for (let i = 0; i < this.P.W.length; i++) this.vmax = Math.max(this.vmax, Math.abs(this.P.W[i])); this.vmax *= 0.6;
    },
    enter() { this.idx = State.digitIdx || 0; this.draw(); },
    draw() {
      const ctx = this.ctx, img = this.M.image("test", this.idx), y = this.M.label("test", this.idx);
      ctx.clearRect(0, 0, 700, 480);
      const out = this.model.forward1(img);
      // top: digit, enlarged template, scores
      NN.drawDigit(ctx, img, 10, 10, 5); rect(ctx, 10, 10, 140, 140, null, "#ddd");
      text(ctx, `x  (true label ${y})`, 80, 170, { size: 15, align: "center", color: C.x, weight: 600 });
      NN.drawWeightImage(ctx, this.P.W, this.sel, 10, 180, 10, 5, 28, this.vmax);
      text(ctx, `θ${this.sel}`, 250, 170, { size: 15, align: "center", color: C.w, weight: 600 });
      text(ctx, "×  then sum  →", 330, 85, { size: 16, color: "#555" });
      const z = out.z2, p = out.p; let zmax = 1; for (let k = 0; k < 10; k++) zmax = Math.max(zmax, Math.abs(z[k]));
      text(ctx, "score  θₖ·x + bₖ", 480, 25, { size: 14, color: C.w });
      bars(ctx, Array.from(z), 470, 30, 220, 60, { min: -zmax, max: zmax, color: (k) => (k === this.sel ? C.w : "#f2c4a4") });
      text(ctx, "probability  pₖ = softmax", 480, 112, { size: 14, color: C.p });
      bars(ctx, Array.from(p), 470, 118, 220, 50, { min: 0, max: 1, color: (k) => (k === y ? C.p : "#cdb6e0"), labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      let pred = 0; for (let k = 1; k < 10; k++) if (p[k] > p[pred]) pred = k;
      text(ctx, `predicted ${pred}, p = ${fmt(p[pred])}`, 470, 215, { size: 15, color: pred === y ? C.h : C.loss, weight: 600 });
      // templates row
      text(ctx, "the ten templates θ₀ … θ₉", 10, 245, { size: 15, color: "#555" });
      for (let k = 0; k < 10; k++) {
        const x0 = 10 + k * 69;
        NN.drawWeightImage(ctx, this.P.W, k, 10, x0, 255, 2.2, 28, this.vmax);
        if (k === this.sel) rect(ctx, x0 - 2, 253, 66, 66, null, C.accent || "#00356b", 3);
        text(ctx, String(k), x0 + 31, 340, { size: 14, align: "center", color: "#555" });
      }
      // colour key
      for (let i = 0; i < 60; i++) rect(ctx, 10 + i * 3, 370, 3, 12, NN.divergeColor((i - 30) / 30, 1));
      text(ctx, "negative weight", 10, 400, { size: 13, color: C.x }); text(ctx, "positive weight", 190, 400, { size: 13, color: C.loss, align: "right" });
      text(ctx, "A template is the pixel pattern that raises the score for that class.", 10, 440, { size: 15, color: "#555" });
    },
  };

  // ========== 5. linear limit =============================================
  W.linearLimit = {
    init(s) {
      this.ctx = NN.setupCanvas($("linCanvas"), 460, 460);
      $("linData").addEventListener("change", () => this.reset()); $("linReset").addEventListener("click", () => this.reset());
      this.reset();
    },
    enter() { this.running = true; run(this, () => this.step()); },
    leave() { stop(this); },
    reset() { this.data = NN.makeDataset($("linData").value, 200, 11); this.model = new NN.MLP({ inDim: 2, hidden: 0, outDim: 2, seed: 3 }); this.steps = 0; this.idx = Array.from({ length: 200 }, (_, i) => i); this.running = true; run(this, () => this.step()); this.draw(); },
    step() { if (this.steps >= 300) { this.running = false; return; } for (let k = 0; k < 5; k++) { this.model.trainBatch(this.data.X, this.data.Y, this.idx, 0.5, 0, 0); this.steps++; } this.draw(); },
    draw() {
      const ctx = this.ctx, n = 50, field = new Float32Array(n * n), x = new Float32Array(2);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x[0] = -1 + 2 * (j + 0.5) / n; x[1] = 1 - 2 * (i + 0.5) / n; field[i * n + j] = this.model.forward1(x).p[1]; }
      ctx.clearRect(0, 0, 460, 460); heatmap(ctx, field, n, 0, 0, 460, 460, probColor);
      drawPoints(ctx, this.data, 0, 0, 460);
      const ev = this.model.evaluate(this.data.X, this.data.Y, 200, false);
      $("linStat").innerHTML = `accuracy <b>${(100 * ev.acc).toFixed(0)}%</b> after ${this.steps} steps`;
      rect(ctx, 0, 0, 460, 460, null, "#ccc");
    },
  };
  function drawPoints(ctx, data, x0, y0, size) {
    for (let i = 0; i < data.n; i++) {
      const px = x0 + (data.X[2 * i] + 1) / 2 * size, py = y0 + (1 - data.X[2 * i + 1]) / 2 * size;
      circle(ctx, px, py, 4.5, data.Y[i] === 1 ? C.class1 : C.class0, "#fff", 1.2);
    }
  }
  window.WH.drawPoints = drawPoints;

  // ========== 6. one neuron ===============================================
  W.neuron = {
    init(s) {
      this.ctx = NN.setupCanvas($("neuronCanvas"), 700, 420);
      const upd = () => this.draw();
      this.w1 = bindVal("nW1", "nW1v", (v) => fmt(v, 1)); this.w2 = bindVal("nW2", "nW2v", (v) => fmt(v, 1)); this.b = bindVal("nB", "nBv", (v) => fmt(v, 1));
      [this.w1, this.w2, this.b, $("nAct")].forEach((e) => e.addEventListener("input", upd));
      this.draw();
    },
    draw() {
      const ctx = this.ctx, w1 = +this.w1.value, w2 = +this.w2.value, b = +this.b.value, act = NN.ACT[$("nAct").value];
      ctx.clearRect(0, 0, 700, 420);
      // diagram
      const X1 = [50, 130], X2 = [50, 290], S = [190, 210], G = [280, 210], A = [360, 210];
      arrow(ctx, X1[0] + 22, X1[1], S[0] - 24, S[1] - 10, C.w, 1 + Math.abs(w1) * 0.9);
      arrow(ctx, X2[0] + 22, X2[1], S[0] - 24, S[1] + 10, C.w, 1 + Math.abs(w2) * 0.9);
      arrow(ctx, S[0] + 24, S[1], G[0] - 26, G[1], C.ink, 1.5); arrow(ctx, G[0] + 26, G[1], A[0] - 22, A[1], C.h, 1.5);
      arrow(ctx, S[0], S[1] + 90, S[0], S[1] + 26, C.w, 1 + Math.abs(b) * 0.9);
      circle(ctx, X1[0], X1[1], 22, "#fff", C.x, 2.5); text(ctx, "x₁", X1[0], X1[1] + 6, { size: 18, align: "center", color: C.x, weight: 600 });
      circle(ctx, X2[0], X2[1], 22, "#fff", C.x, 2.5); text(ctx, "x₂", X2[0], X2[1] + 6, { size: 18, align: "center", color: C.x, weight: 600 });
      circle(ctx, S[0], S[1], 24, "#fff", C.ink, 2); text(ctx, "Σ", S[0], S[1] + 7, { size: 22, align: "center" });
      rect(ctx, G[0] - 26, G[1] - 22, 52, 44, "#fff", C.ink, 2); text(ctx, "φ", G[0], G[1] + 7, { size: 20, align: "center" });
      circle(ctx, A[0], A[1], 22, "#fff", C.h, 2.5); text(ctx, "a", A[0], A[1] + 6, { size: 18, align: "center", color: C.h, weight: 600 });
      text(ctx, `θ₁ = ${fmt(w1, 1)}`, 100, 150, { size: 15, color: C.w, weight: 600 }); text(ctx, `θ₂ = ${fmt(w2, 1)}`, 100, 275, { size: 15, color: C.w, weight: 600 });
      text(ctx, `b = ${fmt(b, 1)}`, S[0] + 10, S[1] + 85, { size: 15, color: C.w, weight: 600 });
      text(ctx, "z = θ₁x₁ + θ₂x₂ + b", 60, 380, { size: 16, color: "#555" }); text(ctx, "a = φ(z)", 60, 404, { size: 16, color: "#555" });
      // plane
      const n = 60, field = new Float32Array(n * n), px0 = 420, size = 280, py0 = 70;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = -2 + 4 * (j + 0.5) / n, y = 2 - 4 * (i + 0.5) / n; const a = act.f(w1 * x + w2 * y + b); field[i * n + j] = a; lo = Math.min(lo, a); hi = Math.max(hi, a); }
      const range = act === NN.ACT.sigmoid ? [0, 1] : act === NN.ACT.tanh ? [-1, 1] : [Math.min(lo, 0), Math.max(hi, 1e-6)];
      heatmap(ctx, field, n, px0, py0, size, size, (v) => probColor((v - range[0]) / (range[1] - range[0])));
      rect(ctx, px0, py0, size, size, null, "#ccc");
      // boundary z = 0
      if (Math.abs(w1) + Math.abs(w2) > 1e-6) {
        const pts = [];
        for (const x of [-2, 2]) if (Math.abs(w2) > 1e-6) pts.push([x, -(w1 * x + b) / w2]);
        for (const y of [-2, 2]) if (Math.abs(w1) > 1e-6) pts.push([-(w2 * y + b) / w1, y]);
        const inb = pts.filter((p) => p[0] >= -2.001 && p[0] <= 2.001 && p[1] >= -2.001 && p[1] <= 2.001);
        if (inb.length >= 2) { const toPx = (p) => [px0 + (p[0] + 2) / 4 * size, py0 + (2 - p[1]) / 4 * size]; const a = toPx(inb[0]), bpt = toPx(inb[inb.length - 1]); line(ctx, a[0], a[1], bpt[0], bpt[1], C.ink, 2.5, [8, 5]); }
      }
      text(ctx, "x₁", px0 + size + 8, py0 + size / 2 + 5, { size: 16, color: C.x, weight: 600 }); text(ctx, "x₂", px0 + size / 2 - 6, py0 - 10, { size: 16, color: C.x, weight: 600 });
      text(ctx, `shading: a = φ(z)   dashed: z = 0`, px0, py0 + size + 24, { size: 14, color: "#555" });
      text(ctx, `a ranges from ${fmt(range[0], 1)} to ${fmt(range[1], 1)}`, px0, py0 + size + 44, { size: 14, color: "#555" });
    },
  };

  // ========== 7. activations =============================================
  W.activations = {
    init(s) {
      this.ctx = NN.setupCanvas($("actCanvas"), 620, 400); this.cur = "sigmoid";
      const box = $("actButtons");
      for (const k of ["sigmoid", "tanh", "relu"]) { const b = document.createElement("button"); b.textContent = NN.ACT[k].name; b.addEventListener("click", () => { this.cur = k; this.draw(); }); box.appendChild(b); }
      this.draw();
    },
    draw() {
      const ctx = this.ctx, act = NN.ACT[this.cur];
      Array.from($("actButtons").children).forEach((b) => b.classList.toggle("primary", b.textContent === act.name));
      ctx.clearRect(0, 0, 620, 400);
      const x0 = 50, y0 = 20, w = 540, h = 340, zmin = -5, zmax = 5, ymin = -1.5, ymax = 2.5;
      const X = (z) => x0 + (z - zmin) / (zmax - zmin) * w, Y = (v) => y0 + (ymax - v) / (ymax - ymin) * h;
      for (let v = -1; v <= 2; v++) { line(ctx, x0, Y(v), x0 + w, Y(v), "#eee"); text(ctx, String(v), x0 - 8, Y(v) + 5, { size: 13, align: "right", color: "#777" }); }
      for (let z = -4; z <= 4; z += 2) { line(ctx, X(z), y0, X(z), y0 + h, "#eee"); text(ctx, String(z), X(z), y0 + h + 18, { size: 13, align: "center", color: "#777" }); }
      line(ctx, x0, Y(0), x0 + w, Y(0), "#999"); line(ctx, X(0), y0, X(0), y0 + h, "#999");
      text(ctx, "z", x0 + w + 6, Y(0) + 5, { size: 16, color: "#555" });
      const plot = (f, color, dash) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let i = 0; i <= 300; i++) { const z = zmin + (zmax - zmin) * i / 300, v = Math.max(ymin, Math.min(ymax, f(z))); i === 0 ? ctx.moveTo(X(z), Y(v)) : ctx.lineTo(X(z), Y(v)); } ctx.stroke(); ctx.restore(); };
      plot(act.f, C.h); plot(act.df, C.loss, [8, 6]);
      text(ctx, "φ(z)", X(3.2), Y(act.f(3.2)) - 12, { size: 16, color: C.h, weight: 600 }); text(ctx, "φ′(z)", X(-3.6), Y(act.df(-3.6)) - 12, { size: 16, color: C.loss, weight: 600 });
      const eqs = { sigmoid: "\\begin{aligned} \\varphi(z) &= \\sigma(z)=\\frac{1}{1+e^{-z}} \\\\ \\varphi'(z) &= \\sigma(z)\\,(1-\\sigma(z)) \\end{aligned}", tanh: "\\begin{aligned} \\varphi(z) &= \\tanh(z) \\\\ \\varphi'(z) &= 1-\\tanh^2(z) \\end{aligned}", relu: "\\begin{aligned} \\varphi(z) &= \\max(0,z) \\\\ \\varphi'(z) &= \\mathbf{1}\\{z>0\\} \\end{aligned}" };
      katex.render(eqs[this.cur], $("actEq"), { throwOnError: false, displayMode: true });
    },
  };
})();
