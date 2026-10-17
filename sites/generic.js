(() => {
  if (!window.SpiderAdapters?.select) {
    throw new Error('The shared browser adapters must be loaded before the generic adapter.');
  }
  window.Adapter = window.SpiderAdapters.select();
})();
