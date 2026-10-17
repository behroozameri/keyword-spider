(() => {
  const C = Spider.colors;
  Object.assign(C, { doi:'#4da3ff', PMID:'#ff4da6', ISBN:'#ffd24d', Bibcode:'#ff9f43',
    S2CID:'#9b5cff', PMC:'#4dffb8', JSTOR:'#ff6b6b', journal:'#c0ff4d', title:'#4df0ff' });

  function classify(a) {
    const h = a.href || '';
    if (/doi\.org\//.test(h)) return 'doi';
    if (/pubmed\.ncbi|nlm\.nih\.gov\/pubmed/.test(h)) return 'PMID';
    if (/\/pmc\/|pmc\.ncbi/.test(h)) return 'PMC';
    if (/Special:BookSources/.test(h)) return 'ISBN';
    if (/adsabs/.test(h)) return 'Bibcode';
    if (/semanticscholar/.test(h)) return 'S2CID';
    if (/jstor\.org/.test(h)) return 'JSTOR';
    return null;
  }

  window.Adapter = {
    name: 'wikipedia',
    collect() {
      const seen = new Set(), list = [];
      document.querySelectorAll('ol.references li').forEach(li => {
        li.querySelectorAll('a[href], i, q').forEach(el => {
          if (seen.has(el)) return;
          const text = el.textContent.trim();
          if (text.length < 2 || !el.offsetParent) return;
          let type = null;
          if (el.tagName === 'A') type = classify(el) || (el.closest('q') ? 'title' : null);
          else type = el.querySelector('a') ? null : (el.tagName === 'I' ? 'journal' : 'title');
          if (!type) return;
          seen.add(el); list.push({ el, type, text: text.slice(0, 80) });
        });
      });
      return list;
    },
  };
})();
