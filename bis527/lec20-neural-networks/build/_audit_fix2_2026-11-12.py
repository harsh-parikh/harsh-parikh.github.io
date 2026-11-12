"""Audit fix pass 2 (confirmatory reader): phi/link statement on slide 11, undefined symbols, slide-12 scope and intercept."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rep(s, old, new, soft=False):
    if s.count(old) < 1:
        if soft: return s
        raise AssertionError("anchor missing: " + old[:90])
    return s.replace(old, new)

def html(s, soft):
    R = lambda o, n: rep(s, o, n, soft)
    # slide 1 notes
    s = R('The animation is a network: inputs on the left, two hidden layers, outputs on the right;', 'The animation is a network with two hidden layers, one more than we build today: inputs on the left, outputs on the right;')
    # slide 3
    s = R('Each class gets one straight boundary; the remaining errors need a curved one.', 'Every boundary between two classes is a straight line; the remaining errors need boundaries that bend.')
    s = R('<p>Each class $k$ has its own weight vector $\\cw{\\bw_k}$ with 784 entries, a template.</p>', '<p>Each class $k$ has its own weight vector $\\cw{\\bw_k}$ with 784 entries, a template, and an intercept $\\cw{b_k}$.</p>')
    # slide 4
    s = R('<p>Its weighted sum is zero along one straight line (small panels).</p>', '<p>Each unit\'s weighted sum is zero along one straight line (small panels).</p>')
    s = R('<p>The output layer is multinomial logistic regression on the hidden units, so the boundary curves.</p>', '<p>The output layer is multinomial logistic regression on the hidden units: straight in $\\ch{\\bh}$, so bent in $\\cx{\\bx}$.</p>')
    s = R('each learned feature is a half-plane, and multinomial logistic regression on those features gives a boundary that bends.', 'each learned feature is a ramp that is zero on one side of its line, and multinomial logistic regression on those features gives a boundary that is straight in h and therefore bends in x (piecewise linear for ReLU).')
    s = R('Switch to the linear activation: two linear maps compose', 'Switch to the linear activation (phi is called the activation function): two linear maps compose')
    # slide 5
    s = R('This network was trained beforehand on all 60,000 images: 64 ReLU units, 97% test accuracy.', 'This network was trained beforehand on the 60,000 training images with 64 units and 20 epochs fixed in advance: 97% test accuracy.')
    # slide 6
    s = R('$\\btheta$ holds every weight and bias.</p>', '$\\btheta$ holds every weight and bias (intercept).</p>')
    s = R("<p>There is no closed form, and Newton's method would need a 50,890 × 50,890 Hessian.</p>", "<p>Logistic regression is convex and IRLS solves it. With a hidden layer the loss is not convex and $\\btheta$ has 50,890 entries for 64 units.</p>")
    s = R('<p>So we step downhill by $\\eta$ times the gradient.', '<p>So we take gradient steps: downhill by $\\eta$ times the gradient.')
    s = R("With a hidden layer it is not convex and theta has 50,890 entries for the 64-unit network, so we take first-order steps.", "With a hidden layer the loss is a composition through a nonlinearity and is not convex (permuting the hidden units gives another minimum of equal value), and theta has 50,890 entries for the 64-unit network, so a Newton step would mean a 50,890 by 50,890 Hessian; we take first-order steps instead.")
    # slide 7
    s = R('<p class="small">One neuron: $z = \\cw{w}\\cx{x} + \\cw{b}$, $\\ch{a} = \\sigma(z)$, $L = -\\log \\ch{a}$ for label $y = 1$.</p>',
          '<p class="small">One neuron (one hidden unit): $z = \\cw{w}\\cx{x} + \\cw{b}$, $\\ch{a} = \\sigma(z) = 1/(1+e^{-z})$, $L = -\\log \\ch{a}$ for label $y = 1$.</p>')
    s = R('<p>Forward: compute each node from the nodes before it.</p>', '<p>Forward: compute each node ($z$, $\\ch{a}$, $L$) from the nodes before it.</p>')
    # slide 8
    s = R('<p class="small" style="margin:6px 0 2px 0">Stochastic gradient descent: each step uses one mini-batch, whose gradient is noisy but equals the full gradient on average. One epoch is one pass over the training images. The stopping epoch is chosen on the validation set; the test set is reported once.</p>',
          '<p class="small" style="margin:6px 0 0 0">Stochastic gradient descent: each step uses a random mini-batch of 32 images, whose gradient is noisy but equals the full gradient on average.</p>\n      <p class="small" style="margin:2px 0 2px 0">One epoch is one pass over the 4,000 training images. The epoch is chosen on the validation set; the test set is reported once at that epoch.</p>')
    s = R('with a learning rate ten times larger, with batch size one? Then run. Watch training and validation accuracy separate when the training set is small.', 'with a learning rate of 1 instead of 0.1, with batch size one? Then run, and compare runs by validation accuracy, never by the test number. Set training images to 500 to watch training and validation accuracy separate.')
    # slide 9
    s = R("<p>In 784 dimensions the unit's straight boundary is a hyperplane; drawn as an image it is a stroke template.</p>", "<p>In 784 dimensions each unit's line is a hyperplane. Drawn as an image, it is a stroke template.</p>")
    # slide 10
    s = R('$L_\\lambda(\\btheta) = L(\\btheta) + \\frac{\\lambda}{2}\\,\\|\\cw{\\bW}\\|^2$', '$L_\\lambda(\\btheta) = L(\\btheta) + \\frac{\\lambda}{2}\\big(\\|\\cw{\\bW_1}\\|^2 + \\|\\cw{\\bW_2}\\|^2\\big)$')
    s = R('<p class="small">Weight decay penalizes the weight matrices only; biases are not penalized, as in ridge regression.</p>', '<p class="small">Weight decay: each step shrinks the weights by $1 - \\eta\\lambda$. Intercepts are not penalized, as in ridge regression.</p>')
    s = R('<p>500 images, 101,770 parameters: training accuracy reaches 100%, validation accuracy stalls.</p>', '<p>500 images, 128 hidden units, 101,770 parameters: training accuracy reaches 100%, validation accuracy stalls.</p>')
    # slide 11
    s = R('<p style="margin-top:22px">$g$ is the link; for a class probability, the logit. The activation $\\varphi$ is its inverse.</p>',
          '<p style="margin-top:22px">$\\mu = E[y \\mid \\cx{\\bx}]$ and $g$ is the link: for ten classes, the multinomial logit, whose inverse is the softmax. The hidden activation $\\varphi$ is a separate object.</p>')
    # slide 12
    s = R('<h2>A neural network is a weighting estimator</h2>', '<h2>Given its features, a network is a weighting estimator</h2>')
    s = R('<p class="small">$\\ch{H}$ stacks the features $\\ch{\\bh}(\\bx_i)$ of the $n$ training images; $Y_i$ is the one-hot label of image $i$.</p>',
          '<p class="small">$\\ch{H}$ stacks $\\ch{\\bh}(\\bx_i)$ for the $n = 4{,}000$ training images; $Y_i \\in \\{0,1\\}^{10}$ has a 1 at $y_i$, so $\\hat y(\\bx)$ is a 10-vector and the prediction is its largest entry. $\\lambda$ is fixed at 0.001, not tuned.</p>')
    s = R('<p>Freeze the learned features and replace the softmax layer by ridge regression on them.</p>', '<p>Freeze the learned features of the slide-5 network and replace its softmax layer by ridge regression on them.</p>')
    s = R('<p>The prediction is then a linear smoother, as with ridge regression and smoothing splines.</p>', '<p>The weights $w_i(\\bx)$ do not depend on the labels: a linear smoother, as with ridge regression and smoothing splines.</p>')
    s = R('the weighting view holds given the features, as k-NN weights hold given a metric that was itself chosen using the labels.', 'the weighting view holds once the features are fixed, which is also the status of a random forest\'s weights given its trees.')
    s = R('Switch to raw pixels: the same formula on the wrong features, and the training digits with the largest weights stop resembling the query.', 'Switch to raw pixels: the same formula with the pixels themselves as features, and the training digits with the largest weights stop resembling the test digit. The intercept is unpenalized, as on the previous slide.')
    return s

for fn, soft in [("index.html", False), ("index_full.html", True)]:
    p = os.path.join(ROOT, fn); s = open(p).read(); s = html(s, soft); open(p, "w").write(s); print("patched", fn)

# weights widget: do not penalize the intercept (last feature)
p = os.path.join(ROOT, "js/widgets_train.js"); s = open(p).read()
s = rep(s, 'for (let a = 0; a < d; a++) G[a * d + a] += lam;', 'for (let a = 0; a < d - 1; a++) G[a * d + a] += lam; // intercept (last feature) unpenalized')
s = rep(s, 'text(ctx, kind === "hidden" ? "features: 64 learned hidden units + 1, ridge λ = 0.001" : "features: 784 raw pixels + 1, ridge λ = 1", px, py + ph + 48, { size: 13, color: "#777" });',
           'text(ctx, kind === "hidden" ? "features: 64 learned hidden units + intercept, ridge λ = 0.001" : "features: 784 raw pixels + intercept, ridge λ = 1", px, py + ph + 48, { size: 13, color: "#777" });')
open(p, "w").write(s); print("patched widgets_train.js")
