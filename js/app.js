/**
 * MONARCH — App
 * DOM rendering, event handlers, navigation, toasts, dialogs.
 * Depends on: data.js → engine.js → charts.js (loaded before this)
 */
'use strict';

/* ─────────────────────────────────────────────
   FORMATTING HELPERS
   Shared across modules via global scope.
───────────────────────────────────────────── */
window.formatINR = function(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  let str;
  if (abs >= 1_00_00_00_000)       str = (n / 1_00_00_00_000).toFixed(2) + ' Thousand Cr';
  else if (abs >= 1_00_00_000)     str = (n / 1_00_00_000).toFixed(2) + ' Cr';
  else if (abs >= 1_00_000)        str = (n / 1_00_000).toFixed(2) + ' L';
  else                             str = n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return '₹' + str;
};

window.shortINR = function(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000)    return sign + '₹' + (abs / 1_00_00_000).toFixed(2) + ' Cr';
  if (abs >= 1_00_000)       return sign + '₹' + (abs / 1_00_000).toFixed(1) + ' L';
  if (abs >= 1_000)          return sign + '₹' + (abs / 1_000).toFixed(1) + 'k';
  return sign + '₹' + abs.toFixed(0);
};

function fmtDelta(n, goodDirection = 'up') {
  const isGood = goodDirection === 'up' ? n >= 0 : n <= 0;
  const sign   = n >= 0 ? '+' : '';
  return { text: sign + formatINR(n), cls: n === 0 ? 'zero' : isGood ? 'positive' : 'negative' };
}

function fmtPct(n) {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function formatDateTime(isoString) {
  try {
    return new Date(isoString).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return isoString; }
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return isoString; }
}

