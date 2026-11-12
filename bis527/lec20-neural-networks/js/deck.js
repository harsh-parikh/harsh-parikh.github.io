/* deck.js -- minimal slide navigation, scaling, maths, and widget lifecycle. */
(function () {
  "use strict";
  const stage = document.getElementById("stage");
  const slides = Array.from(document.querySelectorAll(".slide"));
  const counter = document.getElementById("counter");
  const progress = document.getElementById("progress");
  const notesPane = document.getElementById("notesPane");
  let cur = -1;
  const inited = new Set();

  function fit() {
    const sw = window.innerWidth / 1280, sh = window.innerHeight / 720, s = Math.min(sw, sh);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
    stage.style.transformOrigin = "50% 50%";
  }
  window.addEventListener("resize", fit); fit();

  function renderMath(root) {
    if (!window.renderMathInElement) return;
    renderMathInElement(root, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
      throwOnError: false,
      macros: {
        "\\cx": "\\textcolor{1f6fb2}{#1}", "\\cw": "\\textcolor{d9671e}{#1}", "\\ch": "\\textcolor{2a9d5c}{#1}",
        "\\cp": "\\textcolor{7a3fb0}{#1}", "\\cl": "\\textcolor{c0392b}{#1}", "\\R": "\\mathbb{R}",
        "\\bx": "\\mathbf{x}", "\\bw": "\\mathbf{w}", "\\bh": "\\mathbf{h}", "\\bz": "\\mathbf{z}", "\\bp": "\\mathbf{p}", "\\bb": "\\mathbf{b}", "\\bW": "\\mathbf{W}", "\\bTheta": "\\boldsymbol{\\Theta}", "\\btheta": "\\boldsymbol{\\theta}", "\\bdelta": "\\boldsymbol{\\delta}",
      },
    });
  }

  function go(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === cur) return;
    if (cur >= 0) {
      slides[cur].classList.remove("current");
      const wOld = slides[cur].dataset.widget;
      if (wOld && window.Widgets[wOld] && window.Widgets[wOld].leave) window.Widgets[wOld].leave(slides[cur]);
    }
    cur = n;
    const s = slides[cur];
    s.classList.add("current");
    const w = s.dataset.widget;
    if (w && window.Widgets && window.Widgets[w]) {
      if (!inited.has(cur)) { inited.add(cur); try { window.Widgets[w].init(s); } catch (e) { console.error("widget", w, e); } }
      if (window.Widgets[w].enter) window.Widgets[w].enter(s);
    }
    location.hash = "#" + (cur + 1);
    counter.textContent = (cur + 1) + " / " + slides.length;
    progress.style.width = (100 * (cur + 1) / slides.length) + "%";
    const notes = s.querySelector(".notes");
    notesPane.innerHTML = notes ? notes.innerHTML : "";
  }

  document.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) {
      if (e.target.tagName === "BUTTON" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) e.target.blur(); else return;
    }
    switch (e.key) {
      case "ArrowRight": case "PageDown": case " ": go(cur + 1); e.preventDefault(); break;
      case "ArrowLeft": case "PageUp": go(cur - 1); e.preventDefault(); break;
      case "Home": go(0); break;
      case "End": go(slides.length - 1); break;
      case "f": case "F": if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); break;
      case "n": case "N": notesPane.classList.toggle("on"); break;
      default: return;
    }
  });
  window.addEventListener("hashchange", () => { const n = parseInt(location.hash.slice(1), 10); if (!isNaN(n)) go(n - 1); });

  renderMath(document.body);
  const start = parseInt(location.hash.slice(1), 10);
  go(isNaN(start) ? 0 : start - 1);
  window.Deck = { go, renderMath, current: () => cur };
})();
