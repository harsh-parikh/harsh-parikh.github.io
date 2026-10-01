/* Apply the saved theme before paint. Storage is optional, including on local files. */
(() => {
  let theme;
  try { theme = localStorage.getItem('theme'); } catch (_) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.theme-button');
    if (!button) return;
    const label = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      button.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
      button.title = button.getAttribute('aria-label');
    };
    button.hidden = false;
    label();
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (_) {}
      label();
    });
  });
})();
