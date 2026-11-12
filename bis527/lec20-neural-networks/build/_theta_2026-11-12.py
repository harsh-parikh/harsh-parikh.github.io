"""Rename network weights w -> theta (Theta for matrices) in slides, notes, and canvas labels; w_i(x) stays the smoother weight.
Also gloss h(x) on slides 4 and 12."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HTML = [
    ("\\cw{\\bw_k}", "\\cw{\\btheta_k}"), ("\\cw{\\bw_j}", "\\cw{\\btheta_j}"), ("\\cw{\\bw}", "\\cw{\\btheta}"),
    ("\\cw{w_1}", "\\cw{\\theta_1}"), ("\\cw{w_2}", "\\cw{\\theta_2}"), ("\\cw{w_j}", "\\cw{\\theta_j}"), ("\\cw{w}", "\\cw{\\theta}"),
    ("\\cw{\\bW_1}", "\\cw{\\bTheta_1}"), ("\\cw{\\bW_2}", "\\cw{\\bTheta_2}"), ("\\cw{\\bW}", "\\cw{\\bTheta}"),
    ("\\cw{\\bW_1}^{\\!\\top}", "\\cw{\\bTheta_1}^{\\!\\top}"),
    ("One template $\\cw{\\btheta_k}$ and intercept $\\cw{b_k}$ per class.", "One template $\\cw{\\btheta_k}$ and intercept $\\cw{b_k}$ per class."),
    # h(x) glosses
    ("<p>Each hidden unit: a weighted sum, then $\\varphi(z) = \\max(0, z)$.</p>",
     "<p>$\\ch{\\bh}(\\cx{\\bx})$: the hidden layer's output, the learned features of $\\cx{\\bx}$.</p>\n      <p>Each hidden unit: a weighted sum, then $\\varphi(z) = \\max(0, z)$.</p>"),
    ("<p class=\"small\">$\\ch{H}$ stacks $\\ch{\\bh}(\\bx_i)$ over $n = 4{,}000$ training images; $Y_i$ is the one-hot label.</p>",
     "<p class=\"small\">$\\ch{\\bh}(\\bx)$: the 64 hidden features of $\\bx$; $\\ch{H}$ stacks $\\ch{\\bh}(\\bx_i)$ over $n = 4{,}000$ training images; $Y_i$ is the one-hot label.</p>"),
    ("Each tile: one row of $\\cw{\\bTheta_1}$ as a 28 &times; 28 image.", "Each tile: one row of $\\cw{\\bTheta_1}$ as a 28 &times; 28 image."),
    # notes
    ("The score for class k is w_k transpose x plus b_k", "The score for class k is theta_k transpose x plus b_k"),
    ("The gradient for w is the product along the path.", "The gradient for theta is the product along the path."),
    ("W2 times W1 x equals (W2 W1) x", "Theta2 times Theta1 x equals (Theta2 Theta1) x"),
    ("The parameter count is 784 times 128", "The parameter count is 784 times 128"),
]
# full-deck-only text
HTML_FULL = [
    ("$\\cw{\\bW_2}(\\cw{\\bW_1}\\cx{\\bx}) = (\\cw{\\bW_2}\\cw{\\bW_1})\\,\\cx{\\bx}$", "$\\cw{\\bTheta_2}(\\cw{\\bTheta_1}\\cx{\\bx}) = (\\cw{\\bTheta_2}\\cw{\\bTheta_1})\\,\\cx{\\bx}$"),
    ("Delta two is the ten bars", "Delta two is the ten bars"),
]
JS = {
 "js/widgets_core.js": [
    ('text(ctx, `w${this.sel}`, 250, 170,', 'text(ctx, `θ${this.sel}`, 250, 170,'),
    ('text(ctx, "score  wₖ·x + bₖ", 480, 25,', 'text(ctx, "score  θₖ·x + bₖ", 480, 25,'),
    ('text(ctx, "the ten templates w₀ … w₉", 10, 245,', 'text(ctx, "the ten templates θ₀ … θ₉", 10, 245,'),
    ('text(ctx, `w₁ = ${fmt(w1, 1)}`, 100, 150,', 'text(ctx, `θ₁ = ${fmt(w1, 1)}`, 100, 150,'),
    ('text(ctx, `w₂ = ${fmt(w2, 1)}`, 100, 275,', 'text(ctx, `θ₂ = ${fmt(w2, 1)}`, 100, 275,'),
    ('text(ctx, "z = w₁x₁ + w₂x₂ + b", 60, 380,', 'text(ctx, "z = θ₁x₁ + θ₂x₂ + b", 60, 380,'),
 ],
 "js/widgets_mid.js": [
    ('? [["x", 784, 1, C.x, "784"], ["W₁", 784, m, C.w, `${m} × 784`], ["h", m, 1, C.h, `${m}`], ["W₂", m, 10, C.w, `10 × ${m}`], ["p", 10, 1, C.p, "10"]]\n        : [["x", 784, 1, C.x, "784"], ["W", 784, 10, C.w, "10 × 784"], ["p", 10, 1, C.p, "10"]];',
     '? [["x", 784, 1, C.x, "784"], ["Θ₁", 784, m, C.w, `${m} × 784`], ["h", m, 1, C.h, `${m}`], ["Θ₂", m, 10, C.w, `10 × ${m}`], ["p", 10, 1, C.p, "10"]]\n        : [["x", 784, 1, C.x, "784"], ["Θ", 784, 10, C.w, "10 × 784"], ["p", 10, 1, C.p, "10"]];'),
    ('if (name.startsWith("W")) {', 'if (name.startsWith("Θ")) {'),
    ('text(ctx, "W₁, ReLU", 365, 92,', 'text(ctx, "Θ₁, ReLU", 365, 92,'),
    ('text(ctx, "W₂, softmax", hx + 8 * cs + 33, 92,', 'text(ctx, "Θ₂, softmax", hx + 8 * cs + 33, 92,'),
    ('text(ctx, "pre-activations z₁ = W₁x + b₁ (negative in blue, ReLU zeroes them)", 250, 330,', 'text(ctx, "pre-activations z₁ = Θ₁x + b₁ (negative in blue, ReLU zeroes them)", 250, 330,'),
    ('w: [70, 200, "w", fmt(w, 1), C.w]', 'w: [70, 200, "θ", fmt(w, 1), C.w]'),
    ('["x", "z", "∂z/∂x = w", fmt(w, 1)], ["w", "z", "∂z/∂w = x", fmt(x, 1)]', '["x", "z", "∂z/∂x = θ", fmt(w, 1)], ["w", "z", "∂z/∂θ = x", fmt(x, 1)]'),
    ('text(ctx, "z = w·x + b", 240, 265,', 'text(ctx, "z = θ·x + b", 240, 265,'),
    ('if (this.bwd >= 3) text(ctx, `∂L/∂w = (−1/a)(a(1−a))(x) = ${fmt(dLdw, 3)}`', 'if (this.bwd >= 3) text(ctx, `∂L/∂θ = (−1/a)(a(1−a))(x) = ${fmt(dLdw, 3)}`'),
    ('text(ctx, "W₁, ReLU", 150, yF + 32,', 'text(ctx, "Θ₁, ReLU", 150, yF + 32,'),
    ('text(ctx, "W₂, softmax", hx + 210, yF + 32,', 'text(ctx, "Θ₂, softmax", hx + 210, yF + 32,'),
    ('text(ctx, "W₂ᵀ δ₂, ⊙ φ′", hx + 210, yB + 32,', 'text(ctx, "Θ₂ᵀ δ₂, ⊙ φ′", hx + 210, yB + 32,'),
    ('text(ctx, "∇W₁ = δ₁ xᵀ", 150, yB + 32,', 'text(ctx, "∇Θ₁ = δ₁ xᵀ", 150, yB + 32,'),
    ('text(ctx, "one row of ∇W₁ is δ₁ⱼ times the image", 10, 462,', 'text(ctx, "one row of ∇Θ₁ is δ₁ⱼ times the image", 10, 462,'),
    ('text(ctx, "w", x0 + size + 8, y0 + size / 2 + 5, { size: 16, color: "#555" }); text(ctx, "b", x0 + size / 2, y0 - 6,', 'text(ctx, "θ", x0 + size + 8, y0 + size / 2 + 5, { size: 16, color: "#555" }); text(ctx, "b", x0 + size / 2, y0 - 6,'),
 ],
 "js/widgets_train.js": [
    ('text(ctx, `${Hn} rows of W₁, each drawn as 28 × 28`', 'text(ctx, `${Hn} rows of Θ₁, each drawn as 28 × 28`'),
    ('text(ctx, "its weights into the ten outputs (row of W₂)", rx, 275,', 'text(ctx, "its weights into the ten outputs (row of Θ₂)", rx, 275,'),
 ],
 "js/deck.js": [
    ('"\\\\bW": "\\\\mathbf{W}",', '"\\\\bW": "\\\\mathbf{W}", "\\\\bTheta": "\\\\boldsymbol{\\\\Theta}",'),
 ],
}
# backprop node labels: the `bwdVal` keys print "∂L/∂" + name, name is now θ for the w node; ok.

def apply(path, pairs, soft):
    p = os.path.join(ROOT, path); s = open(p).read(); n = 0
    for old, new in pairs:
        if old in s: s = s.replace(old, new); n += 1
        elif not soft: raise AssertionError(path + " anchor missing: " + old[:70])
    open(p, "w").write(s); print(path, n, "replacements")

apply("index.html", HTML, True)
apply("index_full.html", HTML + HTML_FULL, True)
for f, pairs in JS.items(): apply(f, pairs, True)
# anything left?
for fn in ["index.html", "index_full.html"]:
    s = open(os.path.join(ROOT, fn)).read()
    left = re.findall(r"\\bw\b|\\bW\b|\\cw\{w|\\cw\{\\bw|\\bW_", s)
    print(fn, "leftover w symbols:", len(left))
