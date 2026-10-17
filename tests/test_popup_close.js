const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class FakeElement {
  constructor(value = '') {
    this.value = value;
    this.disabled = false;
    this.dataset = {};
    this.textContent = '';
    this.listeners = {};
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }
}

const elements = {
  '#max-results': new FakeElement('200'),
  '#top-targets': new FakeElement('25'),
  '#start': new FakeElement(),
  '#stop': new FakeElement(),
  '#status': new FakeElement(),
};
const scriptCalls = [];
let closeCalls = 0;

const context = {
  chrome: {
    tabs: {
      async query() {
        return [{ id: 7, url: 'https://example.com' }];
      },
    },
    scripting: {
      async executeScript(options) {
        scriptCalls.push(options);
        return options.files ? [] : [{ result: true }];
      },
    },
  },
  document: {
    querySelector(selector) {
      return elements[selector];
    },
  },
  close() {
    closeCalls += 1;
  },
  console,
};
context.globalThis = context;
context.window = context;

const source = fs.readFileSync('extension/popup.js', 'utf8');
vm.runInNewContext(source, context, { filename: 'extension/popup.js' });

(async () => {
  await elements['#start'].listeners.click();

  assert.equal(scriptCalls.length, 2);
  assert.deepEqual(
    Array.from(scriptCalls[0].files),
    ['engine/spider.js', 'extension/adapters.js'],
  );
  assert.equal(scriptCalls[1].args[0].max, 200);
  assert.equal(scriptCalls[1].args[0].top, 25);
  assert.equal(closeCalls, 1, 'The extension popup should close after Start Spider is dispatched.');
  console.log('Popup closes immediately after the spider command is dispatched.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
