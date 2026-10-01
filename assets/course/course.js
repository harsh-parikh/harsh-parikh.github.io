// Theme: the saved choice wins; otherwise the page follows the system setting (see <head>).
function toggleTheme() {
  var light = document.documentElement.classList.toggle('light');
  try { localStorage.setItem('bis5xx-theme', light ? 'light' : 'dark'); } catch (e) {}
  syncThemeButton();
}
function syncThemeButton() {
  var btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  var label = document.documentElement.classList.contains('light') ? 'Switch to dark mode' : 'Switch to light mode';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
}

// Links that open a new tab say so to screen readers.
function markNewTabLinks(root) {
  root.querySelectorAll('a[target="_blank"]').forEach(function (a) {
    var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
    if (rel.indexOf('noopener') === -1) rel.push('noopener');
    a.setAttribute('rel', rel.join(' '));
    if (!a.querySelector('.newtab')) {
      var s = document.createElement('span');
      s.className = 'sr-only newtab';
      s.textContent = ' (opens in a new tab)';
      a.appendChild(s);
    }
  });
}
window.markNewTabLinks = markNewTabLinks;

// Every date in the calendar carries its UTC offset, so these comparisons are
// right in any time zone. A class counts as "next" until it ends (80 minutes).
function nextLectureRow(now) {
  var rows = document.querySelectorAll('#calendar tr[data-start]');
  for (var i = 0; i < rows.length; i++) {
    if (Date.parse(rows[i].getAttribute('data-start')) + 80 * 60000 > now) return rows[i];
  }
  return null;
}
function upcomingItems(now) {
  var items = [];
  document.querySelectorAll('#calendar [data-coming]').forEach(function (el) {
    var due = Date.parse(el.getAttribute('data-due'));
    if (due > now) {
      items.push({ due: due, label: el.getAttribute('data-coming'), when: el.getAttribute('data-when'), href: el.getAttribute('data-href') });
    }
  });
  items.sort(function (a, b) { return a.due - b.due; });
  return items;
}
window.bis527NextLecture = nextLectureRow;
window.bis527Upcoming = upcomingItems;

