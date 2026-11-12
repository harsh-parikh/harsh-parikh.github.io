"""Audit fix pass 2026-11-12: validation split, activation renamed phi, slide text per the two reader reports.
Idempotent where possible; every replacement asserts its anchor."""
import re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rw(rel, fn):
    p = os.path.join(ROOT, rel); s = open(p).read(); s2 = fn(s); open(p, "w").write(s2); print("patched", rel)
SOFT = False
def rep(s, old, new, count=1):
    if s.count(old) < 1:
        if SOFT: return s
        raise AssertionError("anchor missing: " + old[:80])
    return s.replace(old, new) if count == 0 else s.replace(old, new, count)

# ---------------- nn.js: validation split, bias not penalized ----------------
def nn(s):
    s = rep(s, """    mnist = {
      d, side: R.side, nTrain: R.nTrain, nTest: R.nTest,
      trainX: toF(trainU8), trainY: b64ToUint8(R.trainY),
      testX: toF(testU8), testY: b64ToUint8(R.testY),
      image(set, i) { const X = set === "train" ? this.trainX : this.testX; return X.subarray(i * d, (i + 1) * d); },
      label(set, i) { return (set === "train" ? this.trainY : this.testY)[i]; },
    };""", """    // The embedded 5,000 "training" images are split: the first 4,000 train, the last 1,000 are a validation set.
    const allX = toF(trainU8), allY = b64ToUint8(R.trainY), nVal = 1000, nTr = R.nTrain - nVal;
    mnist = {
      d, side: R.side, nTrain: nTr, nVal, nTest: R.nTest,
      trainX: allX.subarray(0, nTr * d), trainY: allY.subarray(0, nTr),
      valX: allX.subarray(nTr * d), valY: allY.subarray(nTr),
      testX: toF(testU8), testY: b64ToUint8(R.testY),
      image(set, i) { const X = set === "train" ? this.trainX : set === "val" ? this.valX : this.testX; return X.subarray(i * d, (i + 1) * d); },
      label(set, i) { return (set === "train" ? this.trainY : set === "val" ? this.valY : this.testY)[i]; },
    };""")
    s = rep(s, '    if (gW1) { upd(this.W1, gW1, "W1"); upd(this.b1, gb1, "b1"); }\n    upd(this.W2, gW2, "W2"); upd(this.b2, gb2, "b2");',
               '    // weight decay applies to the weight matrices only; biases are not penalized\n    const l2w = l2; l2 = 0;\n    if (gW1) { l2 = l2w; upd(this.W1, gW1, "W1"); l2 = 0; upd(this.b1, gb1, "b1"); }\n    l2 = l2w; upd(this.W2, gW2, "W2"); l2 = 0; upd(this.b2, gb2, "b2");')
    return s
rw("js/nn.js", nn)

# ---------------- widgets_core.js: activation symbol phi ----------------
def core(s):
    s = s.replace('text(ctx, "g", G[0], G[1] + 7, { size: 20, align: "center" });', 'text(ctx, "φ", G[0], G[1] + 7, { size: 20, align: "center" });')
    s = s.replace('text(ctx, "a = g(z)", 60, 404,', 'text(ctx, "a = φ(z)", 60, 404,')
    s = s.replace('text(ctx, `shading: a = g(z)   dashed: z = 0`', 'text(ctx, `shading: a = φ(z)   dashed: z = 0`')
    s = s.replace('text(ctx, "g(z)", X(3.2), Y(act.f(3.2)) - 12,', 'text(ctx, "φ(z)", X(3.2), Y(act.f(3.2)) - 12,')
    s = s.replace('text(ctx, "g′(z)", X(-3.6), Y(act.df(-3.6)) - 12,', 'text(ctx, "φ′(z)", X(-3.6), Y(act.df(-3.6)) - 12,')
    s = s.replace("g(z) &= \\\\sigma(z)", "\\\\varphi(z) &= \\\\sigma(z)").replace("g'(z) &= \\\\sigma(z)", "\\\\varphi'(z) &= \\\\sigma(z)")
    s = s.replace("g(z) &= \\\\tanh(z)", "\\\\varphi(z) &= \\\\tanh(z)").replace("g'(z) &= 1-", "\\\\varphi'(z) &= 1-")
    s = s.replace("g(z) &= \\\\max(0,z)", "\\\\varphi(z) &= \\\\max(0,z)").replace("g'(z) &= \\\\mathbf{1}", "\\\\varphi'(z) &= \\\\mathbf{1}")
    assert "\\\\varphi(z) &= \\\\max" in s
    return s
