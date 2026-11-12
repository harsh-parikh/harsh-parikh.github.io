"""Sparse pass (Harsh: 'too much text, make them clean, minimal and sparse'): each slide's side column becomes
the equation(s) plus at most three short lines; every removed sentence moves into the speaker notes so the
definitions the readers asked for are still said aloud."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SIDE = {
 "digits": """      <p>Each image: 28 &times; 28 = 784 numbers.</p>
      <p>Each pixel between 0 (paper) and 1 (ink).</p>
      <div class="eq">$\\cx{\\bx} \\in [0,1]^{784}, \\qquad y \\in \\{0,1,\\dots,9\\}$</div>
      <p class="small">4,000 training, 1,000 validation, 1,000 test images in this deck.</p>""",
 "logreg": """      <div class="eq">$\\cp{p_k} = \\Pr(y = k \\mid \\cx{\\bx}) = \\dfrac{\\exp(\\cw{\\bw_k}^{\\!\\top}\\cx{\\bx} + \\cw{b_k})}{\\sum_{j} \\exp(\\cw{\\bw_j}^{\\!\\top}\\cx{\\bx} + \\cw{b_j})}$</div>
      <p>One template $\\cw{\\bw_k}$ and intercept $\\cw{b_k}$ per class.</p>
      <p>The softmax turns ten scores into probabilities.</p>
      <p><span class="cl">Red</span> pixels raise the score for $k$, <span class="cx">blue</span> lower it.</p>
      <p class="small">90% test accuracy. Every boundary is a straight line.</p>""",
 "playground": """      <div class="eq">$\\ch{\\bh} = \\varphi(\\cw{\\bW_1}\\cx{\\bx} + \\cw{\\bb_1})$</div>
      <div class="eq">$\\cp{\\bp} = \\mathrm{softmax}(\\cw{\\bW_2}\\ch{\\bh} + \\cw{\\bb_2})$</div>
      <p>Each hidden unit: a weighted sum, then $\\varphi(z) = \\max(0, z)$.</p>
      <p>Its sum is zero along one line (small panels).</p>
      <p>Softmax on $\\ch{\\bh}$: straight in $\\ch{\\bh}$, bent in $\\cx{\\bx}$.</p>""",
 "forward": """      <div class="eq" style="font-size:24px">$\\cx{\\bx} \\;\\xrightarrow{\\;\\cw{\\bW_1},\\;\\varphi\\;}\\; \\ch{\\bh} \\;\\xrightarrow{\\;\\cw{\\bW_2},\\;\\mathrm{softmax}\\;}\\; \\cp{\\bp}$</div>
      <p>Pretrained: 64 ReLU units, 97% test accuracy.</p>
      <p>Draw a digit: 784 inputs, 64 features, 10 probabilities.</p>""",
 "gd": """      <div class="eq">$L(\\btheta) = -\\frac{1}{n}\\sum_{i=1}^{n} \\log \\cp{p_{y_i}}(\\cx{\\bx_i};\\btheta)$</div>
      <p>The average negative log-likelihood, as in logistic regression.</p>
      <div class="eq">$\\btheta \\;\\leftarrow\\; \\btheta - \\eta\\,\\cl{\\nabla_{\\btheta} L(\\btheta)}$</div>
      <p>Not convex, 50,890 parameters: take gradient steps.</p>
      <p>Too small an $\\eta$ is slow; too large jumps across the valley.</p>""",
 "backprop": """      <div class="eq">$\\dfrac{\\partial L}{\\partial \\cw{w}} = \\dfrac{\\partial L}{\\partial \\ch{a}}\\cdot\\dfrac{\\partial \\ch{a}}{\\partial z}\\cdot\\dfrac{\\partial z}{\\partial \\cw{w}}$</div>
      <p class="small">$z = \\cw{w}\\cx{x} + \\cw{b}$, &nbsp; $\\ch{a} = \\sigma(z) = \\frac{1}{1+e^{-z}}$, &nbsp; $L = -\\log \\ch{a}$ for $y = 1$.</p>
      <p>Forward: each node from the nodes before it.</p>
      <p>Backward: multiply local derivatives back to each weight.</p>""",
 "features": """      <p>Each tile: one row of $\\cw{\\bW_1}$ as a 28 &times; 28 image.</p>
      <p>A hidden unit is a learned stroke template.</p>
      <p>Right: the validation digits that activate it, and its ten output weights.</p>""",
 "overfit": """      <div class="eq">$L_\\lambda(\\btheta) = L(\\btheta) + \\frac{\\lambda}{2}\\big(\\|\\cw{\\bW_1}\\|^2 + \\|\\cw{\\bW_2}\\|^2\\big)$</div>
      <p>500 images, 101,770 parameters: training hits 100%, validation stalls.</p>
      <p>Remedies: more data, weight decay $\\lambda$, early stopping on validation.</p>""",
 "weights": """      <div class="eq" style="font-size:26px">$\\hat y(\\bx) = \\sum_{i=1}^{n} w_i(\\bx)\\, Y_i$</div>
      <div class="eq" style="font-size:23px">$w_i(\\bx) = \\ch{\\bh}(\\bx)^{\\!\\top}\\,(\\ch{H}^{\\!\\top}\\ch{H} + \\lambda I)^{-1}\\,\\ch{\\bh}(\\bx_i)$</div>
      <p class="small">$\\ch{H}$ stacks $\\ch{\\bh}(\\bx_i)$ over $n = 4{,}000$ training images; $Y_i$ is the one-hot label.</p>
      <p>Freeze the features; ridge-regress the labels on them.</p>
      <p>$w_i(\\bx)$ ignores the labels: a linear smoother, like ridge and splines.</p>
      <p>Weights can be negative and need not sum to one.</p>""",
 "summary": """      <p>A neuron: a weighted sum, then a nonlinearity.</p>
      <p>A hidden layer learns features; softmax regression on them.</p>
      <p>Training: gradient descent on the average negative log-likelihood.</p>
      <p>Backpropagation: the chain rule, one backward pass.</p>
      <p>Many parameters: validation set, weight decay, early stopping.</p>
      <p class="small" style="margin-top:18px">Reading: Goodfellow, Bengio, Courville, <i>Deep Learning</i> (2016), ch. 6 and 8; Hastie, Tibshirani, Friedman, <i>ESL</i>, ch. 11; Nielsen, <i>Neural Networks and Deep Learning</i> (online).</p>
      <p class="small">Data: MNIST (LeCun, Cortes, Burges). Maths: KaTeX. Every figure is plain JavaScript in this folder; <span class="kbd">index_full.html</span> has ten more slides.</p>""",
}
# sentences moved into the notes (appended)
NOTES_ADD = {
 "digits": " MNIST has 60,000 training and 10,000 test images (LeCun, Cortes, Burges); this deck carries 4,000 for training, 1,000 as a validation set for choosing epochs, and 1,000 test images reported once.",
 "logreg": " The weights were fit on all 60,000 training images. The score for class k is w_k transpose x plus b_k; the softmax exponentiates and normalizes the ten scores. Every boundary between two classes is a straight line, and the remaining ten percent of errors need boundaries that bend.",
 "playground": " With a linear activation, W2 times W1 x equals (W2 W1) x: two linear maps compose to one, and the boundary is straight again. Phi is called the activation function.",
 "forward": " The forward pass computes p from x layer by layer. The network was trained beforehand on the 60,000 training images with 64 units and 20 epochs fixed in advance, so nothing about it was chosen on the test set.",
 "gd": " Theta holds every weight and intercept (called a bias in this literature). Logistic regression is convex and IRLS solves it in a few steps; here the loss is not convex and theta has 50,890 entries for the 64-unit network, so a Newton step would mean a 50,890 by 50,890 Hessian and we take first-order steps instead.",
 "backprop": " Every node stores one number forward (its value) and one number backward (the derivative of the loss with respect to it). Sigma is the logistic function, the two-class softmax.",
 "features": " In 784 dimensions each unit's line from the playground is a hyperplane; drawn as an image it is a stroke template. Red is evidence for a digit, blue against.",
 "overfit": " Weight decay shrinks the weights by a factor one minus eta lambda at each step; the intercepts are not penalized, as in ridge regression. The parameter count is 784 times 128 plus 128 plus 1,280 plus 10.",
 "weights": " H stacks the 64 features of the 4,000 training images; Y_i is the ten-vector with a one at y_i, so the prediction is the largest entry of y-hat. Lambda is fixed at 0.001, not tuned; the intercept is unpenalized.",
}

def patch(fn, soft):
    p = os.path.join(ROOT, fn); s = open(p).read()
    for wid, side in SIDE.items():
        m = re.search(r'(<section class="slide" data-widget="%s">.*?)(<div class="col side"[^>]*>)(.*?)(</div>\s*</div>\s*<aside class="notes">)(.*?)(</aside>)' % wid, s, flags=re.S)
        if not m:
            if soft: continue
            raise AssertionError("no side column for " + wid)
        new = m.group(1) + m.group(2) + "\n" + side + "\n    " + m.group(4) + m.group(5).rstrip() + NOTES_ADD.get(wid, "") + m.group(6)
        s = s[:m.start()] + new + s[m.end():]
    # slide 8 trainer caption
    s = re.sub(r'<p class="small" style="margin:6px 0 0 0">Stochastic gradient descent:.*?</p>\n      <p class="small" style="margin:2px 0 2px 0">One epoch.*?</p>',
               '<p class="small" style="margin:6px 0 2px 0">Each step uses a random mini-batch of 32 images; one epoch is one pass over the 4,000. The epoch is chosen on validation; test is reported once.</p>', s, flags=re.S)
    # slide 11 ladder footer
    m = re.search(r'<p style="margin-top:22px">\$\\mu = E\[y.*?</p>\n  <p>Many parameters, no convexity.*?</p>', s, flags=re.S)
    if m:
        s = s[:m.start()] + '<p style="margin-top:22px">$\\mu = E[y \\mid \\cx{\\bx}]$; $g$ is the link (the multinomial logit, inverse softmax); $\\varphi$ is the hidden activation.</p>\n  <p>Many parameters, no convexity, no closed-form standard errors: regularize, hold out, resample.</p>' + s[m.end():]
    elif not soft: raise AssertionError("ladder footer")
    s = s.replace('<div class="eq">$g(\\mu) = \\sum_j \\cw{w_j}\\,B_j(\\cx{\\bx}) + \\cw{b}$</div><p>Basis $B_j$ fixed in advance: splines, polynomials.</p>', '<div class="eq">$g(\\mu) = \\sum_j \\cw{w_j}\\,B_j(\\cx{\\bx}) + \\cw{b}$</div><p>Basis $B_j$ fixed: splines, polynomials.</p>')
    open(p, "w").write(s); print("patched", fn)

patch("index.html", False); patch("index_full.html", True)
