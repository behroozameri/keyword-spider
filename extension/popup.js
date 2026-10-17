const extensionApi = globalThis.browser ?? globalThis.chrome;

const maxInput = document.querySelector('#max-results');
const topInput = document.querySelector('#top-targets');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const statusElement = document.querySelector('#status');

function setStatus(message, kind = '') {
  statusElement.textContent = message;
  statusElement.dataset.kind = kind;
}

function setBusy(busy) {
  startButton.disabled = busy;
  stopButton.disabled = busy;
  maxInput.disabled = busy;
  topInput.disabled = busy;
}

function clampInteger(value, minimum, maximum, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function startInjected(options) {
  if (!window.SpiderExtension?.start) {
    throw new Error('Keyword Spider could not initialize on this page.');
  }
  window.__keywordSpiderStart = window.SpiderExtension.start(options);
  return true;
}

function stopInjected() {
  if (!window.Spider?.cleanup) return false;
  window.Spider.cleanup();
  return true;
}

async function activeTab() {
  const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error('No active tab is available.');
  return tab;
}

function validatePage(tab) {
  const url = tab.url || '';
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Open a regular HTTP or HTTPS page, then try again.');
  }
}

async function startSpider() {
  setBusy(true);
  setStatus('Injecting the spider…');
  try {
    const tab = await activeTab();
    validatePage(tab);
    const max = clampInteger(maxInput.value, 1, 500, 200);
    const top = clampInteger(topInput.value, 0, max, Math.min(25, max));
    maxInput.value = String(max);
    topInput.value = String(top);

    await extensionApi.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['engine/spider.js', 'extension/adapters.js'],
    });
    const execution = await extensionApi.scripting.executeScript({
      target: { tabId: tab.id },
      func: startInjected,
      args: [{ max, top, timeout: 120000 }],
    });
    if (!execution[0]?.result) throw new Error('The spider could not start.');
    window.close();
  } catch (error) {
    setStatus(error.message || String(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function stopSpider() {
  setBusy(true);
  try {
    const tab = await activeTab();
    validatePage(tab);
    const execution = await extensionApi.scripting.executeScript({
      target: { tabId: tab.id },
      func: stopInjected,
    });
    const removed = execution[0]?.result;
    setStatus(removed ? 'Spider removed from this page.' : 'No spider is running on this page.', 'success');
  } catch (error) {
    setStatus(error.message || String(error), 'error');
  } finally {
    setBusy(false);
  }
}

maxInput.addEventListener('input', () => {
  const max = clampInteger(maxInput.value, 1, 500, 200);
  topInput.max = String(max);
  if (Number(topInput.value) > max) topInput.value = String(max);
});
startButton.addEventListener('click', startSpider);
stopButton.addEventListener('click', stopSpider);
