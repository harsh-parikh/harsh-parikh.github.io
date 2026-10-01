// Theme before first paint: the reader's saved choice, else the system setting.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('bis5xx-theme'); } catch (e) {}
  var light = saved ? saved === 'light' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  if (light) document.documentElement.classList.add('light');
})();