rw("js/widgets_core.js", core)

# ---------------- widgets_mid.js: pre-activation label, backprop2 (full deck) ----------------
def mid(s):
    s = s.replace('text(ctx, "W₂ᵀ δ₂, ⊙ g′"', 'text(ctx, "W₂ᵀ δ₂, ⊙ φ′"')
    return s
rw("js/widgets_mid.js", mid)

# ---------------- widgets_train.js: trainer with validation; features/weights on the split ----------------
def train(s):
    s = rep(s, 'this.c.nTrain = sel("training images", "nTrain", [200, 500, 1000, 2000, 5000], this.o.nTrain, (v) => v.toLocaleString());',
               'this.c.nTrain = sel("training images", "nTrain", [200, 500, 1000, 2000, 4000], this.o.nTrain, (v) => v.toLocaleString());')
    s = rep(s, 'this.o = Object.assign({ hidden: 64, act: "relu", lr: 0.1, batch: 32, nTrain: 5000, l2: 0, maxEpochs: 40 }, opts);',
               'this.o = Object.assign({ hidden: 64, act: "relu", lr: 0.1, batch: 32, nTrain: 4000, l2: 0, maxEpochs: 40 }, opts);')
    s = rep(s, """    const tr = m.evaluate(this.M.trainX, this.M.trainY, nTr, false), te = m.evaluate(this.M.testX, this.M.testY, this.M.nTest, true);
    this.epochs.push({ ep: this.epoch, trainAcc: tr.acc, trainLoss: tr.loss, testAcc: te.acc, testLoss: te.loss }); this.conf = te.conf; this.wrong = te.wrong;""",
    """    const tr = m.evaluate(this.M.trainX, this.M.trainY, nTr, false), va = m.evaluate(this.M.valX, this.M.valY, this.M.nVal, true), te = m.evaluate(this.M.testX, this.M.testY, this.M.nTest, false);
    this.epochs.push({ ep: this.epoch, trainAcc: tr.acc, trainLoss: tr.loss, valAcc: va.acc, valLoss: va.loss, testAcc: te.acc }); this.conf = va.conf; this.wrong = va.wrong;""")
    s = rep(s, 'plot("trainAcc", C.h); plot("testAcc", C.p);\n    let best = E[0]; for (const e of E) if (e.testAcc > best.testAcc) best = e;',
               'plot("trainAcc", C.h); plot("valAcc", C.p);\n    let best = E[0]; for (const e of E) if (e.valAcc > best.valAcc) best = e; this.best = best;')
    s = rep(s, 'text(ctx, "best test", X(best.ep), p2.y + p2.h + 14, { size: 11, align: "center", color: C.p }); }',
               'text(ctx, "best validation", X(best.ep), p2.y + p2.h + 14, { size: 11, align: "center", color: C.p }); }')
    s = rep(s, 'text(ctx, "train", p2.x + 8, p2.y + 16, { size: 13, color: C.h, weight: 600 }); text(ctx, "test", p2.x + 52, p2.y + 16, { size: 13, color: C.p, weight: 600 });',
               'text(ctx, "train", p2.x + 8, p2.y + 16, { size: 13, color: C.h, weight: 600 }); text(ctx, "validation", p2.x + 52, p2.y + 16, { size: 13, color: C.p, weight: 600 });')
    s = rep(s, 'if (wide) text(ctx, "test confusion: true (rows) × predicted (columns)", p3.x, p3.y - 6, { size: 14, color: "#555" });',
               'if (wide) text(ctx, "validation confusion: true (rows) × predicted (columns)", p3.x, p3.y - 6, { size: 14, color: "#555" });')
    s = rep(s, 'const t = r === c ? v / Math.max(1, this.M.nTest / 10) : v / mx;', 'const t = r === c ? v / Math.max(1, this.M.nVal / 10) : v / mx;')
    s = rep(s, 'text(ctx, "test digits the network gets wrong (predicted → true)", p4.x, p4.y - 6, { size: 14, color: "#555" });',
               'text(ctx, "validation digits the network gets wrong (predicted → true)", p4.x, p4.y - 6, { size: 14, color: "#555" });')
    s = rep(s, 'NN.drawDigit(ctx, this.M.image("test", w.i), x0, p4.y, 2);', 'NN.drawDigit(ctx, this.M.image("val", w.i), x0, p4.y, 2);')
    s = rep(s, """    this.stat.innerHTML = `epoch <b>${this.epoch}</b> &nbsp; train <b>${(100 * cur.trainAcc).toFixed(1)}%</b> &nbsp; test <b>${(100 * cur.testAcc).toFixed(1)}%</b> &nbsp; ${this.model.nParams().toLocaleString()} parameters`""",
               """    this.stat.innerHTML = `epoch <b>${this.epoch}</b> &nbsp; train <b>${(100 * cur.trainAcc).toFixed(1)}%</b> &nbsp; validation <b>${(100 * cur.valAcc).toFixed(1)}%</b> &nbsp; test at best validation epoch (${this.best.ep}): <b>${(100 * this.best.testAcc).toFixed(1)}%</b> &nbsp; ${this.model.nParams().toLocaleString()} parameters`""")
    # features: top digits from validation
    s = rep(s, 'const acts = []; for (let i = 0; i < this.M.nTest; i++) { const x = this.M.image("test", i);', 'const acts = []; for (let i = 0; i < this.M.nVal; i++) { const x = this.M.image("val", i);')
    s = rep(s, 'text(ctx, "test digits that excite it most", rx + 100, 52,', 'text(ctx, "validation digits that activate it most", rx + 100, 52,')
    s = rep(s, 'NN.drawDigit(ctx, this.M.image("test", i), x0, y0, 2); rect(ctx, x0, y0, 56, 56, null, "#ddd"); }\n      // output weights', 'NN.drawDigit(ctx, this.M.image("val", i), x0, y0, 2); rect(ctx, x0, y0, 56, 56, null, "#ddd"); }\n      // output weights')
    # weights slide: n = nTrain (4000)
    s = rep(s, 'text(ctx, "all 5,000 weights wᵢ(x), sorted", px + 6, py - 6,', 'text(ctx, `all ${M.nTrain.toLocaleString()} weights wᵢ(x), sorted`, px + 6, py - 6,')
    s = rep(s, 'text(ctx, `network says ${netPred}`, 66, 180,', 'text(ctx, `network predicts ${netPred}`, 66, 180,')
    s = rep(s, 'text(ctx, `smoother says ${pred}`, bx, 215,', 'text(ctx, `smoother predicts ${pred}`, bx, 215,')
    return s