function renderComingUp() {
  var now = Date.now();
  document.querySelectorAll('#calendar .badge-next').forEach(function (badge) { badge.remove(); });
  document.querySelectorAll('#calendar .is-next').forEach(function (row) { row.classList.remove('is-next'); });

  // Label deadlines that have passed, in the calendar and in Key Dates.
  document.querySelectorAll('[data-due]').forEach(function (el) {
    if (Date.parse(el.getAttribute('data-due')) > now || el.classList.contains('is-past')) return;
    el.classList.add('is-past');
    var tag = document.createElement('span');
    tag.className = 'past-tag';
    tag.textContent = 'Past';
    (el.querySelector('.when') || el).appendChild(tag);
  });

  // Highlight the next class in the table, with a text badge as well as colour.
  var row = nextLectureRow(now);
  if (row) {
    row.classList.add('is-next');
    var badge = document.createElement('span');
    badge.className = 'badge-next';
    badge.textContent = 'Next class';
    row.querySelector('th').appendChild(badge);
  }

  var box = document.getElementById('next-class');
  if (box) {
    box.textContent = '';
    if (!row) {
      var done = document.createElement('p');
      done.textContent = 'Classes have ended for the term. The last class was Thu, Dec 10.';
      box.appendChild(done);
    } else {
      var when = document.createElement('p');
      when.className = 'next-when';
      var date = document.createElement('strong');
      date.textContent = row.querySelector('.when-date').textContent;
      when.appendChild(date);
      when.appendChild(document.createTextNode(' · 3:00–4:20pm · ' + row.querySelector('.when-lec').textContent));
      box.appendChild(when);
      var topicCell = row.querySelector('td.topic');
      var topic = document.createElement('p');
      topic.className = 'next-topic' + (topicCell.classList.contains('tba') ? ' tba' : '');
      topic.innerHTML = topicCell.innerHTML;
      box.appendChild(topic);
      var reading = row.querySelector('td.reading .cell-list');
      if (reading) {
        var r = document.createElement('div');
        r.className = 'next-reading';
        var lab = document.createElement('span');
        lab.className = 'cell-label';
        lab.textContent = 'Reading';
        r.appendChild(lab);
        r.appendChild(reading.cloneNode(true));
        box.appendChild(r);
      }
      var link = document.createElement('p');
      link.className = 'next-link';
      var a = document.createElement('a');
      a.href = '#' + row.id;
      a.textContent = 'See it in the lecture calendar';
      link.appendChild(a);
      box.appendChild(link);
    }
  }

  var list = document.getElementById('due-soon');
  if (list) {
    var items = upcomingItems(now).slice(0, 4);
    list.textContent = '';
    if (!items.length) {
      var none = document.createElement('li');
      none.textContent = 'Nothing is listed here right now. Check Canvas for new assignments.';
      list.appendChild(none);
    }
    items.forEach(function (it) {
      var li = document.createElement('li');
      var w = document.createElement('span');
      w.className = 'due-when';
      w.textContent = it.when;
      var d = document.createElement('span');
      d.className = 'due-what';
      d.textContent = it.label;
      if (it.href) {
        d.appendChild(document.createTextNode(' · '));
        var da = document.createElement('a');
        da.href = it.href;
        da.textContent = 'details';
        if (/^https?:/.test(it.href)) da.target = '_blank';
        d.appendChild(da);
      }
      li.appendChild(w);
      li.appendChild(d);
      list.appendChild(li);
    });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.documentElement.classList.add('js');
  document.querySelector('.nav-toggle').hidden = false;
  document.querySelector('.theme-toggle').hidden = false;
  document.getElementById('chat-fab').hidden = false;
  syncThemeButton();
  renderComingUp();
  initCourseDesk();
  markNewTabLinks(document);

  // Menu button for narrow screens.
  var nav = document.querySelector('nav');
  var toggle = document.querySelector('.nav-toggle');
  function closeMenu() {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.querySelectorAll('#nav-links a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); toggle.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target)) closeMenu();
  });

  // Highlight the nav link for the section in view.
  var navLinks = document.querySelectorAll('nav .links a');
  var sections = document.querySelectorAll('main section');
  if ('IntersectionObserver' in window) {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        navLinks.forEach(function (link) { link.classList.remove('active'); link.removeAttribute('aria-current'); });
        var active = document.querySelector('nav .links a[href="#' + entry.target.id + '"]');
        if (active) { active.classList.add('active'); active.setAttribute('aria-current', 'location'); }
      }
    });
  }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });
  sections.forEach(function (s) { observer.observe(s); });
  }

  // Follow a change in the system theme while the reader has not picked one.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var follow = function (e) {
      var saved = null;
      try { saved = localStorage.getItem('bis5xx-theme'); } catch (err) {}
      if (!saved) { document.documentElement.classList.toggle('light', e.matches); syncThemeButton(); }
    };
    if (mq.addEventListener) mq.addEventListener('change', follow);
  }
});

