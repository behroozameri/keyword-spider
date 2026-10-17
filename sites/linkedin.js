(() => {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const MORE = /^(…|\.\.\.)?\s*(see |show )?more$/i;
  const MARK = 'data-spider-root';

  // Find the "About the job" heading.
  function findHeading() {
    return [...document.querySelectorAll('h1, h2, h3, h4, span, p, div')]
      .find(el => el.children.length === 0 && norm(el.textContent) === 'about the job');
  }

  // Walk upward until the job description container is found.
  function locate() {
    const h = findHeading();
    if (!h) return null;
    let el = h.parentElement, fallback = null;
    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
      const btn = [...el.querySelectorAll('button, a[role="button"]')]
        .find(b => MORE.test(norm(b.textContent)));
      if (btn) return { heading: h, box: el, btn };
      if (!fallback && (el.innerText || '').length > 400) fallback = el; // The description may already be expanded.
    }
    return fallback ? { heading: h, box: fallback, btn: null } : { heading: h, box: h.parentElement, btn: null };
  }

  window.Adapter = {
    name: 'linkedin',

    async prepare() {
      // 1. Locate "About the job" without moving the user's viewport.
      let loc = locate();
      if (!loc) { // Give the dynamic page a little more time to render.
        await Spider.sleep(1500);
        loc = locate();
      }
      if (!loc) { console.log('[linkedin] "About the job" was not found'); return; }

      // 2. Expand the description when a "more" button is present.
      if (loc.btn) {
        loc.btn.click();
        console.log('[linkedin] more clicked');
        await Spider.sleep(1200); // Wait for the expanded text to render.
      } else {
        console.log('[linkedin] no "more" button found; the description may already be expanded');
      }

      // 3. Mark only this description container as the extraction root.
      document.querySelectorAll('[' + MARK + ']').forEach(e => e.removeAttribute(MARK));
      const after = locate();
      (after ? after.box : loc.box).setAttribute(MARK, '1');
    },

    collect() {
      const sel = document.querySelector('[' + MARK + ']')
        ? '[' + MARK + ']'
        : '.jobs-description, #job-details, .jobs-box__html-content, .description__text';
      return Spider.keywords(sel, Spider.dictionaries.tech);
    },

    cleanup() {
      document.querySelectorAll('[' + MARK + ']').forEach(e => e.removeAttribute(MARK));
    },
  };
})();