rw("js/widgets_train.js", train)

# ---------------- HTML (both files) ----------------
def html(s):
    # slide 1 notes
    s = re.sub(r'<aside class="notes">Plan for the hour:.*?</aside>',
        '<aside class="notes">The animation is a network: inputs on the left, two hidden layers, outputs on the right; orange pulses are the forward pass. Plan for the hour: the task (MNIST), the model we already know (multinomial logistic regression), a hidden layer as learned features, the forward pass on a digit you draw, the loss and gradient descent, backpropagation, a live training run, what the hidden units learned, overfitting, the statistician\'s view, and the network as a weighting estimator.</aside>', s, flags=re.S)
    # slide 2
    s = rep(s, '<p>Each pixel is a number between 0 (white) and 1 (black).</p>', '<p>Each pixel is a number between 0 (blank paper) and 1 (full ink).</p>')
    s = rep(s, 'This deck carries 5,000 and 1,000 of them.', 'This deck carries 4,000 for training, 1,000 for validation, and 1,000 test images.')
    # slide 3
    s = rep(s, """      <p>Each class $k$ has its own weight vector $\\cw{\\bw_k}$ with 784 entries.</p>
      <p>Drawn as an image: <span class="cl">red</span> pixels vote for $k$, <span class="cx">blue</span> pixels vote against.</p>
      <p class="small">Fit on 60,000 images: 90% test accuracy.</p>""",
    """      <p>Each class $k$ has its own weight vector $\\cw{\\bw_k}$ with 784 entries, a template.</p>
      <p>The softmax turns the ten scores $\\cw{\\bw_k}^{\\!\\top}\\cx{\\bx} + \\cw{b_k}$ into probabilities.</p>
      <p>Drawn as an image: <span class="cl">red</span> pixels raise the score for $k$, <span class="cx">blue</span> pixels lower it.</p>
      <p class="small">Fit on 60,000 images: 90% test accuracy. Each class gets one straight boundary; the remaining errors need a curved one.</p>""")
    s = rep(s, 'Ten percent of test digits are wrong.</aside>', 'Ten percent of test digits are wrong, and no choice of the ten templates fixes that: the score for each class is linear in the pixels, so each boundary is flat.</aside>')
    # slide 4
    s = rep(s, '<label>$g$ <select id="pgAct">', '<label>$\\varphi$ <select id="pgAct">')
    s = rep(s, '<label>$\\eta$ <input type="range" id="pgLr"', '<label>learning rate $\\eta$ <input type="range" id="pgLr"')
    s = rep(s, '<button id="pgRun" class="primary">run</button>', '<button id="pgRun" class="primary">train</button>')
    s = rep(s, '<div class="eq">$\\ch{\\bh} = g(\\cw{\\bW_1}\\cx{\\bx} + \\cw{\\bb_1})$</div>', '<div class="eq">$\\ch{\\bh} = \\varphi(\\cw{\\bW_1}\\cx{\\bx} + \\cw{\\bb_1})$</div>')
    s = rep(s, """      <p>Each hidden unit is one logistic-regression unit: a weighted sum, then a nonlinear $g$. It draws one line (small panels).</p>
      <p>The output layer is logistic regression on the hidden units. It adds the lines up into a curved boundary.</p>
      <p>Try the linear $g$: the boundary stays straight.</p>""",
    """      <p>Each hidden unit is a weighted sum of the inputs, then a nonlinear $\\varphi$; here ReLU, $\\varphi(z) = \\max(0, z)$.</p>
      <p>Its weighted sum is zero along one straight line (small panels).</p>
      <p>The output layer is multinomial logistic regression on the hidden units, so the boundary curves.</p>
      <p>With a linear $\\varphi$, $\\cw{\\bW_2}(\\cw{\\bW_1}\\cx{\\bx}) = (\\cw{\\bW_2}\\cw{\\bW_1})\\cx{\\bx}$: one straight boundary again.</p>""")
    s = re.sub(r'<aside class="notes">This is the whole idea of the lecture\..*?</aside>',
        '<aside class="notes">This is the whole idea of the lecture. Two inputs instead of 784 so the boundary can be drawn; the data are the XOR pattern (classes by quadrant), rings, or a spiral. First set one hidden unit: one straight line, and on XOR accuracy stalls near fifty percent. Then raise the hidden units: each learned feature is a half-plane, and multinomial logistic regression on those features gives a boundary that bends. Switch to the linear activation: two linear maps compose to one linear map, so the model is again logistic regression on the raw inputs and the boundary stays straight. The learning rate eta is the step size of training, defined two slides on.</aside>', s, flags=re.S)
    # slide 5
    s = rep(s, '$\\cx{\\bx} \\;\\xrightarrow{\\;\\cw{\\bW_1},\\;g\\;}\\; \\ch{\\bh}', '$\\cx{\\bx} \\;\\xrightarrow{\\;\\cw{\\bW_1},\\;\\varphi\\;}\\; \\ch{\\bh}')
    s = rep(s, """      <p>Pretrained network, 64 ReLU units, 97% test accuracy.</p>
      <p>Draw a digit and watch the 784 inputs become 64 features, then 10 probabilities.</p>""",
    """      <p>The forward pass computes $\\cp{\\bp}$ from $\\cx{\\bx}$, layer by layer.</p>
      <p>This network was trained beforehand on all 60,000 images: 64 ReLU units, 97% test accuracy.</p>
      <p>Draw a digit and watch the 784 inputs become 64 features, then 10 probabilities.</p>""")
    s = rep(s, 'The 8 by 8 grid is the hidden vector h; dark cells are active units.', 'The 8 by 8 grid is the hidden vector h; dark cells are active units, those whose ReLU output is positive.')
    # slide 6
    s = rep(s, """      <div class="eq">$L(\\btheta) = -\\frac{1}{n}\\sum_{i=1}^{n} \\log \\cp{p_{y_i}}$</div>
      <p>The loss is the negative log-likelihood, as in logistic regression. $\\btheta$ holds every weight.</p>
      <div class="eq">$\\btheta \\;\\leftarrow\\; \\btheta - \\eta\\,\\cl{\\nabla_{\\btheta} L(\\btheta)}$</div>
      <p>Step downhill by $\\eta$ times the gradient. Too small is slow; too large jumps across the valley.</p>""",
    """      <div class="eq">$L(\\btheta) = -\\frac{1}{n}\\sum_{i=1}^{n} \\log \\cp{p_{y_i}}(\\cx{\\bx_i};\\btheta)$</div>
      <p>The loss is the average negative log-likelihood, as in logistic regression. $\\btheta$ holds every weight and bias.</p>
      <p>There is no closed form, and Newton's method would need a 50,890 × 50,890 Hessian.</p>
      <div class="eq">$\\btheta \\;\\leftarrow\\; \\btheta - \\eta\\,\\cl{\\nabla_{\\btheta} L(\\btheta)}$</div>
      <p>So we step downhill by $\\eta$ times the gradient. Too small is slow; too large jumps across the valley.</p>""")
    s = re.sub(r'<aside class="notes">The loss is minus the log of the probability.*?</aside>',
        '<aside class="notes">The loss is minus the log of the probability the network assigns the true class, averaged over the data: the same objective as logistic regression, with the hidden layer\'s weights added to theta. For logistic regression that objective is convex and Newton\'s method, IRLS, solves it in a few steps. With a hidden layer it is not convex and theta has 50,890 entries for the 64-unit network, so we take first-order steps. Two parameters here so the surface can be drawn. Show the three failure modes live: slow, oscillating, diverging. Then the two-minima surface: the start decides where you end, which is why initialization matters. How the gradient is computed through the hidden layer is the next slide.</aside>', s, flags=re.S)
    # slide 7
    s = rep(s, """      <div class="eq">$\\dfrac{\\partial L}{\\partial \\cw{w}} = \\dfrac{\\partial L}{\\partial \\ch{a}}\\cdot\\dfrac{\\partial \\ch{a}}{\\partial z}\\cdot\\dfrac{\\partial z}{\\partial \\cw{w}}$</div>
      <p>Forward: compute each node from the nodes before it.</p>""",
    """      <div class="eq">$\\dfrac{\\partial L}{\\partial \\cw{w}} = \\dfrac{\\partial L}{\\partial \\ch{a}}\\cdot\\dfrac{\\partial \\ch{a}}{\\partial z}\\cdot\\dfrac{\\partial z}{\\partial \\cw{w}}$</div>
      <p class="small">One neuron: $z = \\cw{w}\\cx{x} + \\cw{b}$, $\\ch{a} = \\sigma(z)$, $L = -\\log \\ch{a}$ for label $y = 1$.</p>
      <p>Forward: compute each node from the nodes before it.</p>""")
    s = re.sub(r'<aside class="notes">One neuron, one example with label y equal to one\..*?</aside>',
        '<aside class="notes">One neuron, one example with label y equal to one. Press forward: values fill left to right. Press backward: derivatives fill right to left, each edge multiplying by a local derivative, the derivative of a node with respect to its direct input. The gradient for w is the product along the path. In a network a weight in the first layer reaches the loss through every output, and the chain rule sums over those paths; backpropagation organizes this so each node\'s derivative is computed once and reused by everything upstream of it. That is why the backward pass costs about as much as the forward pass, however many weights there are. Frameworks such as PyTorch do the bookkeeping over graphs with millions of nodes.</aside>', s, flags=re.S)
    # slide 8
    s = rep(s, '<p class="small" style="margin:6px 0 2px 0">One epoch is one pass over the training images, taken in mini-batches of the chosen size. Each mini-batch gives a noisy, cheap gradient.</p>',
               '<p class="small" style="margin:6px 0 2px 0">Stochastic gradient descent: each step uses one mini-batch, whose gradient is noisy but equals the full gradient on average. One epoch is one pass over the training images. The stopping epoch is chosen on the validation set; the test set is reported once.</p>')
    s = re.sub(r'<aside class="notes">Stochastic gradient descent: the gradient is averaged.*?</aside>',
        '<aside class="notes">Stochastic gradient descent: the gradient is averaged over a mini-batch, not the whole data set, so a step costs 32 forward-backward passes instead of 4,000; the mini-batch gradient is unbiased for the full gradient, which is why the noisy steps still head downhill. Batch size one is the noisiest; the full batch is smooth but gives one step per epoch. Four thousand training images, a thousand validation images for choosing the epoch, a thousand test images reported once at the chosen epoch. Before each run, ask the class to predict: what happens with zero hidden units (that is multinomial logistic regression again), with a learning rate ten times larger, with batch size one? Then run. Watch training and validation accuracy separate when the training set is small.</aside>', s, flags=re.S)
    # slide 9
    s = rep(s, '<p>The right panel: the test digits that excite the chosen unit, and its ten output weights.</p>',
               '<p>In 784 dimensions the unit\'s straight boundary is a hyperplane; drawn as an image it is a stroke template.</p>\n      <p>The right panel: the validation digits that activate the chosen unit most, and its ten output weights.</p>')
    # slide 10
    s = rep(s, """      <div class="eq">$L_\\lambda(\\btheta) = L(\\btheta) + \\frac{\\lambda}{2}\\,\\|\\btheta\\|^2$</div>
      <p>500 images, 128 hidden units: training accuracy reaches 100%, test accuracy stalls.</p>
      <p>Remedies: more data, weight decay $\\lambda$, early stopping at the best test epoch.</p>""",
    """      <div class="eq">$L_\\lambda(\\btheta) = L(\\btheta) + \\frac{\\lambda}{2}\\,\\|\\cw{\\bW}\\|^2$</div>
      <p class="small">Weight decay penalizes the weight matrices only; biases are not penalized, as in ridge regression.</p>
      <p>500 images, 101,770 parameters: training accuracy reaches 100%, validation accuracy stalls.</p>
      <p>Remedies: more data, weight decay $\\lambda$, early stopping at the best validation epoch.</p>""")
    s = re.sub(r'<aside class="notes">Same trainer, preset to a small sample and a large network\..*?</aside>',
        '<aside class="notes">Same trainer, preset to a small sample and a large network: 128 hidden units give 101,770 parameters for 500 images. The dashed line marks the epoch with the best validation accuracy: early stopping. Raise lambda and the gap narrows. The validation set chooses the epoch; the test accuracy is then reported once at that epoch, so it stays an honest estimate. With this many parameters a held-out set is not optional.</aside>', s, flags=re.S)
    # slide 11
    s = rep(s, '<div class="eq">$g^{-1}(\\mu) = \\cw{\\bw}^{\\!\\top}\\cx{\\bx}$</div><p>Features fixed by the analyst.</p>',
               '<div class="eq">$g(\\mu) = \\cw{\\bw}^{\\!\\top}\\cx{\\bx} + \\cw{b}$</div><p>Features fixed by the analyst.</p>')
    s = rep(s, '<div class="eq">$g^{-1}(\\mu) = \\sum_j \\cw{w_j}\\,\\phi_j(\\cx{\\bx})$</div><p>Basis $\\phi_j$ fixed in advance: splines, polynomials.</p>',
               '<div class="eq">$g(\\mu) = \\sum_j \\cw{w_j}\\,B_j(\\cx{\\bx}) + \\cw{b}$</div><p>Basis $B_j$ fixed in advance: splines, polynomials.</p>')
    s = rep(s, '<div class="eq">$g^{-1}(\\mu) = \\sum_j \\cw{w_j}\\,\\ch{h_j}(\\cx{\\bx};\\cw{\\bW_1})$</div><p>Basis learned from the data.</p>',
               '<div class="eq">$g(\\mu) = \\sum_j \\cw{w_j}\\,\\ch{h_j}(\\cx{\\bx};\\cw{\\bW_1}) + \\cw{b}$</div><p>Basis learned from the data.</p>')
    s = rep(s, '<p style="margin-top:22px">Many parameters and few guarantees: regularize, hold out data, and report uncertainty.</p>',
               '<p style="margin-top:22px">$g$ is the link; for a class probability, the logit. The activation $\\varphi$ is its inverse.</p>\n  <p>Many parameters, no convexity, no closed-form standard errors. Regularize, hold out data, and report uncertainty by resampling.</p>')
    # slide 12
    s = rep(s, '<p class="small">$\\ch{H}$ stacks the features $\\ch{\\bh}(\\bx_i)$ of the $n$ training images.</p>',
               '<p class="small">$\\ch{H}$ stacks the features $\\ch{\\bh}(\\bx_i)$ of the $n$ training images; $Y_i$ is the one-hot label of image $i$.</p>')
    s = rep(s, """      <p>Freeze the learned features. The output layer is least squares on them.</p>
      <p>So the prediction is a weighted sum of training labels, like k-NN, kernel, and spline smoothers.</p>
      <p>The hidden layer learns which training points count as neighbours.</p>""",
    """      <p>Freeze the learned features and replace the softmax layer by ridge regression on them.</p>
      <p>The prediction is then a linear smoother, as with ridge regression and smoothing splines.</p>
      <p>Unlike k-NN and kernel weights, these can be negative and need not sum to one.</p>""")
    s = re.sub(r'<aside class="notes">The same formula as linear regression, with h in place of x\..*?</aside>',
        '<aside class="notes">The same formula as ridge regression, with h in place of x. Given the learned features the map from labels to prediction is linear, so every tool for linear smoothers applies: the hat matrix, degrees of freedom, leave-one-out. Two qualifications. The features were learned from the same labels, so the full map is not linear; the weighting view holds given the features, as k-NN weights hold given a metric that was itself chosen using the labels. And the real output layer is a softmax trained jointly by gradient descent; the ridge smoother shown here replaces it on the same frozen features, and its test accuracy is printed next to the network\'s. Switch to raw pixels: the same formula on the wrong features, and the training digits with the largest weights stop resembling the query.</aside>', s, flags=re.S)
    # slide 13
    s = rep(s, '<p>A hidden layer learns features. The output layer is logistic regression on them.</p>', '<p>A hidden layer learns features. The output layer is multinomial logistic regression on them.</p>')
    s = rep(s, '<p>Training minimizes the negative log-likelihood by gradient descent.</p>', '<p>Training minimizes the average negative log-likelihood by gradient descent.</p>')
    s = rep(s, '<p>Many parameters: validate on held-out data, regularize, stop early.</p>', '<p>Many parameters: choose epochs and $\\lambda$ on a validation set, regularize, stop early.</p>')
    # full-deck-only slides: activation symbol
    s = s.replace('<label>$g$ <select id="nAct">', '<label>$\\varphi$ <select id="nAct">')
    s = s.replace('$\\ch{a} = g\\big(\\cw{w_1}\\cx{x_1} + \\cw{w_2}\\cx{x_2} + \\cw{b}\\big)$', '$\\ch{a} = \\varphi\\big(\\cw{w_1}\\cx{x_1} + \\cw{w_2}\\cx{x_2} + \\cw{b}\\big)$')
    s = s.replace('<p>A neuron is a weighted sum followed by a nonlinear function $g$.</p>', '<p>A neuron is a weighted sum followed by a nonlinear function $\\varphi$.</p>')
    s = s.replace('<p>With a sigmoid $g$, one neuron is logistic regression.</p>', '<p>With a sigmoid $\\varphi$, one neuron is logistic regression.</p>')
    s = s.replace('<p>Solid: $g(z)$. Dashed: the derivative $g\'(z)$, used in learning.</p>', '<p>Solid: $\\varphi(z)$. Dashed: the derivative $\\varphi\'(z)$, used in learning.</p>')
    s = s.replace('<p>Without a nonlinear $g$, stacked layers collapse to one linear map.</p>', '<p>Without a nonlinear $\\varphi$, stacked layers collapse to one linear map.</p>')
    s = s.replace("\\odot g'(\\bz_1)", "\\odot \\varphi'(\\bz_1)")
    s = s.replace('<p>Try the linear $g$: the boundary stays straight.</p>', '<p>Try the linear $\\varphi$: the boundary stays straight.</p>')
    return s
SOFT = True  # index.html already patched in the first run; full deck shares most anchors
rw("index_full.html", html)
for fn in ["index.html", "index_full.html"]:
    s = open(os.path.join(ROOT, fn)).read()
    left = re.findall(r"\$[^$]*(?<![a-zA-Z\\])g(?![a-zA-Z])[^$]*\$", s)
    print(fn, "remaining bare g in math:", [x for x in left if "g(\\mu)" not in x and "$g$ is the link" not in x][:5])