// Calendar views use Yale's local calendar date, regardless of the reader's zone.
function initCourseDesk() {
  var rows = Array.from(document.querySelectorAll('#calendar tbody tr'));
  var buttons = Array.from(document.querySelectorAll('[data-calendar-view]'));
  var search = document.getElementById('calendar-search');
  var status = document.getElementById('calendar-status');
  var empty = document.getElementById('calendar-empty');
  var normalize = function (text) { return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  var searchable = new Map(rows.map(function (row) { return [row, normalize(row.textContent)]; }));
  var view = 'week';
  var formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  function localDate(now) {
    var parts = formatter.formatToParts(new Date(now));
    var value = function (type) { return parts.find(function (part) { return part.type === type; }).value; };
    return value('year') + '-' + value('month') + '-' + value('day');
  }
  function weekStart(today) {
    var date = new Date(today + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date;
  }
  function rowDate(row) { return row.querySelector('time').getAttribute('datetime').slice(0, 10); }
  var today = localDate(Date.now());
  if (today < rowDate(rows[0]) || today > rowDate(rows[rows.length - 1])) view = 'all';

  function renderCalendar() {
    var now = Date.now();
    var today = localDate(now);
    var start = weekStart(today);
    var end = new Date(start.getTime() + 7 * 86400000);
    var startKey = start.toISOString().slice(0, 10), endKey = end.toISOString().slice(0, 10);
    var terms = normalize(search.value).split(' ').filter(Boolean);
    var count = 0;
    rows.forEach(function (row) {
      var day = rowDate(row);
      var matchesView = view === 'all' || (view === 'week' && day >= startKey && day < endKey) ||
        (view === 'upcoming' && (row.hasAttribute('data-start') ? Date.parse(row.dataset.start) + 80 * 60000 > now : day >= today));
      var matchesSearch = terms.every(function (term) { return searchable.get(row).includes(term); });
      row.hidden = !(terms.length ? matchesSearch : matchesView);
      if (!row.hidden) count++;
    });
    buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.calendarView === view && !terms.length)); });
    status.textContent = terms.length ? count + ' matching calendar ' + (count === 1 ? 'entry' : 'entries') + ' · Searching the full term' :
      (view === 'week' ? 'This week' : view === 'upcoming' ? 'Upcoming' : 'Full term') + ' · ' + count + ' calendar ' + (count === 1 ? 'entry' : 'entries') + ' · All times are New Haven time';
    empty.hidden = count > 0;
    document.getElementById('desk-date').textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(now));
  }
  buttons.forEach(function (button) { button.addEventListener('click', function () { view = button.dataset.calendarView; search.value = ''; renderCalendar(); }); });
  search.addEventListener('input', renderCalendar);
  document.getElementById('calendar-reset').addEventListener('click', function () { view = 'all'; search.value = ''; renderCalendar(); search.focus(); });
  document.getElementById('calendar-tools').hidden = false;
  document.getElementById('desk-date').hidden = false;
  status.hidden = false;
  renderCalendar();

  function revealTarget(hash) {
    var id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (_) { return; }
    var target = document.getElementById(id);
    if (!target) return;
    var row = target.closest('#calendar tbody tr');
    if (row && row.hidden) { view = 'all'; search.value = ''; renderCalendar(); }
    // Native disclosures remain keyboard accessible, and direct links reveal their contents.
    for (var element = target; element; element = element.parentElement) {
      if (element.tagName === 'DETAILS') element.open = true;
    }
    var disclosure = target.querySelector(':scope > details');
    if (disclosure) disclosure.open = true;
  }
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href^="#"]');
    if (link) revealTarget(link.getAttribute('href'));
  });
  window.addEventListener('hashchange', function () {
    revealTarget(location.hash);
    var id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    var target = document.getElementById(id);
    if (target) target.scrollIntoView();
  });
  revealTarget(location.hash);
  if (location.hash) {
    var initialTarget;
    try { initialTarget = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) {}
    if (initialTarget) requestAnimationFrame(function () { initialTarget.scrollIntoView(); });
  }
  var closedForPrint = [];
  window.addEventListener('beforeprint', function () {
    closedForPrint = Array.from(document.querySelectorAll('details:not([open])'));
    closedForPrint.forEach(function (details) { details.open = true; });
  });
  window.addEventListener('afterprint', function () { closedForPrint.forEach(function (details) { details.open = false; }); });
  // Keep an open course page current without accumulating duplicate badges or notices.
  setInterval(function () { renderComingUp(); renderCalendar(); markNewTabLinks(document); }, 60000);
}