/* ─────────────────────────────────────────────
   TOASTS
───────────────────────────────────────────── */
const Toasts = (() => {
  let region;

  function init() {
    region = document.getElementById('toast-region');
  }

  function show(title, desc, isError = false, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' toast--error' : '');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <div class="toast__title">${esc(title)}</div>
      ${desc ? `<div class="toast__desc">${esc(desc)}</div>` : ''}
    `;
    region.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--exit');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function success(title, desc) { show(title, desc, false); }
  function error(title, desc)   { show(title, desc, true); }

  return { init, success, error };
})();

/* ─────────────────────────────────────────────
   DIALOG — Reset Confirmation
───────────────────────────────────────────── */
const Dialog = (() => {
  let overlay, onConfirm;

  function init() {
    overlay = document.getElementById('reset-dialog');
    const cancelBtn  = document.getElementById('dialog-cancel');
    const confirmBtn = document.getElementById('dialog-confirm');

    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', () => {
      if (onConfirm) onConfirm();
      close();
    });

    // Close on overlay click (outside dialog box)
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });
  }

  function open(onConfirmCb) {
    onConfirm = onConfirmCb;
    overlay.classList.add('is-open');
    document.getElementById('dialog-confirm').focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.getElementById('dialog-cancel').focus();
  }

  return { init, open, close };
})();

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
const Nav = (() => {
  let currentScreen = 'overview';

  function init() {
    document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTo(btn.dataset.screen);
        // Close mobile sidebar
        document.querySelector('.sidebar')?.classList.remove('is-open');
        document.querySelector('.sidebar-overlay')?.classList.remove('is-open');
      });
    });
  }

  function switchTo(screenId) {
    currentScreen = screenId;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add('is-active');

    document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.screen === screenId);
    });

    // Render the target screen
    App.renderScreen(screenId);
  }

  function current() { return currentScreen; }

  return { init, switchTo, current };
})();

/* ─────────────────────────────────────────────
   ESCAPE helper (prevent XSS in innerHTML)
───────────────────────────────────────────── */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
const App = (() => {
  const GOAL_STORAGE_KEY = 'monarch_v2_wealth_goal';
  let selectedPerformancePeriod = 'ALL';
  let selectedGoalTarget = null;

  function init() {
    // Boot engine
    Engine.init();
    selectedGoalTarget = loadGoalTarget();

    // Apply today's market event (idempotent)
    const eventResult = Engine.applyDailyEvent();

    // Init UI subsystems
    Toasts.init();
    Dialog.init();
    Nav.init();

    document.getElementById('chart-periods')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-period]');
      if (!button) return;
      selectedPerformancePeriod = button.dataset.period;
      renderPerformanceChart();
      document.querySelector(`#chart-periods [data-period="${selectedPerformancePeriod}"]`)?.focus();
    });

    document.getElementById('goal-target')?.addEventListener('change', event => {
      const target = Number(event.target.value);
      if (!DATA.milestones.some(goal => goal.value === target)) return;
      selectedGoalTarget = target;
      if (!saveGoalTarget(target)) {
        Toasts.error('Goal updated for this session', 'Browser storage is unavailable, so this target may not persist.');
      }
      renderWealthGoal();
    });

    // Mobile sidebar toggle
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    menuBtn?.addEventListener('click', () => {
      sidebar.classList.toggle('is-open');
      overlay.classList.toggle('is-open');
    });
    overlay?.addEventListener('click', () => {
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-open');
    });

    // Reset button
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      Dialog.open(() => {
        Engine.reset();
        renderAll();
        Toasts.success('Simulation Reset', 'Starting balance of ₹10 crore restored.');
      });
    });

    // Timestamp
    updateTimestamp();
    setInterval(updateTimestamp, 60_000);

    // Initial render
    renderAll();

    // Show today's event if newly applied
    if (eventResult.applied && eventResult.event) {
      setTimeout(() => {
        const ev = eventResult.event;
        Toasts.success(
          `Market: ${ev.headline}`,
          ev.desc,
          false, 6000
        );
      }, 800);
    }

    // Check milestones
    checkAndShowMilestones();
  }

  /* ─── Master render ─── */
  function renderAll() {
    renderKPIs();
    renderScreen(Nav.current());
    checkAndShowMilestones();
  }

  function renderScreen(id) {
    switch (id) {
      case 'overview':    renderOverview();    break;
      case 'investments': renderInvestments(); break;
      case 'marketplace': renderMarketplace(); break;
      case 'history':     renderHistory();     break;
    }
  }

  /* ─────────────────────────────────────────────
     KPI STRIP — always visible
  ───────────────────────────────────────────── */
  function renderKPIs() {
    const nw       = Engine.getNetWorth();
    const cash     = Engine.getState().cash;
    const invested = Engine.getInvestedValue();
    const pnl      = Engine.getPnL();

    setText('kpi-networth', formatINR(nw));
    setText('kpi-cash',     formatINR(cash));
    setText('kpi-invested', formatINR(invested));

    const pnlEl  = document.getElementById('kpi-pnl');
    const pnlDelta = fmtDelta(pnl, 'up');
    if (pnlEl) {
      pnlEl.textContent = pnl === 0 ? '₹0' : (pnl >= 0 ? '+' : '') + formatINR(pnl);
      pnlEl.className   = `kpi-value kpi-delta--${pnlDelta.cls}`;
    }
  }

  /* ─────────────────────────────────────────────
     OVERVIEW SCREEN
  ───────────────────────────────────────────── */
  function renderOverview() {
    renderPortfolioRing();
    renderPerformanceChart();
    renderAssetPanel();
    renderRecentTransactions();
    renderWealthGoal();
    renderEventCard();
  }

  function renderPortfolioRing() {
    const byCategory = Engine.getPortfolioByCategory();
    const rawSegments = Object.entries(byCategory)
      .map(([id, c]) => ({ label: c.name, value: c.value }))
      .filter(s => s.value > 0);
    const cash = Engine.getState().cash;
    rawSegments.push({ label: 'Available Cash', value: cash });
    const segments = Charts.normalizeAllocation(rawSegments);

    // Draw ring
    const ringEl = document.getElementById('ring-svg');
    if (ringEl) {
      Charts.ring(ringEl, segments);
    }

    // Centre value
    setText('ring-centre-value', shortINR(Engine.getNetWorth()));

    // Legend
    const legendEl = document.getElementById('ring-legend');
    if (!legendEl) return;

    if (segments.length === 0) {
      legendEl.innerHTML = `<div class="ring-legend__item" style="color:var(--muted);font-size:13px">No cash or investments are recorded.</div>`;
      return;
    }

    legendEl.innerHTML = segments.map(seg => `
      <div class="ring-legend__item" role="listitem">
        <span class="ring-legend__swatch" style="background:${seg.colour}"></span>
        <span class="ring-legend__name">${esc(seg.label)}</span>
        <span class="ring-legend__amount">${shortINR(seg.value)}</span>
        <span class="ring-legend__pct">${seg.percentage.toFixed(1)}%</span>
      </div>
    `).join('');
  }

  function renderPerformanceChart() {
    const chartEl = document.getElementById('perf-chart');
    if (!chartEl) return;
    try {
      const state = Engine.getState();
      const history = state && state.netWorthHistory;
      const periods = Charts.availablePeriods(history);
      if (!periods.some(period => period.id === selectedPerformancePeriod)) {
        selectedPerformancePeriod = periods[0]?.id || 'ALL';
      }
      const controls = document.getElementById('chart-periods');
      if (controls) {
        controls.innerHTML = periods.map(period => `
          <button type="button" class="chart-period${period.id === selectedPerformancePeriod ? ' is-active' : ''}"
                  data-period="${period.id}" aria-pressed="${period.id === selectedPerformancePeriod}">${period.label}</button>
        `).join('');
      }
      const points = Charts.historyForPeriod(history, selectedPerformancePeriod);
      const meta = document.getElementById('chart-meta');
      if (meta) meta.textContent = performanceSummary(points, selectedPerformancePeriod);
      // Use actual rendered width; fall back to 760 if not yet laid out.
      const w = chartEl.clientWidth > 100 ? chartEl.clientWidth : 760;
      Charts.line(chartEl, points, {
        height: 200,
        width: w,
        label: `Simulated net worth history, ${selectedPerformancePeriod === 'ALL' ? 'all recorded history' : selectedPerformancePeriod}`,
      });
    } catch (error) {
      console.error('Unable to render performance chart:', error);
      chartEl.innerHTML = '<div class="chart-empty-state">Performance history is temporarily unavailable.</div>';
    }
  }

  function performanceSummary(points, periodId) {
    if (!points || points.length < 2) return 'More saved history is needed before these periods are available.';
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const delta = last - first;
    const movement = delta === 0
      ? 'No net change'
      : `${delta > 0 ? 'Up' : 'Down'} ${formatINR(Math.abs(delta))}`;
    const label = periodId === 'ALL' ? 'All recorded history' : `Past ${periodId}`;
    return `${label} · ${points.length} saved observations · ${movement}`;
  }

  function renderRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    const transactions = Engine.getState().transactions.slice(0, 4);
    if (!transactions.length) {
      container.innerHTML = `
        <div class="activity-empty">
          <p>No transactions yet. Trades and acquisitions will appear here.</p>
          <button type="button" class="btn btn--ghost btn--sm" onclick="App._goToInvest('stocks')">Explore investments</button>
        </div>`;
      return;
    }

    container.innerHTML = transactions.map(tx => {
      const type = tx.type === 'sell' ? 'Sold' : tx.type === 'buy-luxury' ? 'Acquired' : 'Bought';
      const amountSign = tx.type === 'sell' ? '+' : '-';
      const detail = tx.type === 'buy-luxury'
        ? `Luxury purchase · ${formatDate(tx.date)}`
        : `${tx.qty} unit${tx.qty === 1 ? '' : 's'} · ${formatDate(tx.date)}`;
      return `
        <div class="activity-row" role="listitem">
          <div class="activity-row__main">
            <span class="activity-row__name">${esc(tx.itemName)}</span>
            <span class="activity-row__detail">${type} - ${detail}</span>
          </div>
          <span class="activity-row__amount activity-row__amount--${tx.type}">${amountSign}${formatINR(tx.total)}</span>
        </div>`;
    }).join('');
  }

  function loadGoalTarget() {
    const fallback = DATA.milestones.find(goal => goal.value > Engine.getNetWorth())?.value ||
      DATA.milestones[DATA.milestones.length - 1]?.value;
    try {
      const saved = localStorage.getItem(GOAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Number.isSafeInteger(parsed.target) &&
            DATA.milestones.some(goal => goal.value === parsed.target)) return parsed.target;
        console.warn('MONARCH: saved wealth goal is invalid; using the next milestone.');
      }
    } catch (error) {
      console.warn('MONARCH: wealth goal could not be loaded; using the next milestone.', error);
    }
    return fallback;
  }

  function saveGoalTarget(target) {
    try {
      localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify({ target }));
      return true;
    } catch (error) {
      console.warn('MONARCH: wealth goal could not be saved.', error);
      return false;
    }
  }

  function calculateGoalProgress(netWorth, target) {
    const current = Number.isFinite(netWorth) && netWorth > 0 ? netWorth : 0;
    const validTarget = Number.isFinite(target) && target > 0 ? target : 1;
    const ratio = current / validTarget;
    return {
      percent: Math.min(100, Math.max(0, ratio * 100)),
      reached: current >= validTarget,
      remaining: Math.max(0, validTarget - current),
    };
  }

  function renderWealthGoal() {
    const select = document.getElementById('goal-target');
    const progress = document.getElementById('goal-progress');
    const fill = document.getElementById('goal-progress-fill');
    if (!select || !progress || !fill) return;
    if (!DATA.milestones.some(goal => goal.value === selectedGoalTarget)) {
      selectedGoalTarget = loadGoalTarget();
    }
    if (select.options.length === 0) {
      select.innerHTML = DATA.milestones.map(goal =>
        `<option value="${goal.value}">${esc(goal.label)}</option>`).join('');
    }
    select.value = String(selectedGoalTarget);

    const current = Engine.getNetWorth();
    const goal = DATA.milestones.find(option => option.value === selectedGoalTarget);
    const result = calculateGoalProgress(current, selectedGoalTarget);
    const label = document.getElementById('goal-progress-label');
    const currentEl = document.getElementById('goal-current');
    const remainingLabel = document.getElementById('goal-remaining-label');
    const remainingEl = document.getElementById('goal-remaining');
    if (label) label.textContent = result.reached
      ? `${goal.label} target reached`
      : `${result.percent.toFixed(1)}% of the ${goal.label} target reached`;
    if (currentEl) currentEl.textContent = formatINR(current);
    if (remainingLabel) remainingLabel.textContent = result.reached ? 'Goal status' : 'Remaining';
    if (remainingEl) remainingEl.textContent = result.reached ? 'Target reached' : formatINR(result.remaining);
    progress.setAttribute('aria-valuenow', result.percent.toFixed(1));
    progress.setAttribute('aria-valuetext', result.reached
      ? 'Wealth goal reached'
      : `${result.percent.toFixed(1)} percent of goal reached`);
    fill.style.width = `${result.percent}%`;
  }

  function renderAssetPanel() {
    const tbody = document.getElementById('asset-rows');
    if (!tbody) return;
    const state = Engine.getState();

    tbody.innerHTML = DATA.investments.map(cat => {
      const value = Engine.getCategoryValue(cat.id);
      const cost  = Engine.getCategoryCost(cat.id);
      const pnl   = value - cost;
      const pct   = cost > 0 ? (pnl / cost * 100) : 0;

      // Count held items
      const heldItems = cat.items.filter(item => {
        const h = state.holdings[item.id];
        return h && h.qty > 0;
      });

      return `
        <div class="asset-row">
          <div class="asset-row__name">
            ${esc(cat.name)}
            <span class="asset-row__sub">${heldItems.length} position${heldItems.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="asset-row__value">${value > 0 ? formatINR(value) : '—'}</div>
          <div class="asset-row__value" style="color:var(--muted)">${cost > 0 ? formatINR(cost) : '—'}</div>
          <div class="asset-row__delta asset-row__delta--${pnl >= 0 ? 'positive' : 'negative'}">
            ${cost > 0 ? (pnl >= 0 ? '+' : '') + formatINR(pnl) : '—'}
          </div>
          <div class="asset-row__action">
            <button class="btn btn--ghost btn--sm" onclick="App._goToInvest('${cat.id}')">View</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEventCard() {
    const el = document.getElementById('today-event');
    if (!el) return;
    const log = Engine.getState().eventLog;
    if (!log || log.length === 0) {
      el.innerHTML = `<div class="event-card">
        <div class="event-card__label">Simulated scenario</div>
        <div class="event-card__headline">No events today</div>
        <div class="event-card__desc">A simulated market scenario will appear here when recorded.</div></div>`;
      return;
    }

    const ev = log[0];
    el.innerHTML = `
      <div class="event-card ${ev.sign === 'negative' ? 'event-card--negative' : ''}">
        <div class="event-card__label">Simulated market scenario · not live market data</div>
        <div class="event-card__date">${formatDate(ev.date)}</div>
        <div class="event-card__headline">${esc(ev.headline)}</div>
        <div class="event-card__desc">${esc(ev.desc)}</div>
        <div class="event-card__impact event-card__impact--${ev.sign === 'positive' ? 'positive' : 'negative'}">
          ${Object.entries(ev.impacts).map(([k, v]) => {
            const cat = DATA.investments.find(c => c.id === k);
            return `${cat ? cat.name : k}: ${v >= 0 ? '+' : ''}${v}%`;
          }).join(' · ')}
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     INVESTMENTS SCREEN
  ───────────────────────────────────────────── */
  function renderInvestments() {
    const container = document.getElementById('invest-cards');
    if (!container) return;
    const state = Engine.getState();

    container.innerHTML = DATA.investments.map(cat => `
      <div class="section" id="invest-section-${cat.id}">
        <div class="section-head">
          <h2 class="section-title">${esc(cat.name)}</h2>
          <span class="section-action" style="color:var(--muted);font-size:13px">${esc(cat.category)}</span>
        </div>
        <div class="invest-grid">
          ${cat.items.map(item => renderInvestCard(item, cat, state)).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderInvestCard(item, cat, state) {
    const currentPrice = state.prices[item.id];
    const origPrice    = item.price; // from DATA (base price before events)
    const priceChange  = ((currentPrice - origPrice) / origPrice) * 100;
    const holding      = state.holdings[item.id];
    const hasHolding   = holding && holding.qty > 0;
    const heldValue    = hasHolding ? holding.qty * currentPrice : 0;
    const pnl          = hasHolding ? heldValue - (holding.qty * holding.avgPrice) : 0;

    return `
      <div class="invest-card" id="card-${item.id}">
        <div class="invest-card__name">${esc(item.name)}</div>
        <div>
          <div class="invest-card__price">${formatINR(currentPrice)}</div>
          <div class="invest-card__sub">per ${cat.unit}</div>
        </div>
        <div class="invest-card__change invest-card__change--${priceChange >= 0 ? 'positive' : 'negative'}">
          ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}% since start
        </div>

        ${hasHolding ? `
          <div>
            <div class="holding-row">
              <span class="holding-row__label">Held</span>
              <span class="holding-row__value">${holding.qty} unit${holding.qty !== 1 ? 's' : ''}</span>
            </div>
            <div class="holding-row">
              <span class="holding-row__label">Value</span>
              <span class="holding-row__value">${formatINR(heldValue)}</span>
            </div>
            <div class="holding-row">
              <span class="holding-row__label">P&amp;L</span>
              <span class="holding-row__value" style="color:${pnl >= 0 ? 'var(--muted)' : 'var(--negative)'}">
                ${pnl >= 0 ? '+' : ''}${formatINR(pnl)}
              </span>
            </div>
          </div>
        ` : ''}

        <div class="invest-card__controls">
          <input
            type="number"
            class="qty-input"
            id="qty-buy-${item.id}"
            value="1"
            min="1"
            aria-label="Quantity to buy"
          />
          <button
            class="btn btn--primary"
            onclick="App._buyItem('${item.id}')"
            aria-label="Buy ${item.name}"
          >Buy</button>
          ${hasHolding ? `
            <button
              class="btn btn--sell"
              onclick="App._showSellPanel('${item.id}')"
              aria-label="Sell ${item.name}"
            >Sell</button>
          ` : ''}
        </div>

        ${hasHolding ? `
          <div class="sell-controls" id="sell-panel-${item.id}" style="display:none">
            <input
              type="number"
              class="qty-input"
              id="qty-sell-${item.id}"
              value="1"
              min="1"
              max="${holding.qty}"
              aria-label="Quantity to sell"
            />
            <button
              class="btn btn--danger"
              onclick="App._sellItem('${item.id}')"
              aria-label="Confirm sell ${item.name}"
            >Confirm Sell</button>
            <button
              class="btn btn--ghost"
              onclick="App._hideSellPanel('${item.id}')"
              aria-label="Cancel sell"
            >Cancel</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     MARKETPLACE SCREEN
  ───────────────────────────────────────────── */
  function renderMarketplace() {
    const container = document.getElementById('market-cards');
    if (!container) return;
    const state = Engine.getState();

    // Group by category
    const groups = {};
    DATA.luxuryItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });

    container.innerHTML = Object.entries(groups).map(([category, items]) => `
      <div class="section">
        <div class="section-head">
          <h2 class="section-title">${esc(category)}</h2>
        </div>
        <div class="market-grid">
          ${items.map(item => {
            const owned   = state.ownedLuxury.includes(item.id);
            const canAfford = item.price <= state.cash && !owned;
            return `
              <div class="market-card">
                <div class="market-card__category">${esc(item.category)}</div>
                <div class="market-card__name">${esc(item.name)}</div>
                <div class="market-card__price">${formatINR(item.price)}</div>
                <div class="market-card__desc">${esc(item.desc)}</div>
                <div class="market-card__footer">
                  ${owned
                    ? `<span class="badge-owned">Owned</span>`
                    : `<button
                        class="btn btn--${canAfford ? 'primary' : 'ghost'}"
                        onclick="App._buyLuxury('${item.id}')"
                        ${!canAfford ? 'disabled' : ''}
                        aria-label="Purchase ${item.name} for ${formatINR(item.price)}"
                       >${canAfford ? 'Purchase' : 'Insufficient Cash'}</button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  /* ─────────────────────────────────────────────
     HISTORY SCREEN
  ───────────────────────────────────────────── */
  function renderHistory() {
    renderTransactionHistory();
    renderEventHistory();
  }

  function renderTransactionHistory() {
    const el = document.getElementById('tx-rows');
    if (!el) return;
    const txs = Engine.getState().transactions;

    if (txs.length === 0) {
      el.innerHTML = `<div class="empty-state">No transactions yet.</div>`;
      return;
    }

    el.innerHTML = txs.map(tx => `
      <div class="tx-row">
        <div>
          <div class="tx-row__asset">${esc(tx.itemName)}</div>
          <span class="tx-row__type">${tx.type === 'buy' ? 'Buy' : tx.type === 'sell' ? 'Sell' : 'Purchase'} · ${tx.qty} unit${tx.qty !== 1 ? 's' : ''} @ ${formatINR(tx.price)}</span>
        </div>
        <div class="tx-row__date">${formatDate(tx.date)}</div>
        <div class="tx-row__amount tx-row__amount--${tx.type}">
          ${tx.type === 'sell' ? '+' : '-'}${formatINR(tx.total)}
        </div>
        <div class="tx-row__status">${tx.type === 'sell' ? 'Sold' : tx.type === 'buy-luxury' ? 'Acquired' : 'Bought'}</div>
      </div>
    `).join('');
  }

  function renderEventHistory() {
    const el = document.getElementById('event-history-rows');
    if (!el) return;
    const log = Engine.getState().eventLog;

    if (log.length === 0) {
      el.innerHTML = `<div class="empty-state">No market events recorded.</div>`;
      return;
    }

    el.innerHTML = log.map(ev => `
      <div class="event-history-row">
        <div>
          <div class="event-history__title">${esc(ev.headline)}</div>
          <div class="event-history__desc">${esc(ev.desc)}</div>
        </div>
        <div>
          <div class="event-history__impact event-history__impact--${ev.sign === 'positive' ? '' : 'negative'}"
               style="color:${ev.sign === 'positive' ? 'var(--muted)' : 'var(--negative)'}">
            ${Object.values(ev.impacts).map(v => (v >= 0 ? '+' : '') + v + '%').join(' / ')}
          </div>
          <div style="font-size:11px;color:var(--muted);text-align:right;margin-top:2px">${formatDate(ev.date)}</div>
        </div>
      </div>
    `).join('');
  }

  /* ─────────────────────────────────────────────
     ACTION HANDLERS (called from inline onclick)
  ───────────────────────────────────────────── */
  function _buyItem(itemId) {
    const qtyEl = document.getElementById(`qty-buy-${itemId}`);
    const qty   = qtyEl?.value ?? '';
    const result = Engine.buyInvestment(itemId, qty);

    if (result.ok) {
      Toasts.success('Purchase Complete', result.message);
      renderAll();
    } else {
      Toasts.error('Cannot Purchase', result.error);
    }
  }

  function _showSellPanel(itemId) {
    const panel = document.getElementById(`sell-panel-${itemId}`);
    if (panel) panel.style.display = 'flex';
  }

  function _hideSellPanel(itemId) {
    const panel = document.getElementById(`sell-panel-${itemId}`);
    if (panel) panel.style.display = 'none';
  }

  function _sellItem(itemId) {
    const qtyEl = document.getElementById(`qty-sell-${itemId}`);
    const qty   = qtyEl?.value ?? '';
    const result = Engine.sellInvestment(itemId, qty);

    if (result.ok) {
      Toasts.success('Sale Complete', result.message);
      renderAll();
    } else {
      Toasts.error('Cannot Sell', result.error);
    }
  }

  function _buyLuxury(itemId) {
    const result = Engine.buyLuxury(itemId);
    if (result.ok) {
      Toasts.success('Acquisition Complete', result.message);
      renderAll();
    } else {
      Toasts.error('Cannot Acquire', result.error);
    }
  }

  function _goToInvest(categoryId) {
    Nav.switchTo('investments');
    setTimeout(() => {
      const section = document.getElementById(`invest-section-${categoryId}`);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function _goToHistory() {
    Nav.switchTo('history');
  }

  /* ─────────────────────────────────────────────
     MILESTONES
  ───────────────────────────────────────────── */
  function checkAndShowMilestones() {
    const triggered = Engine.checkMilestones();
    triggered.forEach(m => {
      Toasts.success(`Milestone: ${m.label}`, m.message, false, 8000);
    });
  }

  /* ─────────────────────────────────────────────
     TIMESTAMP
  ───────────────────────────────────────────── */
  function updateTimestamp() {
    const el = document.getElementById('timestamp');
    if (!el) return;
    el.textContent = `Simulated as of ${new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })}`;
  }

  /* ─────────────────────────────────────────────
     DOM HELPERS
  ───────────────────────────────────────────── */
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* Public API */
  return {
    init,
    renderAll,
    renderScreen,
    _buyItem,
    _showSellPanel,
    _hideSellPanel,
    _sellItem,
    _buyLuxury,
    _goToInvest,
    _goToHistory,
    refreshPerformanceChart: renderPerformanceChart,
    _calculateGoalProgress: calculateGoalProgress,
  };

})();

/* ─────────────────────────────────────────────
   BOOT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Redraw chart on resize (responsive SVG)
  let _resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (Nav.current() === 'overview') {
        App.refreshPerformanceChart();
      }
    }, 120);
  });
});
