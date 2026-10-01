(() => {
  const menu = document.querySelector('.menu-button');
  const links = document.getElementById('nav-links');
  const smallScreen = window.matchMedia('(max-width: 900px)');
  const closeMenu = () => {
    links.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    menu.textContent = 'Menu';
  };
  menu.hidden = false;
  links.classList.add('collapsible');
  menu.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? 'Close' : 'Menu';
  });
  links.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && links.classList.contains('open')) {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-nav')) closeMenu();
  });
  smallScreen.addEventListener('change', closeMenu);

})();
