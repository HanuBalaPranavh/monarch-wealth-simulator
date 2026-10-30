'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stored = new Map();
const elements = new Map();

class MockElement {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.className = '';
    this.value = '';
    this.textContent = '';
    this.clientWidth = 720;
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false,
    };
    this.options = { length: 0 };
    this._innerHTML = '';
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    if (this.id === 'goal-target') {
      this.options.length = (String(value).match(/<option\b/g) || []).length;
    }
  }

  get innerHTML() { return this._innerHTML; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  focus() { this.focused = true; }
  remove() {}
}

function element(id) {
  if (!elements.has(id)) elements.set(id, new MockElement(id));
  return elements.get(id);
}

const document = {
  addEventListener() {},
  getElementById: element,
  querySelectorAll: () => [],
  querySelector(selector) {
    if (selector.startsWith('#chart-periods')) return new MockElement('period-focus');
    return element(selector);
  },
  createElementNS: () => new MockElement('svg-node'),
};

const sandbox = {
  console,
  document,
  localStorage: {
    getItem: key => stored.has(key) ? stored.get(key) : null,
    setItem: (key, value) => stored.set(key, String(value)),
  },
  setTimeout: () => 0,
  setInterval: () => 0,
  clearTimeout: () => {},
  Math: Object.create(Math),
};
sandbox.window = sandbox;
vm.createContext(sandbox);

for (const file of ['js/data.js', 'js/engine.js', 'js/charts.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
vm.runInContext('globalThis.__charts = Charts; globalThis.__engine = Engine;', sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8') + '\nglobalThis.__app = App;', sandbox, {
  filename: 'js/app.js',
});

const app = sandbox.__app;
const charts = sandbox.__charts;

assert.deepEqual(Array.from(charts.availablePeriods([])), []);
const tenDays = Array.from({ length: 10 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
  value: 100_000_000 + index * 100_000,
}));
const supported = Array.from(charts.availablePeriods(tenDays), period => period.id);
assert.deepEqual(supported, ['ALL', '1W']);
assert.equal(charts.historyForPeriod(tenDays, '1W').length, 7);
assert.equal(charts.historyForPeriod(tenDays, '1M').length, 0);

const fullYear = Array.from({ length: 365 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10),
  value: 100_000_000 + index,
}));
assert.deepEqual(Array.from(charts.availablePeriods(fullYear), period => period.id),
  ['ALL', '1W', '1M', '3M', '6M', '1Y']);

const partialProgress = app._calculateGoalProgress(100_000_000, 150_000_000);
assert.equal(partialProgress.percent, 100_000_000 / 150_000_000 * 100);
assert.equal(partialProgress.remaining, 50_000_000);
assert.equal(partialProgress.reached, false);
const reachedProgress = app._calculateGoalProgress(200_000_000, 150_000_000);
assert.equal(reachedProgress.percent, 100);
assert.equal(reachedProgress.remaining, 0);
assert.equal(reachedProgress.reached, true);

app.init();
assert.match(element('chart-periods').innerHTML, /data-period="ALL"/);
assert.doesNotMatch(element('chart-periods').innerHTML, /data-period="1W"/);
assert.match(element('recent-transactions').innerHTML, /No transactions yet/);
assert.match(element('today-event').innerHTML, /Simulated market scenario/);

const state = sandbox.__engine.getState();
state.netWorthHistory = tenDays;
app.refreshPerformanceChart();
assert.match(element('chart-periods').innerHTML, /data-period="1W"/);
assert.doesNotMatch(element('chart-periods').innerHTML, /data-period="1M"/);
const linePath = () => element('perf-chart').children[0].children
  .find(node => node.attributes.d && node.attributes.fill === 'none')?.attributes.d || '';
assert.equal((linePath().match(/[ML]/g) || []).length, 10);

element('chart-periods').listeners.click({
  target: { closest: () => ({ dataset: { period: '1W' } }) },
});
assert.equal((linePath().match(/[ML]/g) || []).length, 7);

element('goal-target').listeners.change({ target: { value: '250000000' } });
assert.equal(JSON.parse(stored.get('monarch_v2_wealth_goal')).target, 250_000_000);
assert.equal(element('goal-progress').getAttribute('aria-valuenow'), '40.0');
assert.match(element('goal-progress-label').textContent, /40\.0%/);
app.init();
assert.equal(element('goal-target').value, '250000000');

assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /id="recent-transactions"/);
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /id="goal-target"/);
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /does not show live market quotes/);

console.log('Overview period, goal progress and persistence, and rendered interaction checks passed.');
