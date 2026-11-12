/* widgets_mid.js -- slides 8-15: hidden layer, shapes, forward pass, loss, gradient descent, backprop, SGD. */
(function () {
  "use strict";
  const C = NN.COLORS, H = window.WH, W = window.Widgets, State = H.State;
  const { $, text, line, arrow, circle, rect, bars, fmt, bindVal, heatmap, probColor, run, stop, drawPoints } = H;
  const ACCENT = "#00356b";

  // ========== 8. playground ===============================================
  W.playground = {
    init(s) {
      this.ctx = NN.setupCanvas($("pgCanvas"), 760, 440);
      this.hid = bindVal("pgHidden", "pgHiddenV"); this.lr = bindVal("pgLr", "pgLrV", (v) => fmt(Math.pow(10, v), 3));
      $("pgData").addEventListener("change", () => this.reset()); this.hid.addEventListener("change", () => this.reset()); $("pgAct").addEventListener("change", () => this.reset());
      $("pgReset").addEventListener("click", () => this.reset());
      $("pgRun").addEventListener("click", () => { this.running = !this.running; $("pgRun").textContent = this.running ? "pause" : "run"; if (this.running) run(this, () => this.step()); });
      this.reset();
    },
    leave() { stop(this); $("pgRun").textContent = "run"; },
    reset() {
      stop(this); $("pgRun").textContent = "run";
      this.data = NN.makeDataset($("pgData").value, 300, 21);
      this.model = new NN.MLP({ inDim: 2, hidden: +this.hid.value, outDim: 2, act: $("pgAct").value, seed: 11 });
      this.losses = []; this.rng = new NN.RNG(9); this.step_ = 0; this.draw();
    },
    step() {
      const lr = Math.pow(10, +this.lr.value), n = this.data.n, bsz = 32;
      for (let k = 0; k < 12; k++) {
        const idx = Array.from({ length: bsz }, () => Math.floor(this.rng.next() * n));
        const l = this.model.trainBatch(this.data.X, this.data.Y, idx, lr, 1e-4, 0.9); this.step_++;
        if (this.step_ % 4 === 0) this.losses.push(l);
      }
      this.draw();
    },
    draw() {
      const ctx = this.ctx, m = this.model, n = 56, size = 400;
      ctx.clearRect(0, 0, 760, 440);
      const field = new Float32Array(n * n), x = new Float32Array(2);
      const hid = m.hidden, unitFields = hid ? Array.from({ length: hid }, () => new Float32Array(n * n)) : [];
      let hmax = 1e-6;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x[0] = -1 + 2 * (j + 0.5) / n; x[1] = 1 - 2 * (i + 0.5) / n; const out = m.forward1(x); field[i * n + j] = out.p[1];
        for (let u = 0; u < hid; u++) { unitFields[u][i * n + j] = out.h[u]; hmax = Math.max(hmax, Math.abs(out.h[u])); }
      }
      heatmap(ctx, field, n, 0, 10, size, size, probColor); drawPoints(ctx, this.data, 0, 10, size); rect(ctx, 0, 10, size, size, null, "#ccc");
      text(ctx, "p(class = blue | x)", 0, 432, { size: 14, color: "#555" });
      // hidden units
      const cols = 4, cell = 66, gx = 420, gy = 10;
      text(ctx, hid ? `the ${hid} hidden units  h₁ … h${hid}` : "no hidden layer", gx, gy - 0 + 0, { size: 14, color: C.h, weight: 600 });
      const lo = m.actName === "tanh" ? -1 : 0, hi = m.actName === "tanh" ? 1 : (m.actName === "sigmoid" ? 1 : hmax);
      for (let u = 0; u < hid; u++) {
        const cx = gx + (u % cols) * (cell + 8), cy = gy + 10 + Math.floor(u / cols) * (cell + 8);
        heatmap(ctx, unitFields[u], n, cx, cy, cell, cell, (v) => probColor((v - lo) / (hi - lo)));
        rect(ctx, cx, cy, cell, cell, null, "#ccc");
      }
      // loss curve
      const lx = 420, ly = 330, lw = 320, lh = 90;
      rect(ctx, lx, ly, lw, lh, "#fafafa", "#ddd");
      text(ctx, "training loss", lx + 4, ly + 14, { size: 13, color: C.loss });
      if (this.losses.length > 1) {
        const L = this.losses, maxL = Math.max(0.8, ...L.slice(0, 20)); ctx.save(); ctx.strokeStyle = C.loss; ctx.lineWidth = 2; ctx.beginPath();
        L.forEach((v, i) => { const px = lx + 4 + (lw - 8) * i / (L.length - 1), py = ly + lh - 4 - Math.min(1, v / maxL) * (lh - 20); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); ctx.restore();
      }
      const ev = m.evaluate(this.data.X, this.data.Y, this.data.n, false);
      $("pgStat").innerHTML = `step ${this.step_} &nbsp; loss <b>${fmt(ev.loss, 3)}</b> &nbsp; accuracy <b>${(100 * ev.acc).toFixed(0)}%</b> &nbsp; ${m.nParams()} parameters`;
    },
  };

  // ========== 9. shapes ===================================================
  W.shapes = {
    init() { this.ctx = NN.setupCanvas($("shapesCanvas"), 600, 420); this.hid = bindVal("shHidden", "shHiddenV"); this.hid.addEventListener("input", () => this.draw()); this.draw(); },
    draw() {
      const ctx = this.ctx, m = +this.hid.value, sc = 0.44; ctx.clearRect(0, 0, 600, 420);
      const yC = 200, mh = (u) => Math.max(3, u * sc);
      const blocks = m > 0
        ? [["x", 784, 1, C.x, "784"], ["W₁", 784, m, C.w, `${m} × 784`], ["h", m, 1, C.h, `${m}`], ["W₂", m, 10, C.w, `10 × ${m}`], ["p", 10, 1, C.p, "10"]]
        : [["x", 784, 1, C.x, "784"], ["W", 784, 10, C.w, "10 × 784"], ["p", 10, 1, C.p, "10"]];
      let xcur = 30;
      const drawn = [];
      for (const [name, hgt, wid, col, dim] of blocks) {
        const hh = mh(hgt), ww = Math.max(wid === 1 ? 10 : 3, wid * sc);
        if (name.startsWith("W")) { // matrix: rows = output dim, cols = input dim; draw rotated to show rows x cols
          const rows = mh(wid), colsW = Math.max(3, hgt * sc);
          rect(ctx, xcur, yC - rows / 2, colsW, rows, col + "33", col, 2);
          text(ctx, name, xcur + colsW / 2, yC - rows / 2 - 10, { size: 18, align: "center", color: col, weight: 600 });
          text(ctx, dim, xcur + colsW / 2, yC + rows / 2 + 20, { size: 14, align: "center", color: "#555" });
          drawn.push([xcur, colsW]); xcur += colsW + 50;
        } else {
          rect(ctx, xcur, yC - hh / 2, ww, hh, col + "55", col, 2);
          text(ctx, name, xcur + ww / 2, yC - hh / 2 - 10, { size: 18, align: "center", color: col, weight: 600 });
          text(ctx, dim, xcur + ww / 2, yC + hh / 2 + 20, { size: 14, align: "center", color: "#555" });
          drawn.push([xcur, ww]); xcur += ww + 50;
        }
      }
      for (let i = 0; i < drawn.length - 1; i++) arrow(ctx, drawn[i][0] + drawn[i][1] + 6, yC, drawn[i + 1][0] - 6, yC, "#888", 1.5);
      const nP = m > 0 ? 784 * m + m + 10 * m + 10 : 7850;
      text(ctx, "drawn to scale: one unit = 0.44 px", 30, 400, { size: 14, color: "#777" });
      $("shStat").innerHTML = m > 0 ? `784·${m} + ${m} + 10·${m} + 10 = <b>${nP.toLocaleString()}</b> parameters` : `784·10 + 10 = <b>7,850</b> parameters (logistic regression)`;
    },
  };

  // ========== 10. forward pass with a drawing pad ===========================
  function preprocess(raw) { // centre and scale a 28x28 drawing the MNIST way: content box -> 20x20, centre of mass at centre
    let r0 = 28, r1 = -1, c0 = 28, c1 = -1, mass = 0;
    for (let r = 0; r < 28; r++) for (let c = 0; c < 28; c++) { const v = raw[r * 28 + c]; if (v > 0.05) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); mass += v; } }
    const out = new Float32Array(784); if (r1 < 0) return out;
    const bh = r1 - r0 + 1, bw = c1 - c0 + 1, s = 20 / Math.max(bh, bw);
    // resample into a 28x28 at scale s, box placed with its centre of mass at (14,14)
    let cm_r = 0, cm_c = 0;
    for (let r = 0; r < 28; r++) for (let c = 0; c < 28; c++) { const v = raw[r * 28 + c]; cm_r += v * r; cm_c += v * c; }
    cm_r /= mass; cm_c /= mass;
    for (let r = 0; r < 28; r++) for (let c = 0; c < 28; c++) {
      const sr = cm_r + (r - 14) / s, sc = cm_c + (c - 14) / s; // source coordinate
      const ir = Math.floor(sr), ic = Math.floor(sc); if (ir < 0 || ir > 26 || ic < 0 || ic > 26) continue;
      const fr = sr - ir, fc = sc - ic;
      const v = raw[ir * 28 + ic] * (1 - fr) * (1 - fc) + raw[ir * 28 + ic + 1] * (1 - fr) * fc + raw[(ir + 1) * 28 + ic] * fr * (1 - fc) + raw[(ir + 1) * 28 + ic + 1] * fr * fc;
      out[r * 28 + c] = Math.min(1, v);
    }
    return out;
  }
  function stamp(raw, gx, gy) { // soft brush at grid coordinates (floats)
    for (let r = Math.floor(gy) - 2; r <= Math.ceil(gy) + 2; r++) for (let c = Math.floor(gx) - 2; c <= Math.ceil(gx) + 2; c++) {
      if (r < 0 || r > 27 || c < 0 || c > 27) continue; const d2 = (r - gy) ** 2 + (c - gx) ** 2; const v = Math.exp(-d2 / 0.9);
      raw[r * 28 + c] = Math.min(1, raw[r * 28 + c] + v);
    }
  }
  function loadPretrainedMLP() { const P = NN.getPretrained().mlp; const m = new NN.MLP({ inDim: 784, hidden: P.hidden, outDim: 10, act: "relu" }); m.setWeights(P); return m; }
  H.loadPretrainedMLP = loadPretrainedMLP; H.preprocess = preprocess;

  W.forward = {
    init() {
      this.M = NN.getMNIST(); this.model = loadPretrainedMLP(); this.raw = new Float32Array(784);
      this.cv = $("fwCanvas"); this.ctx = NN.setupCanvas(this.cv, 740, 400); this.rng = new NN.RNG(13);
      const pad = { x: 10, y: 60, s: 8 }; this.pad = pad; let down = false, last = null;
      const toGrid = (e) => { const [lx, ly] = NN.localXY(e, this.cv); const x = lx - pad.x, y = ly - pad.y; return [x / pad.s - 0.5, y / pad.s - 0.5]; };
      const inside = (g) => g[0] >= -1 && g[0] <= 28 && g[1] >= -1 && g[1] <= 28;
      this.cv.addEventListener("pointerdown", (e) => { const g = toGrid(e); if (!inside(g)) return; down = true; last = g; stamp(this.raw, g[0], g[1]); this.draw(); });
      this.cv.addEventListener("pointermove", (e) => { if (!down) return; const g = toGrid(e); if (!inside(g)) return; const steps = Math.max(1, Math.ceil(Math.hypot(g[0] - last[0], g[1] - last[1]) * 2)); for (let k = 1; k <= steps; k++) stamp(this.raw, last[0] + (g[0] - last[0]) * k / steps, last[1] + (g[1] - last[1]) * k / steps); last = g; this.draw(); });
      window.addEventListener("pointerup", () => { down = false; });
      $("fwClear").addEventListener("click", () => { this.raw.fill(0); this.draw(); });
      $("fwRandom").addEventListener("click", () => { const i = Math.floor(this.rng.next() * this.M.nTest); this.raw.set(this.M.image("test", i)); this.draw(); });
      this.raw.set(this.M.image("test", State.digitIdx || 0)); this.draw();
    },
    draw() {
      const ctx = this.ctx, pad = this.pad; ctx.clearRect(0, 0, 740, 400);
      const x = preprocess(this.raw), out = this.model.forward1(x);
      // pad
      rect(ctx, pad.x, pad.y, 224, 224, "#fff", "#999", 2); NN.drawDigit(ctx, this.raw, pad.x, pad.y, pad.s);
      text(ctx, "draw here", pad.x, pad.y - 10, { size: 15, color: "#555" });
      // network input
      rect(ctx, 250, 60, 84, 84, "#fff", C.x, 2); NN.drawDigit(ctx, x, 250, 60, 3);
      text(ctx, "x", 292, 48, { size: 18, align: "center", color: C.x, weight: 600 }); text(ctx, "784 inputs", 292, 160, { size: 13, align: "center", color: "#555" });
      text(ctx, "centred, 28 × 28", 292, 176, { size: 12, align: "center", color: "#888" });
      arrow(ctx, 340, 102, 390, 102, C.w, 2); text(ctx, "W₁, ReLU", 365, 92, { size: 13, align: "center", color: C.w });
      // hidden 8x8
      const hx = 400, hy = 60, cs = 21; let hmax = 1e-6; for (let j = 0; j < 64; j++) hmax = Math.max(hmax, out.h[j]);
      for (let j = 0; j < 64; j++) { const v = out.h[j] / hmax; rect(ctx, hx + (j % 8) * cs, hy + Math.floor(j / 8) * cs, cs - 1, cs - 1, `rgba(42,157,92,${0.08 + 0.92 * v})`); }
      rect(ctx, hx, hy, 8 * cs, 8 * cs, null, C.h, 2);
      text(ctx, "h", hx + 4 * cs, 48, { size: 18, align: "center", color: C.h, weight: 600 }); text(ctx, "64 hidden units", hx + 4 * cs, hy + 8 * cs + 18, { size: 13, align: "center", color: "#555" });
      text(ctx, `${out.h.filter((v) => v > 0).length} active`, hx + 4 * cs, hy + 8 * cs + 34, { size: 12, align: "center", color: "#888" });
      arrow(ctx, hx + 8 * cs + 8, 102, hx + 8 * cs + 58, 102, C.w, 2); text(ctx, "W₂, softmax", hx + 8 * cs + 33, 92, { size: 13, align: "center", color: C.w });
      // output
      const ox = 640, oy = 60, bh = 170, bw = 110; let pred = 0; for (let k = 1; k < 10; k++) if (out.p[k] > out.p[pred]) pred = k;
      text(ctx, "p", ox + bw / 2, 48, { size: 18, align: "center", color: C.p, weight: 600 });
      for (let k = 0; k < 10; k++) { const yy = oy + k * 17; rect(ctx, ox + 18, yy, bw * 0.75 * out.p[k], 13, k === pred ? C.p : "#cdb6e0"); text(ctx, String(k), ox + 8, yy + 11, { size: 13, align: "center", color: k === pred ? C.p : "#555", weight: k === pred ? 700 : 400 }); }
      text(ctx, `${pred}  (p = ${fmt(out.p[pred])})`, ox + 18, oy + bh + 16, { size: 15, color: C.p, weight: 600 });
      // z strip
      text(ctx, "pre-activations z₁ = W₁x + b₁ (negative in blue, ReLU zeroes them)", 250, 330, { size: 13, color: "#555" });
      let zmax = 1e-6; for (let j = 0; j < 64; j++) zmax = Math.max(zmax, Math.abs(out.z1[j]));
      for (let j = 0; j < 64; j++) rect(ctx, 250 + j * 7.8, 340, 7, 24, NN.divergeColor(out.z1[j], zmax));
    },
  };

  // ========== 11. loss ====================================================
  W.loss = {
    init() { this.ctx = NN.setupCanvas($("lossCanvas"), 560, 400); this.p = bindVal("lossP", "lossPv", (v) => fmt(v, 2)); this.p.addEventListener("input", () => this.draw()); this.draw(); },
    draw() {
      const ctx = this.ctx, p = +this.p.value; ctx.clearRect(0, 0, 560, 400);
      const x0 = 60, y0 = 20, w = 470, h = 320, X = (v) => x0 + v * w, Y = (l) => y0 + h - Math.min(l, 5) / 5 * h;
      for (let l = 0; l <= 5; l++) { line(ctx, x0, Y(l), x0 + w, Y(l), "#eee"); text(ctx, String(l), x0 - 8, Y(l) + 5, { size: 13, align: "right", color: "#777" }); }
      for (let v = 0; v <= 1; v += 0.25) { line(ctx, X(v), y0, X(v), y0 + h, "#eee"); text(ctx, fmt(v, 2), X(v), y0 + h + 18, { size: 13, align: "center", color: "#777" }); }
      line(ctx, x0, y0 + h, x0 + w, y0 + h, "#999"); line(ctx, x0, y0, x0, y0 + h, "#999");
      text(ctx, "p_y  (probability of the true class)", x0 + w / 2, y0 + h + 40, { size: 15, align: "center", color: C.p });
      text(ctx, "−log p_y", x0 + 8, y0 + 14, { size: 15, color: C.loss });
      ctx.save(); ctx.strokeStyle = C.loss; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 1; i <= 300; i++) { const v = i / 300, l = -Math.log(v); i === 1 ? ctx.moveTo(X(v), Y(l)) : ctx.lineTo(X(v), Y(l)); } ctx.stroke(); ctx.restore();
      const L = -Math.log(p); line(ctx, X(p), Y(L), X(p), y0 + h, C.p, 1.5, [5, 4]); line(ctx, x0, Y(L), X(p), Y(L), C.p, 1.5, [5, 4]);
      circle(ctx, X(p), Y(L), 7, C.p, "#fff", 2);
      text(ctx, `p_y = ${fmt(p)}   →   loss = ${fmt(L, 2)}`, X(0.5), y0 + 60, { size: 20, align: "center", color: C.ink, weight: 600 });
      const dl = -1 / p; text(ctx, `slope dL/dp = −1/p = ${fmt(dl, 1)}`, X(0.5), y0 + 90, { size: 15, align: "center", color: "#555" });
    },
  };

  // ========== 12. gradient descent =======================================
  const SURF = {
    bowl: { f: (x, y) => 0.5 * (4 * x * x + y * y), g: (x, y) => [4 * x, y], min: [[0, 0]] },
    valley: { f: (x, y) => (1 - x) ** 2 + 5 * (y - x * x) ** 2, g: (x, y) => [-2 * (1 - x) - 20 * x * (y - x * x), 10 * (y - x * x)], min: [[1, 1]] },
    two: { f: (x, y) => (x * x - 1) ** 2 + 0.6 * y * y + 0.3 * x, g: (x, y) => [4 * x * (x * x - 1) + 0.3, 1.2 * y], min: [[-1.04, 0], [0.96, 0]] },
  };
  W.gd = {
    init() {
      this.ctx = NN.setupCanvas($("gdCanvas"), 600, 440); this.lr = bindVal("gdLr", "gdLrV", (v) => fmt(Math.pow(10, v), 3));
      this.cv = $("gdCanvas"); this.start = [-1.6, 1.5];
      $("gdSurf").addEventListener("change", () => { this.reset(true); });
      $("gdReset").addEventListener("click", () => this.reset()); $("gdStep").addEventListener("click", () => { this.step(); this.draw(); });
      $("gdRun").addEventListener("click", () => { this.running = !this.running; $("gdRun").textContent = this.running ? "pause" : "run"; if (this.running) run(this, () => { for (let k = 0; k < 2; k++) this.step(); this.draw(); }); });
      this.cv.addEventListener("click", (e) => { const [px, py] = NN.localXY(e, this.cv); if (px < 20 || px > 420 || py < 20 || py > 420) return; this.start = [-2 + (px - 20) / 400 * 4, 2 - (py - 20) / 400 * 4]; this.reset(); });
      this.reset(true);
    },
    leave() { stop(this); $("gdRun").textContent = "run"; },
    reset(newSurf) {
      stop(this); $("gdRun").textContent = "run"; this.S = SURF[$("gdSurf").value];
      if (newSurf) { const n = 120, F = new Float32Array(n * n); let mx = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = -2 + 4 * (j + 0.5) / n, y = 2 - 4 * (i + 0.5) / n; F[i * n + j] = this.S.f(x, y); mx = Math.max(mx, F[i * n + j]); } this.field = F; this.fmax = mx; }
      this.path = [this.start.slice()]; this.draw();
    },
    step() {
      const [x, y] = this.path[this.path.length - 1], g = this.S.g(x, y), eta = Math.pow(10, +this.lr.value);
      const nx = x - eta * g[0], ny = y - eta * g[1];
      if (!isFinite(nx) || Math.abs(nx) > 50 || Math.abs(ny) > 50) { this.running = false; $("gdRun").textContent = "run"; this.diverged = true; return; }
      this.path.push([nx, ny]); if (this.path.length > 400) this.running = false;
    },
    draw() {
      const ctx = this.ctx, n = 120, x0 = 20, y0 = 20, size = 400; ctx.clearRect(0, 0, 600, 440);
      const lv = (v) => Math.log1p(v) / Math.log1p(this.fmax);
      heatmap(ctx, this.field, n, x0, y0, size, size, (v) => { const t = lv(v); return [Math.round(255 - 80 * t), Math.round(255 - 120 * t), Math.round(255 - 40 * t)]; });
      // iso-lines
      const levels = [0.08, 0.16, 0.26, 0.38, 0.52, 0.68, 0.85]; ctx.save(); ctx.fillStyle = "rgba(0,53,107,0.35)";
      for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) { const a = lv(this.field[i * n + j]), b = lv(this.field[i * n + j - 1]), c = lv(this.field[(i - 1) * n + j]); for (const L of levels) if ((a - L) * (b - L) < 0 || (a - L) * (c - L) < 0) { ctx.fillRect(x0 + j * size / n, y0 + i * size / n, size / n, size / n); break; } }
      ctx.restore(); rect(ctx, x0, y0, size, size, null, "#ccc");
      const P = (p) => [x0 + (p[0] + 2) / 4 * size, y0 + (2 - p[1]) / 4 * size];
      for (const m of this.S.min) { const q = P(m); text(ctx, "★", q[0], q[1] + 7, { size: 20, align: "center", color: ACCENT }); }
      ctx.save(); ctx.strokeStyle = C.loss; ctx.lineWidth = 2; ctx.beginPath(); this.path.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.restore();
      this.path.forEach((p, i) => { const q = P(p); if (q[0] < x0 - 5 || q[0] > x0 + size + 5 || q[1] < y0 - 5 || q[1] > y0 + size + 5) return; circle(ctx, q[0], q[1], i === this.path.length - 1 ? 7 : 3, i === this.path.length - 1 ? C.loss : "rgba(192,57,43,0.6)"); });
      const last = this.path[this.path.length - 1], g = this.S.g(last[0], last[1]);
      const q = P(last), gl = Math.hypot(g[0], g[1]); if (gl > 1e-6 && Math.abs(last[0]) < 3 && Math.abs(last[1]) < 3) arrow(ctx, q[0], q[1], q[0] + 40 * g[0] / gl, q[1] - 40 * g[1] / gl, C.loss, 2);
      text(ctx, "θ₁", x0 + size + 8, y0 + size / 2 + 5, { size: 16, color: "#555" }); text(ctx, "θ₂", x0 + size / 2, y0 - 6, { size: 16, align: "center", color: "#555" });
      const sx = 440; text(ctx, `step ${this.path.length - 1}`, sx, 50, { size: 16, weight: 600 });
      text(ctx, `L = ${fmt(this.S.f(last[0], last[1]), 3)}`, sx, 80, { size: 16, mono: true }); text(ctx, `‖∇L‖ = ${fmt(gl, 3)}`, sx, 104, { size: 16, mono: true, color: C.loss });
      text(ctx, `η = ${fmt(Math.pow(10, +this.lr.value), 3)}`, sx, 128, { size: 16, mono: true });
      text(ctx, "arrow: the gradient", sx, 170, { size: 14, color: C.loss }); text(ctx, "★ minimum", sx, 192, { size: 14, color: ACCENT });
      if (Math.abs(last[0]) > 2.2 || Math.abs(last[1]) > 2.2) text(ctx, "diverged: η too large", sx, 230, { size: 16, color: C.loss, weight: 600 });
    },
  };

  // ========== 13. backprop on one neuron ===================================
  W.backprop = {
    init() {
      this.ctx = NN.setupCanvas($("bpCanvas"), 640, 400);
      this.x = bindVal("bpX", "bpXv", (v) => fmt(v, 1)); this.w = bindVal("bpW", "bpWv", (v) => fmt(v, 1)); this.b = bindVal("bpB", "bpBv", (v) => fmt(v, 1));
      [this.x, this.w, this.b].forEach((e) => e.addEventListener("input", () => this.draw()));
      this.fwd = 0; this.bwd = 0;
      $("bpFwd").addEventListener("click", () => { this.fwd = Math.min(3, this.fwd + 1); this.draw(); });
      $("bpBwd").addEventListener("click", () => { if (this.fwd < 3) this.fwd = 3; this.bwd = Math.min(4, this.bwd + 1); this.draw(); });
      $("bpReset").addEventListener("click", () => { this.fwd = 0; this.bwd = 0; this.draw(); });
      this.draw();
    },
    draw() {
      const ctx = this.ctx, x = +this.x.value, w = +this.w.value, b = +this.b.value; ctx.clearRect(0, 0, 640, 400);
      const z = w * x + b, a = 1 / (1 + Math.exp(-z)), L = -Math.log(a); // label y = 1
      const dLda = -1 / a, dadz = a * (1 - a), dLdz = dLda * dadz, dLdw = dLdz * x, dLdb = dLdz, dLdx = dLdz * w;
      const nodes = { x: [70, 90, "x", fmt(x, 1), C.x], w: [70, 200, "w", fmt(w, 1), C.w], b: [70, 335, "b", fmt(b, 1), C.w], z: [240, 200, "z", fmt(z, 2), C.ink], a: [390, 200, "a", fmt(a, 3), C.h], L: [540, 200, "L", fmt(L, 3), C.loss] };
      const edges = [["x", "z", "∂z/∂x = w", fmt(w, 1)], ["w", "z", "∂z/∂w = x", fmt(x, 1)], ["b", "z", "∂z/∂b = 1", "1"], ["z", "a", "∂a/∂z = a(1−a)", fmt(dadz, 3)], ["a", "L", "∂L/∂a = −1/a", fmt(dLda, 2)]];
      const fwdShow = { x: true, w: true, b: true, z: this.fwd >= 1, a: this.fwd >= 2, L: this.fwd >= 3 };
      const bwdVal = { L: "1", a: fmt(dLda, 2), z: fmt(dLdz, 3), x: fmt(dLdx, 3), w: fmt(dLdw, 3), b: fmt(dLdb, 3) };
      const bwdShow = { L: this.bwd >= 1, a: this.bwd >= 1, z: this.bwd >= 2, w: this.bwd >= 3, b: this.bwd >= 3, x: this.bwd >= 4 };
      for (const [u, v, lab] of edges) { const A = nodes[u], B = nodes[v]; arrow(ctx, A[0] + 30, A[1], B[0] - 32, B[1], "#999", 1.5); const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; const showLocal = (v === "z" && this.bwd >= 2) || (v === "a" && this.bwd >= 2) || (v === "L" && this.bwd >= 1); if (showLocal) text(ctx, lab, mx, my - 10 + (u === "x" ? -8 : u === "b" ? 18 : 0), { size: 13, align: "center", color: C.loss }); }
      for (const k in nodes) {
        const [nx, ny, name, val, col] = nodes[k];
        circle(ctx, nx, ny, 30, "#fff", col, 2.5); text(ctx, name, nx, ny + 7, { size: 22, align: "center", color: col, weight: 600 });
        if (fwdShow[k]) text(ctx, val, nx, ny + 52, { size: 16, align: "center", mono: true });
        if (bwdShow[k]) text(ctx, "∂L/∂" + name + " = " + bwdVal[k], nx, ny - 42, { size: 15, align: "center", color: C.loss, mono: true });
      }
      text(ctx, "z = w·x + b", 240, 265, { size: 13, align: "center", color: "#555" }); text(ctx, "a = σ(z)", 390, 265, { size: 13, align: "center", color: "#555" }); text(ctx, "L = −log a   (y = 1)", 540, 265, { size: 13, align: "center", color: "#555" });
      text(ctx, "forward values below each node", 270, 380, { size: 14, color: "#555" }); text(ctx, "backward derivatives above, in red", 270, 360, { size: 14, color: C.loss });
      if (this.bwd >= 3) text(ctx, `∂L/∂w = (−1/a)(a(1−a))(x) = ${fmt(dLdw, 3)}`, 300, 330, { size: 15, color: C.loss, mono: true, align: "left" });
    },
  };

  // ========== 14. backprop through the network ============================
  W.backprop2 = {
    init() { this.M = NN.getMNIST(); this.model = loadPretrainedMLP(); this.ctx = NN.setupCanvas($("bp2Canvas"), 720, 470); this.rng = new NN.RNG(17); this.idx = 7; $("bp2Random").addEventListener("click", () => { this.idx = Math.floor(this.rng.next() * this.M.nTest); this.draw(); }); this.draw(); },
    draw() {
      const ctx = this.ctx, m = this.model, x = this.M.image("test", this.idx), y = this.M.label("test", this.idx); ctx.clearRect(0, 0, 720, 470);
      const out = m.forward1(x), d2 = Float32Array.from(out.p); d2[y] -= 1;
      const d1 = new Float32Array(64); for (let j = 0; j < 64; j++) { let s = 0; for (let k = 0; k < 10; k++) s += m.W2[j * 10 + k] * d2[k]; d1[j] = s * (out.z1[j] > 0 ? 1 : 0); }
      // forward row
      const yF = 40, yB = 262;
      text(ctx, "forward", 10, 25, { size: 15, weight: 600, color: "#555" }); text(ctx, "backward", 10, yB - 15, { size: 15, weight: 600, color: C.loss });
      rect(ctx, 10, yF, 84, 84, "#fff", C.x, 2); NN.drawDigit(ctx, x, 10, yF, 3); text(ctx, `x   (y = ${y})`, 52, yF + 104, { size: 14, align: "center", color: C.x, weight: 600 });
      arrow(ctx, 110, yF + 42, 190, yF + 42, C.w, 2); text(ctx, "W₁, ReLU", 150, yF + 32, { size: 13, align: "center", color: C.w });
      const hx = 200, cs = 20; let hmax = 1e-6; for (let j = 0; j < 64; j++) hmax = Math.max(hmax, out.h[j]);
      for (let j = 0; j < 64; j++) rect(ctx, hx + (j % 8) * cs, yF + Math.floor(j / 8) * cs, cs - 1, cs - 1, `rgba(42,157,92,${0.08 + 0.92 * out.h[j] / hmax})`);
      text(ctx, "h", hx + 80, yF + 184, { size: 14, align: "center", color: C.h, weight: 600 });
      arrow(ctx, hx + 170, yF + 42, hx + 250, yF + 42, C.w, 2); text(ctx, "W₂, softmax", hx + 210, yF + 32, { size: 13, align: "center", color: C.w });
      const px = 460; bars(ctx, Array.from(out.p), px, yF, 250, 120, { min: 0, max: 1, color: (k) => (k === y ? C.p : "#cdb6e0"), labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      text(ctx, "p", px + 125, yF + 184, { size: 14, align: "center", color: C.p, weight: 600 });
      // backward row
      let d1max = 1e-6; for (let j = 0; j < 64; j++) d1max = Math.max(d1max, Math.abs(d1[j]));
      bars(ctx, Array.from(d2), px, yB, 250, 120, { min: -1, max: 1, color: (k) => (k === y ? C.loss : "#e8a39b"), labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      text(ctx, "δ₂ = p − e_y", px + 125, yB + 184, { size: 14, align: "center", color: C.loss, weight: 600 });
      arrow(ctx, px - 10, yB + 42, hx + 170, yB + 42, C.loss, 2); text(ctx, "W₂ᵀ δ₂, ⊙ φ′", hx + 210, yB + 32, { size: 13, align: "center", color: C.loss });
      for (let j = 0; j < 64; j++) rect(ctx, hx + (j % 8) * cs, yB + Math.floor(j / 8) * cs, cs - 1, cs - 1, out.z1[j] > 0 ? NN.divergeColor(d1[j], d1max) : "#eee");
      text(ctx, "δ₁   (grey: ReLU off)", hx + 80, yB + 184, { size: 14, align: "center", color: C.loss, weight: 600 });
      arrow(ctx, hx - 10, yB + 42, 110, yB + 42, C.loss, 2); text(ctx, "∇W₁ = δ₁ xᵀ", 150, yB + 32, { size: 13, align: "center", color: C.loss });
      // gradient wrt W1 for one hidden unit, as an image: most active unit
      let jb = 0; for (let j = 1; j < 64; j++) if (Math.abs(d1[j]) > Math.abs(d1[jb])) jb = j;
      const gimg = new Float32Array(784); for (let i = 0; i < 784; i++) gimg[i] = d1[jb] * x[i]; let gmax = 1e-6; for (let i = 0; i < 784; i++) gmax = Math.max(gmax, Math.abs(gimg[i]));
      for (let r = 0; r < 28; r++) for (let c = 0; c < 28; c++) { const v = gimg[r * 28 + c]; if (v !== 0) rect(ctx, 10 + c * 3, yB + r * 3, 3, 3, NN.divergeColor(v, gmax)); } rect(ctx, 10, yB, 84, 84, null, C.loss, 2);
      text(ctx, `∇ for unit ${jb + 1}`, 52, yB + 104, { size: 13, align: "center", color: C.loss });
      text(ctx, "one row of ∇W₁ is δ₁ⱼ times the image", 10, 462, { size: 13, color: "#555" });
    },
  };

  // ========== 15. SGD on a 2-parameter logistic regression ================
  W.sgd = {
    init() {
      this.ctx = NN.setupCanvas($("sgdCanvas"), 640, 450); this.lr = bindVal("sgdLr", "sgdLrV", (v) => fmt(Math.pow(10, v), 3));
      const r = new NN.RNG(23); this.n = 200; this.X = new Float32Array(this.n); this.Y = new Int8Array(this.n);
      for (let i = 0; i < this.n; i++) { const c = i % 2 ? 1 : -1; this.X[i] = c * 0.9 + r.normal() * 0.9; this.Y[i] = c; }
      // full loss field over (w,b) in [-1,5]x[-3,3]
      const n = 90; this.g = n; this.F = new Float32Array(n * n); let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const w = -1 + 6 * (j + 0.5) / n, b = 3 - 6 * (i + 0.5) / n; const v = this.full(w, b); this.F[i * n + j] = v; mn = Math.min(mn, v); mx = Math.max(mx, v); }
      this.fmin = mn; this.fmax = mx;
      $("sgdBatch").addEventListener("change", () => this.reset()); $("sgdReset").addEventListener("click", () => this.reset());
      $("sgdRun").addEventListener("click", () => { this.running = !this.running; $("sgdRun").textContent = this.running ? "pause" : "run"; if (this.running) run(this, () => this.step()); });
      this.reset();
    },
    leave() { stop(this); $("sgdRun").textContent = "run"; },
    full(w, b) { let s = 0; for (let i = 0; i < this.n; i++) s += Math.log1p(Math.exp(-this.Y[i] * (w * this.X[i] + b))); return s / this.n; },
    reset() { stop(this); $("sgdRun").textContent = "run"; this.path = [[-0.6, 2.5]]; this.rng = new NN.RNG(29); this.perm = []; this.seen = 0; this.hist = []; this.draw(); },
    step() {
      const B = +$("sgdBatch").value, eta = Math.pow(10, +this.lr.value);
      for (let k = 0; k < (B === 1 ? 6 : 2); k++) {
        if (this.perm.length < B) { this.perm = this.rng.shuffle(Array.from({ length: this.n }, (_, i) => i)); }
        const idx = this.perm.splice(0, B); let gw = 0, gb = 0;
        const [w, b] = this.path[this.path.length - 1];
        for (const i of idx) { const s = -this.Y[i] / (1 + Math.exp(this.Y[i] * (w * this.X[i] + b))); gw += s * this.X[i]; gb += s; }
        gw /= B; gb /= B; this.seen += B;
        const nw = w - eta * gw, nb = b - eta * gb; if (!isFinite(nw) || Math.abs(nw) > 100) { this.running = false; return; }
        this.path.push([nw, nb]); this.hist.push(this.full(nw, nb));
        if (this.path.length > 3000) { this.running = false; $("sgdRun").textContent = "run"; }
      }
      this.draw();
    },
    draw() {
      const ctx = this.ctx, n = this.g, x0 = 20, y0 = 20, size = 400; ctx.clearRect(0, 0, 640, 450);
      const lv = (v) => Math.log1p(v - this.fmin) / Math.log1p(this.fmax - this.fmin);
      heatmap(ctx, this.F, n, x0, y0, size, size, (v) => { const t = lv(v); return [Math.round(255 - 80 * t), Math.round(255 - 120 * t), Math.round(255 - 40 * t)]; });
      const levels = [0.05, 0.12, 0.2, 0.3, 0.42, 0.56, 0.72, 0.88]; ctx.save(); ctx.fillStyle = "rgba(0,53,107,0.35)";
      for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) { const a = lv(this.F[i * n + j]), b = lv(this.F[i * n + j - 1]), c = lv(this.F[(i - 1) * n + j]); for (const L of levels) if ((a - L) * (b - L) < 0 || (a - L) * (c - L) < 0) { ctx.fillRect(x0 + j * size / n, y0 + i * size / n, size / n + 0.5, size / n + 0.5); break; } }
      ctx.restore(); rect(ctx, x0, y0, size, size, null, "#ccc");
      const P = (p) => [x0 + (p[0] + 1) / 6 * size, y0 + (3 - p[1]) / 6 * size];
      ctx.save(); ctx.strokeStyle = C.loss; ctx.lineWidth = 1.5; ctx.beginPath(); this.path.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.restore();
      const last = P(this.path[this.path.length - 1]); circle(ctx, last[0], last[1], 7, C.loss, "#fff", 2);
      text(ctx, "w", x0 + size + 8, y0 + size / 2 + 5, { size: 16, color: "#555" }); text(ctx, "b", x0 + size / 2, y0 - 6, { size: 16, align: "center", color: "#555" });
      text(ctx, "contours: the loss averaged over all 200 points", x0, y0 + size + 22, { size: 14, color: "#555" });
      // loss history
      const lx = 440, ly = 40, lw = 190, lh = 120; rect(ctx, lx, ly, lw, lh, "#fafafa", "#ddd"); text(ctx, "full loss along the path", lx + 4, ly - 6, { size: 13, color: C.loss });
      if (this.hist.length > 1) { const Hh = this.hist, mx = Math.max(...Hh.slice(0, 5)); ctx.save(); ctx.strokeStyle = C.loss; ctx.lineWidth = 1.5; ctx.beginPath(); Hh.forEach((v, i) => { const px = lx + 4 + (lw - 8) * i / (Hh.length - 1), py = ly + lh - 4 - Math.min(1, (v - this.fmin) / (mx - this.fmin)) * (lh - 12); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); ctx.restore(); }
      const B = +$("sgdBatch").value, epochs = this.seen / this.n;
      $("sgdStat").innerHTML = `${this.path.length - 1} steps &nbsp; ${fmt(epochs, 1)} epochs &nbsp; loss <b>${fmt(this.path.length > 1 ? this.hist[this.hist.length - 1] : this.full(-0.6, 2.5), 3)}</b>`;
      text(ctx, `batch ${B}: ${Math.ceil(this.n / B)} steps per epoch`, lx, 300, { size: 15 });
      text(ctx, `${this.n} gradients per epoch`, lx, 324, { size: 15, color: "#555" });
      text(ctx, "every batch size pays the same", lx, 352, { size: 14, color: "#555" }); text(ctx, "gradients per epoch; small batches", lx, 372, { size: 14, color: "#555" }); text(ctx, "spend them on more steps.", lx, 392, { size: 14, color: "#555" });
    },
  };
})();
