/* nn.js -- a small neural-network library for the deck.
 * Plain JavaScript, Float32Array, no dependencies. Used by every widget.
 */
(function () {
  "use strict";

  // ---------- data -------------------------------------------------------
  function b64ToUint8(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function b64ToFloat32(s) {
    const u8 = b64ToUint8(s);
    return new Float32Array(u8.buffer, u8.byteOffset, u8.byteLength / 4);
  }

  let mnist = null;
  function getMNIST() {
    if (mnist) return mnist;
    const R = window.MNIST_RAW;
    const d = R.side * R.side;
    const toF = (u8) => {
      const f = new Float32Array(u8.length);
      for (let i = 0; i < u8.length; i++) f[i] = u8[i] / 255;
      return f;
    };
    const trainU8 = b64ToUint8(R.trainX), testU8 = b64ToUint8(R.testX);
    // The embedded 5,000 "training" images are split: the first 4,000 train, the last 1,000 are a validation set.
    const allX = toF(trainU8), allY = b64ToUint8(R.trainY), nVal = 1000, nTr = R.nTrain - nVal;
    mnist = {
      d, side: R.side, nTrain: nTr, nVal, nTest: R.nTest,
      trainX: allX.subarray(0, nTr * d), trainY: allY.subarray(0, nTr),
      valX: allX.subarray(nTr * d), valY: allY.subarray(nTr),
      testX: toF(testU8), testY: b64ToUint8(R.testY),
      image(set, i) { const X = set === "train" ? this.trainX : set === "val" ? this.valX : this.testX; return X.subarray(i * d, (i + 1) * d); },
      label(set, i) { return (set === "train" ? this.trainY : set === "val" ? this.valY : this.testY)[i]; },
    };
    return mnist;
  }

  let pre = null;
  function getPretrained() {
    if (pre) return pre;
    const P = window.PRETRAINED;
    pre = {
      meta: P.meta,
      logreg: { W: b64ToFloat32(P.logreg.W), b: b64ToFloat32(P.logreg.b) },
      mlp: { W1: b64ToFloat32(P.mlp.W1), b1: b64ToFloat32(P.mlp.b1), W2: b64ToFloat32(P.mlp.W2), b2: b64ToFloat32(P.mlp.b2), hidden: P.mlp.hidden },
    };
    return pre;
  }

  // ---------- random -----------------------------------------------------
  // Deterministic PRNG so students see the same thing when they press Reset.
  function RNG(seed) {
    let s = seed >>> 0 || 1;
    this.next = function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let k = 0; k < 20; k++) this.next(); // warm up: a small seed gives near-zero first draws otherwise
    this.normal = function () { let u = 0, v = 0; while (u === 0) u = this.next(); v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    this.shuffle = function (arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  }

  // ---------- activations ------------------------------------------------
  const ACT = {
    relu: { f: (z) => (z > 0 ? z : 0), df: (z) => (z > 0 ? 1 : 0), tex: "\\max(0,z)", name: "ReLU" },
    tanh: { f: Math.tanh, df: (z) => { const t = Math.tanh(z); return 1 - t * t; }, tex: "\\tanh(z)", name: "tanh" },
    sigmoid: { f: (z) => 1 / (1 + Math.exp(-z)), df: (z) => { const s = 1 / (1 + Math.exp(-z)); return s * (1 - s); }, tex: "\\sigma(z)=\\frac{1}{1+e^{-z}}", name: "sigmoid" },
    linear: { f: (z) => z, df: () => 1, tex: "z", name: "linear" },
  };

  function softmaxInPlace(z, off, k) {
    let m = -Infinity;
    for (let j = 0; j < k; j++) if (z[off + j] > m) m = z[off + j];
    let s = 0;
    for (let j = 0; j < k; j++) { const e = Math.exp(z[off + j] - m); z[off + j] = e; s += e; }
    for (let j = 0; j < k; j++) z[off + j] /= s;
  }

  // ---------- MLP --------------------------------------------------------
  // inDim -> hidden (0 = none, i.e. multinomial logistic regression) -> outDim softmax.
  function MLP(opts) {
    this.inDim = opts.inDim; this.hidden = opts.hidden | 0; this.outDim = opts.outDim;
    this.act = ACT[opts.act || "relu"]; this.actName = opts.act || "relu";
    this.rng = new RNG(opts.seed || 1);
    this.init();
  }
  MLP.prototype.init = function () {
    const r = this.rng, I = this.inDim, H = this.hidden, O = this.outDim;
    if (H > 0) {
      const s1 = Math.sqrt(2 / I), s2 = Math.sqrt(2 / H);
      this.W1 = new Float32Array(I * H); for (let i = 0; i < I * H; i++) this.W1[i] = r.normal() * s1;
      this.b1 = new Float32Array(H);
      this.W2 = new Float32Array(H * O); for (let i = 0; i < H * O; i++) this.W2[i] = r.normal() * s2;
      this.b2 = new Float32Array(O);
    } else {
      this.W2 = new Float32Array(I * O); for (let i = 0; i < I * O; i++) this.W2[i] = r.normal() * 0.01;
      this.b2 = new Float32Array(O);
      this.W1 = null; this.b1 = null;
    }
    this.vel = null;
    this.steps = 0;
  };
  MLP.prototype.nParams = function () {
    return (this.W1 ? this.W1.length + this.b1.length : 0) + this.W2.length + this.b2.length;
  };
  MLP.prototype.setWeights = function (w) { // from pretrained
    this.W1 = w.W1 ? Float32Array.from(w.W1) : null; this.b1 = w.b1 ? Float32Array.from(w.b1) : null;
    this.W2 = Float32Array.from(w.W2 || w.W); this.b2 = Float32Array.from(w.b2 || w.b);
    this.hidden = this.W1 ? this.b1.length : 0;
  };
  // Forward for one example x (Float32Array view). Returns {z1, h, z2, p}.
  MLP.prototype.forward1 = function (x) {
    const I = this.inDim, H = this.hidden, O = this.outDim, f = this.act.f;
    let z1 = null, h = x;
    if (H > 0) {
      z1 = new Float32Array(H); h = new Float32Array(H);
      const W1 = this.W1;
      for (let j = 0; j < H; j++) {
        let s = this.b1[j];
        for (let i = 0; i < I; i++) s += x[i] * W1[i * H + j];
        z1[j] = s; h[j] = f(s);
      }
    }
    const D = H > 0 ? H : I, W2 = this.W2;
    const z2 = new Float32Array(O);
    for (let k = 0; k < O; k++) {
      let s = this.b2[k];
      for (let j = 0; j < D; j++) s += h[j] * W2[j * O + k];
      z2[k] = s;
    }
    const p = Float32Array.from(z2); softmaxInPlace(p, 0, O);
    return { z1, h, z2, p };
  };
  MLP.prototype.predict = function (x) { const p = this.forward1(x).p; let k = 0; for (let j = 1; j < p.length; j++) if (p[j] > p[k]) k = j; return k; };

  // One mini-batch SGD step. X: Float32Array of n*inDim, Y: Uint8Array labels, idx: indices.
  // Returns mean cross-entropy over the batch (before the update).
  MLP.prototype.trainBatch = function (X, Y, idx, lr, l2, momentum) {
    const I = this.inDim, H = this.hidden, O = this.outDim, n = idx.length;
    const f = this.act.f, df = this.act.df;
    const D = H > 0 ? H : I;
    const gW2 = new Float32Array(this.W2.length), gb2 = new Float32Array(O);
    const gW1 = H > 0 ? new Float32Array(this.W1.length) : null, gb1 = H > 0 ? new Float32Array(H) : null;
    const z1 = H > 0 ? new Float32Array(H) : null, h = H > 0 ? new Float32Array(H) : null;
    const p = new Float32Array(O), d1 = H > 0 ? new Float32Array(H) : null;
    let loss = 0;
    for (let b = 0; b < n; b++) {
      const off = idx[b] * I, y = Y[idx[b]];
      let hv;
      if (H > 0) {
        const W1 = this.W1;
        for (let j = 0; j < H; j++) {
          let s = this.b1[j];
          for (let i = 0; i < I; i++) { const xi = X[off + i]; if (xi !== 0) s += xi * W1[i * H + j]; }
          z1[j] = s; h[j] = f(s);
        }
        hv = h;
      } else hv = X.subarray(off, off + I);
      const W2 = this.W2;
      for (let k = 0; k < O; k++) { let s = this.b2[k]; for (let j = 0; j < D; j++) s += hv[j] * W2[j * O + k]; p[k] = s; }
      softmaxInPlace(p, 0, O);
      loss -= Math.log(Math.max(p[y], 1e-12));
      p[y] -= 1; // d2 = p - onehot(y)
      for (let k = 0; k < O; k++) { const dk = p[k] / n; gb2[k] += dk; for (let j = 0; j < D; j++) gW2[j * O + k] += hv[j] * dk; }
      if (H > 0) {
        for (let j = 0; j < H; j++) { let s = 0; for (let k = 0; k < O; k++) s += W2[j * O + k] * p[k]; d1[j] = s * df(z1[j]) / n; }
        for (let j = 0; j < H; j++) gb1[j] += d1[j];
        for (let i = 0; i < I; i++) { const xi = X[off + i]; if (xi === 0) continue; const row = i * H; for (let j = 0; j < H; j++) gW1[row + j] += xi * d1[j]; }
      }
    }
    this.applyGrad(gW1, gb1, gW2, gb2, lr, l2, momentum || 0);
    this.steps++;
    return loss / n;
  };
  MLP.prototype.applyGrad = function (gW1, gb1, gW2, gb2, lr, l2, mom) {
    const upd = (P, G, key) => {
      if (mom > 0) {
        if (!this.vel) this.vel = {};
        if (!this.vel[key]) this.vel[key] = new Float32Array(P.length);
        const V = this.vel[key];
        for (let i = 0; i < P.length; i++) { V[i] = mom * V[i] - lr * (G[i] + l2 * P[i]); P[i] += V[i]; }
      } else for (let i = 0; i < P.length; i++) P[i] -= lr * (G[i] + l2 * P[i]);
    };
    // weight decay applies to the weight matrices only; biases are not penalized
    const l2w = l2; l2 = 0;
    if (gW1) { l2 = l2w; upd(this.W1, gW1, "W1"); l2 = 0; upd(this.b1, gb1, "b1"); }
    l2 = l2w; upd(this.W2, gW2, "W2"); l2 = 0; upd(this.b2, gb2, "b2");
  };
  // Evaluate loss and accuracy on X (n*inDim), Y. Optional confusion matrix and wrong list.
  MLP.prototype.evaluate = function (X, Y, n, wantDetails) {
    const I = this.inDim, O = this.outDim;
    let loss = 0, correct = 0;
    const conf = wantDetails ? new Uint32Array(O * O) : null, wrong = wantDetails ? [] : null;
    for (let i = 0; i < n; i++) {
      const out = this.forward1(X.subarray(i * I, (i + 1) * I));
      const p = out.p, y = Y[i];
      let k = 0; for (let j = 1; j < O; j++) if (p[j] > p[k]) k = j;
      loss -= Math.log(Math.max(p[y], 1e-12));
      if (k === y) correct++; else if (wrong) wrong.push({ i, pred: k, y, conf: p[k] });
      if (conf) conf[y * O + k]++;
    }
    return { loss: loss / n, acc: correct / n, conf, wrong };
  };

  // ---------- 2-D toy datasets -------------------------------------------
  function makeDataset(kind, n, seed, noise) {
    const r = new RNG(seed), X = new Float32Array(n * 2), Y = new Uint8Array(n);
    noise = noise == null ? 0.1 : noise;
    for (let i = 0; i < n; i++) {
      let x, y, c;
      if (kind === "xor") {
        x = r.next() * 2 - 1; y = r.next() * 2 - 1; c = (x > 0) === (y > 0) ? 1 : 0;
        x += r.normal() * noise * 0.5; y += r.normal() * noise * 0.5;
      } else if (kind === "rings") {
        c = i % 2; const rad = c === 0 ? r.next() * 0.45 : 0.65 + r.next() * 0.3; const t = r.next() * 2 * Math.PI;
        x = rad * Math.cos(t) + r.normal() * noise * 0.5; y = rad * Math.sin(t) + r.normal() * noise * 0.5;
      } else if (kind === "spiral") {
        c = i % 2; const t = r.next() * 2.5 * Math.PI + 0.5, rad = t / (3 * Math.PI) * 0.95;
        const ph = c === 0 ? 0 : Math.PI;
        x = rad * Math.cos(t + ph) + r.normal() * noise * 0.4; y = rad * Math.sin(t + ph) + r.normal() * noise * 0.4;
      } else { // two blobs
        c = i % 2; const cx = c === 0 ? -0.45 : 0.45, cy = c === 0 ? -0.3 : 0.3;
        x = cx + r.normal() * 0.25; y = cy + r.normal() * 0.25;
      }
      X[2 * i] = Math.max(-1, Math.min(1, x)); X[2 * i + 1] = Math.max(-1, Math.min(1, y)); Y[i] = c;
    }
    return { X, Y, n };
  }

  // ---------- colours shared by diagrams and equations --------------------
  const COLORS = {
    x: "#1f6fb2", w: "#d9671e", h: "#2a9d5c", p: "#7a3fb0", loss: "#c0392b", grad: "#c0392b",
    class0: "#d9671e", class1: "#1f6fb2", ink: "#1a1a1a", grid: "#e6e6e6",
    digit: ["#1f6fb2", "#d9671e", "#2a9d5c", "#7a3fb0", "#c0392b", "#17a2b8", "#8d6e63", "#e91e63", "#607d8b", "#f1c40f"],
  };
  // Diverging colour for weights: negative blue, positive red.
  function divergeColor(v, vmax) {
    const t = Math.max(-1, Math.min(1, v / vmax));
    if (t >= 0) { const a = t; return `rgb(${Math.round(255)},${Math.round(255 - 170 * a)},${Math.round(255 - 215 * a)})`; }
    const a = -t; return `rgb(${Math.round(255 - 215 * a)},${Math.round(255 - 150 * a)},${Math.round(255 - 60 * a)})`;
  }
  function grayColor(v) { const g = Math.round(255 * (1 - v)); return `rgb(${g},${g},${g})`; }

  // ---------- drawing helpers ---------------------------------------------
  // Mouse position in a canvas's own coordinate system, correct under the stage's CSS scale.
  function localXY(e, cv) {
    const r = cv.getBoundingClientRect(); const w = parseFloat(cv.style.width), h = parseFloat(cv.style.height);
    return [(e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height];
  }
  function setupCanvas(cv, w, h) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const col = cv.parentElement; if (col && col.classList.contains("vis") && !col.style.flex) col.style.width = w + "px";
    return ctx;
  }
  // Draw a 28x28 image (Float32Array of 784) into ctx at (x0,y0) with cell size s.
  function drawDigit(ctx, img, x0, y0, s, side) {
    side = side || 28;
    for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) {
      const v = img[r * side + c]; if (v <= 0.002) continue;
      ctx.fillStyle = grayColor(v); ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    }
  }
  function drawWeightImage(ctx, W, col, nCols, x0, y0, s, side, vmax) {
    side = side || 28;
    if (!vmax) { vmax = 0; for (let i = 0; i < side * side; i++) vmax = Math.max(vmax, Math.abs(W[i * nCols + col])); vmax = vmax || 1; }
    for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) {
      ctx.fillStyle = divergeColor(W[(r * side + c) * nCols + col], vmax); ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    }
  }

  window.NN = { localXY, b64ToUint8, b64ToFloat32, getMNIST, getPretrained, RNG, ACT, MLP, softmaxInPlace, makeDataset, COLORS, divergeColor, grayColor, setupCanvas, drawDigit, drawWeightImage };
})();
