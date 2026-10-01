(() => {
  const items = Array.from(document.querySelectorAll('.pub-item'));
  const groups = Array.from(document.querySelectorAll('.pub-year-group'));
  const filters = Array.from(document.querySelectorAll('.pub-filter-btn'));
  const search = document.getElementById('pub-search');
  const status = document.getElementById('pub-status');
  const more = document.getElementById('pub-more');
  const empty = document.getElementById('pub-empty');
  let filter = 'all';
  let expanded = false;
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const paperText = new Map(items.map(item => [item, normalize(item.textContent + ' ' + item.closest('.pub-year-group').querySelector('.pub-year-label').textContent)]));
  function renderPapers() {
    const terms = normalize(search.value).split(' ').filter(Boolean);
    const browsing = filter !== 'all' || terms.length > 0;
    let count = 0;
    items.forEach(item => {
      const matches = (filter === 'all' || item.dataset.type === filter) && terms.every(term => paperText.get(item).includes(term));
      item.hidden = !matches || (!browsing && !expanded && !item.hasAttribute('data-featured'));
      if (!item.hidden) count++;
    });
    groups.forEach(group => { group.hidden = !Array.from(group.querySelectorAll('.pub-item')).some(item => !item.hidden); });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    status.textContent = browsing ? `${count} ${count === 1 ? 'paper' : 'papers'} found` : expanded ? `All ${count} papers in this selection` : `${count} recent highlights · Search or filter to explore all ${items.length} selected papers`;
    more.hidden = browsing;
    more.textContent = expanded ? 'Show recent highlights' : `Explore all ${items.length} papers`;
    more.setAttribute('aria-expanded', String(expanded));
    empty.hidden = count > 0;
  }
  filters.forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderPapers(); }));
  search.addEventListener('input', renderPapers);
  more.addEventListener('click', () => {
    expanded = !expanded;
    renderPapers();
    if (!expanded) document.getElementById('publications').scrollIntoView();
  });
  document.getElementById('pub-reset').addEventListener('click', () => {
    filter = 'all'; search.value = ''; renderPapers(); search.focus();
  });
  function revealLinkedPaper() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    const paper = document.getElementById(id);
    if (!paper || !paper.classList.contains('pub-item')) return;
    filter = 'all'; search.value = ''; expanded = true; renderPapers();
    paper.scrollIntoView();
  }
  window.addEventListener('hashchange', revealLinkedPaper);
  document.querySelectorAll('a[href^="#paper-"]').forEach(link => link.addEventListener('click', () => {
    filter = 'all'; search.value = ''; expanded = true; renderPapers();
  }));
  document.getElementById('pub-controls').hidden = false;
  document.querySelector('.pub-more').hidden = false;
  status.hidden = false;
  renderPapers();
  revealLinkedPaper();

  const navLinks = Array.from(document.getElementById('nav-links').querySelectorAll('a[href^="#"]'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('main>section[id]').forEach(section => observer.observe(section));
  }
})();
