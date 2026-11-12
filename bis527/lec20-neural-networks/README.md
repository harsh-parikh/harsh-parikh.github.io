# Introduction to Neural Networks — BIS 527

An interactive, self-contained lecture deck. Open `index.html` in Chrome, Safari,
Firefox, or Edge. No installation and no internet connection are needed; nothing
leaves your computer.

## Using the deck

| Key | Action |
|---|---|
| `→` `space` `PageDown` | next slide |
| `←` `PageUp` | previous slide |
| `Home` / `End` | first / last slide |
| `F` | fullscreen |

Every figure is live. Drag the sliders, change the menus, draw a digit on slide 5,
and train a network on slide 8. Slide 9 can show the hidden units of the network
you trained on slide 8 (choose "from the live run").

## What is in the folder

```
index.html            the lecture: 12 slides
index_full.html       the longer version: 22 slides (adds the vector view, the linear limit, one neuron,
                      activation functions, shapes, the loss curve, backprop through the network,
                      SGD on a 2-parameter loss, and convolution)
css/deck.css          layout and typography
js/deck.js            navigation, scaling, KaTeX rendering
js/nn.js              a small neural-network library (data, MLP, SGD, 2-D toy data)
js/widgets_core.js    slides 1-7   (digits, vector view, logistic regression, neuron, activations)
js/widgets_mid.js     slides 8-15  (hidden layer, shapes, forward pass, loss, gradient descent, backprop, SGD)
js/widgets_train.js   live MNIST training, learned features, overfitting, convolution, the weighting-estimator view, summary
js/mnist_data.js      5,000 MNIST training images and 1,000 test images (uint8, base64)
js/pretrained.js      a logistic regression (90.4% test) and a 784-64-10 ReLU network (97.0% test),
                      both fit on the full 60,000 training images with build/train_pretrained.py
vendor/katex/         KaTeX 0.16 (MIT) for the mathematics
build/                scripts that regenerate the data and the pretrained models (Python 3 + numpy),
                      and a headless render check (node + playwright)
```

## Regenerating the data (optional)

```
cd data && curl -O https://storage.googleapis.com/cvdf-datasets/mnist/{train-images-idx3-ubyte.gz,train-labels-idx1-ubyte.gz,t10k-images-idx3-ubyte.gz,t10k-labels-idx1-ubyte.gz}
cd .. && python3 build/prepare_data.py && python3 build/train_pretrained.py
```

## Credits

MNIST: Yann LeCun, Corinna Cortes, Christopher J.C. Burges. Mathematics rendered
with KaTeX. Everything else is plain JavaScript written for this lecture.

Harsh Parikh, Yale School of Public Health, November 2026.
