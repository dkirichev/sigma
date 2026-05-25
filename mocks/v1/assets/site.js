(() => {
  const toggle = document.querySelector('[data-search-toggle]');
  const drawer = document.getElementById('searchDrawer');
  if (!toggle || !drawer) return;

  const input = drawer.querySelector('input[type="search"]');
  const closeBtn = drawer.querySelector('.search-drawer-close');
  let hideTimer = null;

  const isOpen = () => drawer.classList.contains('is-open');

  const open = () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    drawer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      drawer.classList.add('is-open');
      input && input.focus({ preventScroll: true });
    });
  };

  const close = () => {
    drawer.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    hideTimer = setTimeout(() => {
      if (!drawer.classList.contains('is-open')) drawer.hidden = true;
      hideTimer = null;
    }, 220);
  };

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    isOpen() ? close() : open();
  });
  if (closeBtn) closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      close();
      toggle.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (drawer.contains(e.target) || toggle.contains(e.target)) return;
    close();
  });
})();

/* Masthead menu — collapses the nav into a slide-down drawer ≤860px */
(() => {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.getElementById('siteNav');
  if (!toggle || !nav) return;

  const isOpen = () => nav.classList.contains('is-open');

  const open = () => {
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    isOpen() ? close() : open();
  });

  // Choosing a destination closes the menu.
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      close();
      toggle.focus();
    }
  });

  // Returning to the desktop layout clears any open state.
  const mq = window.matchMedia('(min-width: 961px)');
  const onChange = (e) => { if (e.matches) close(); };
  mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
})();

/* Phones: reflow wide data tables (.table-wrap) into stacked label/value cards.
   Each <td> is tagged with its column header so the card can show every field —
   no hidden columns, no sideways scrolling. The actual block layout lives in
   styles.css behind @media (max-width: 560px); this only annotates the markup. */
(() => {
  const enhance = (scope) => {
    (scope || document).querySelectorAll('.table-wrap table').forEach((table) => {
      if (table.dataset.cards) return; // idempotent — already annotated
      const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      if (!heads.length) return;

      // Prose tables (e.g. the methodology field/source comparison) carry long
      // text, not metrics — they get a different card shape than numeric tables.
      const isProse = !table.querySelector('tbody td.rank, tbody td.num, tbody td.money');
      const wrap = table.closest('.table-wrap');
      if (wrap) wrap.classList.add(isProse ? 'tbl-prose' : 'tbl-cards');

      table.querySelectorAll('tbody tr').forEach((tr) => {
        const cells = [...tr.children];
        cells.forEach((td, i) => { if (heads[i]) td.setAttribute('data-label', heads[i]); });
        if (isProse) return;
        // Title = the entity cell (prefer the linked one); rank → corner badge.
        let title = cells.find((td) => td.querySelector('a')) ||
                    cells.find((td) => !td.classList.contains('rank') &&
                                       !td.classList.contains('num') &&
                                       !td.classList.contains('money'));
        if (title) title.classList.add('cell-title');
        cells.forEach((td) => { if (td.classList.contains('rank')) td.classList.add('cell-rank'); });
      });
      table.dataset.cards = '1';
    });
  };

  const run = () => enhance(document);
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);

  // Single-file SPA build swaps page content client-side — re-annotate new tables.
  if (window.MutationObserver) {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; run(); });
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
