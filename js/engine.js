/**
 * MONARCH — Game Engine
 * Handles: state management, transactions, market events, localStorage persistence.
 *
 * State shape:
 * {
 *   cash:         number,       // available cash in rupees
 *   holdings:     { [itemId]: { qty: number, avgPrice: number } },
 *   ownedLuxury:  string[],     // item IDs
 *   prices:       { [itemId]: number },   // current prices (modified by events)
 *   transactions: Transaction[],
 *   eventLog:     EventEntry[],
 *   lastEventDate: string,      // ISO date string 'YYYY-MM-DD'
 *   achievedMilestones: string[], // milestone value keys already shown
 *   netWorthHistory:  { date: string, value: number }[],
 * }
 */
'use strict';

const STORAGE_KEY = 'monarch_v2_state';

const Engine = (() => {

  /* ── Internal state ── */
  let _state = null;

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  function init() {
    let saved;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn('MONARCH: localStorage is unavailable; this session will not persist.', e);
      return reset(false);
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validated = _validateState(parsed);
        if (validated) {
          _state = validated;
          // Persist additions such as lastEventId when opening an older valid save.
          _save();
          return _state;
        }
        console.warn('MONARCH: saved state failed validation; starting a new simulation.');
      } catch (e) {
        console.warn('MONARCH: failed to load saved state; starting a new simulation.', e);
      }
    }
    return reset();
  }

  function _validateState(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) || saved.version !== DATA.version) return null;

    const itemIds = DATA.investments.flatMap(cat => cat.items.map(item => item.id));
    const itemIdSet = new Set(itemIds);
    const luxuryById = new Map(DATA.luxuryItems.map(item => [item.id, item]));
    const eventById = new Map(DATA.marketEvents.map(event => [event.id, event]));
    const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    const finitePositive = value => Number.isFinite(value) && value > 0;
    const finiteNonNegative = value => Number.isFinite(value) && value >= 0;

    if (!Number.isSafeInteger(saved.cash) || !finiteNonNegative(saved.cash)) return null;
    if (!saved.holdings || typeof saved.holdings !== 'object' || Array.isArray(saved.holdings)) return null;
    if (!saved.prices || typeof saved.prices !== 'object' || Array.isArray(saved.prices)) return null;
    if (!Array.isArray(saved.ownedLuxury) || !Array.isArray(saved.transactions) ||
        !Array.isArray(saved.eventLog) || !Array.isArray(saved.achievedMilestones) ||
        !Array.isArray(saved.netWorthHistory)) return null;

    if (Object.keys(saved.prices).length !== itemIds.length ||
        itemIds.some(id => !Number.isSafeInteger(saved.prices[id]) || !finitePositive(saved.prices[id]))) return null;
    if (Object.keys(saved.holdings).some(id => !itemIdSet.has(id))) return null;
    for (const [id, holding] of Object.entries(saved.holdings)) {
      if (!holding || typeof holding !== 'object' || !Number.isSafeInteger(holding.qty) || holding.qty < 0 ||
          (holding.qty === 0 ? holding.avgPrice !== 0 : !finitePositive(holding.avgPrice)) ||
          !Number.isFinite(holding.qty * holding.avgPrice) ||
          !Number.isSafeInteger(Math.round(holding.qty * holding.avgPrice))) return null;
    }
    const currentAssetValue = Object.entries(saved.holdings).reduce((total, [id, holding]) =>
      total + holding.qty * saved.prices[id], 0);
    if (!Number.isSafeInteger(Math.round(currentAssetValue)) ||
        !Number.isSafeInteger(Math.round(saved.cash + currentAssetValue))) return null;

    if (new Set(saved.ownedLuxury).size !== saved.ownedLuxury.length ||
        saved.ownedLuxury.some(id => !luxuryById.has(id))) return null;

    const validTransaction = tx => {
      if (!tx || typeof tx !== 'object' || !['buy', 'sell', 'buy-luxury'].includes(tx.type) ||
          !Number.isSafeInteger(tx.qty) || tx.qty <= 0 || !Number.isSafeInteger(tx.price) || !finitePositive(tx.price) ||
          !Number.isSafeInteger(tx.total) || !finitePositive(tx.total) || typeof tx.date !== 'string' ||
          Number.isNaN(Date.parse(tx.date))) return false;
      if (Math.abs(tx.total - tx.price * tx.qty) > Math.max(0.01, tx.total * 1e-10)) return false;
      if (tx.type === 'buy-luxury') {
        const item = luxuryById.get(tx.itemId);
        return !!item && tx.qty === 1 && tx.price === item.price;
      }
      return itemIdSet.has(tx.itemId);
    };
    if (!saved.transactions.every(validTransaction)) return null;

    // Rebuild the transaction ledger so edited saves cannot invent cash, holdings or purchases.
    let ledgerCash = DATA.STARTING_CASH;
    const ledgerHoldings = {};
    const ledgerLuxury = new Set();
    for (const tx of [...saved.transactions].reverse()) {
      if (tx.type === 'buy') {
        if (tx.total > ledgerCash) return null;
        ledgerCash -= tx.total;
        const holding = ledgerHoldings[tx.itemId] || { qty: 0, avgPrice: 0 };
        const nextQty = holding.qty + tx.qty;
        if (!Number.isSafeInteger(nextQty)) return null;
        holding.avgPrice = (holding.qty * holding.avgPrice + tx.total) / nextQty;
        holding.qty = nextQty;
        ledgerHoldings[tx.itemId] = holding;
      } else if (tx.type === 'sell') {
        const holding = ledgerHoldings[tx.itemId];
        if (!holding || tx.qty > holding.qty || !Number.isSafeInteger(ledgerCash + tx.total)) return null;
        ledgerCash += tx.total;
        holding.qty -= tx.qty;
        if (holding.qty === 0) holding.avgPrice = 0;
      } else {
        if (ledgerLuxury.has(tx.itemId) || tx.total > ledgerCash) return null;
        ledgerCash -= tx.total;
        ledgerLuxury.add(tx.itemId);
      }
    }
    if (ledgerCash !== saved.cash || ledgerLuxury.size !== saved.ownedLuxury.length ||
        saved.ownedLuxury.some(id => !ledgerLuxury.has(id))) return null;
    for (const id of new Set([...Object.keys(ledgerHoldings), ...Object.keys(saved.holdings)])) {
      const actual = saved.holdings[id];
      const expected = ledgerHoldings[id];
      if (!actual || !expected || actual.qty !== expected.qty ||
          Math.abs(actual.avgPrice - expected.avgPrice) > Math.max(0.01, expected.avgPrice * 1e-10)) return null;
    }

    if (saved.eventLog.some(entry => {
      if (!entry || !isDate(entry.date)) return true;
      const source = eventById.get(entry.id);
      if (!source || entry.headline !== source.headline || entry.desc !== source.desc || entry.sign !== source.sign ||
          !entry.impacts || typeof entry.impacts !== 'object' || Array.isArray(entry.impacts)) return true;
      const keys = Object.keys(source.impacts);
      return Object.keys(entry.impacts).length !== keys.length || keys.some(key => entry.impacts[key] !== source.impacts[key]);
    })) return null;
    if (saved.lastEventDate !== null && !isDate(saved.lastEventDate)) return null;
    if (saved.lastEventId !== undefined && saved.lastEventId !== null && !eventById.has(saved.lastEventId)) return null;
    if (!saved.lastEventDate && saved.lastEventId) return null;
    if (saved.lastEventDate && saved.eventLog.length && saved.eventLog[0].date === saved.lastEventDate &&
        saved.lastEventId && saved.eventLog[0].id !== saved.lastEventId) return null;

    if (saved.achievedMilestones.some(key => !DATA.milestones.some(m => String(m.value) === key))) return null;
    let previousDate = '';
    for (const point of saved.netWorthHistory) {
      if (!point || !isDate(point.date) || !Number.isSafeInteger(point.value) ||
          !finiteNonNegative(point.value) || point.date < previousDate) return null;
      previousDate = point.date;
    }

    // Version 2 saves predate lastEventId. Infer it from the matching history entry.
    const matchingEvent = saved.lastEventDate && saved.eventLog.find(entry =>
      entry.date === saved.lastEventDate && (!saved.lastEventId || entry.id === saved.lastEventId));
    if (saved.lastEventDate && !matchingEvent) return null;
    const inferredEventId = saved.lastEventId || matchingEvent?.id || null;
    return { ...saved, lastEventId: inferredEventId };
  }

  /* ─────────────────────────────────────────────
     RESET
  ───────────────────────────────────────────── */
  function reset(persist = true) {
    // Build initial price map from DATA
    const prices = {};
    DATA.investments.forEach(cat => {
      cat.items.forEach(item => { prices[item.id] = item.price; });
    });

    _state = {
      version:            DATA.version,
      cash:               DATA.STARTING_CASH,
      holdings:           {},
      ownedLuxury:        [],
      prices,
      transactions:       [],
      eventLog:           [],
      lastEventDate:      null,
      lastEventId:        null,
      achievedMilestones: [],
      // Seed 2 starting history points so the line chart renders on day 1
      netWorthHistory: [
        { date: offsetDate(todayISO(), -1), value: DATA.STARTING_CASH },
        { date: todayISO(),                 value: DATA.STARTING_CASH },
      ],
    };

    if (persist) _save();
    return _state;
  }

  /* ─────────────────────────────────────────────
     PERSISTENCE
  ───────────────────────────────────────────── */
  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('MONARCH: localStorage write failed.', e);
    }
  }

  /* ─────────────────────────────────────────────
     DERIVED VALUES
  ───────────────────────────────────────────── */
  function getState() { return _state; }

  function getNetWorth() {
    let invested = 0;
    Object.entries(_state.holdings).forEach(([id, h]) => {
      if (h.qty > 0) {
        invested += h.qty * (_state.prices[id] || 0);
      }
    });
    return _state.cash + invested;
  }

  function getInvestedValue() {
    let total = 0;
    Object.entries(_state.holdings).forEach(([id, h]) => {
      if (h.qty > 0) total += h.qty * (_state.prices[id] || 0);
    });
    return total;
  }

  function getPnL() {
    let totalCost = 0;
    let totalValue = 0;
    Object.entries(_state.holdings).forEach(([id, h]) => {
      if (h.qty > 0) {
        totalCost  += h.qty * h.avgPrice;
        totalValue += h.qty * (_state.prices[id] || 0);
      }
    });
    return totalValue - totalCost;
  }

  function getPortfolioByCategory() {
    const result = {};
    DATA.investments.forEach(cat => {
      let value = 0;
      cat.items.forEach(item => {
        const h = _state.holdings[item.id];
        if (h && h.qty > 0) {
          value += h.qty * (_state.prices[item.id] || 0);
        }
      });
      result[cat.id] = { name: cat.name, value };
    });
    return result;
  }

  function getCategoryValue(categoryId) {
    const cat = DATA.investments.find(c => c.id === categoryId);
    if (!cat) return 0;
    let value = 0;
    cat.items.forEach(item => {
      const h = _state.holdings[item.id];
      if (h && h.qty > 0) {
        value += h.qty * (_state.prices[item.id] || 0);
      }
    });
    return value;
  }

  function getCategoryCost(categoryId) {
    const cat = DATA.investments.find(c => c.id === categoryId);
    if (!cat) return 0;
    let cost = 0;
    cat.items.forEach(item => {
      const h = _state.holdings[item.id];
      if (h && h.qty > 0) {
        cost += h.qty * h.avgPrice;
      }
    });
    return cost;
  }

  /* ─────────────────────────────────────────────
     BUY INVESTMENT
  ───────────────────────────────────────────── */
  function buyInvestment(itemId, qty) {
    qty = _parseQuantity(qty);
    if (qty === null) {
      return { ok: false, error: 'Enter a valid quantity.' };
    }

    const price = _state.prices[itemId];
    if (!finiteMoney(price)) return { ok: false, error: 'Asset not found or its price is invalid.' };

    const total = price * qty;
    if (!Number.isSafeInteger(total) || total <= 0) {
      return { ok: false, error: 'This purchase amount is outside the supported range.' };
    }
    if (total > _state.cash) {
      return {
        ok: false,
        error: `Insufficient cash. Need ${fmt(total)}, have ${fmt(_state.cash)}.`
      };
    }

    // Update holding (weighted average cost)
    if (!_state.holdings[itemId]) {
      _state.holdings[itemId] = { qty: 0, avgPrice: 0 };
    }
    const h = _state.holdings[itemId];
    if (h && !Number.isSafeInteger(h.qty + qty)) {
      return { ok: false, error: 'This holding would exceed the supported quantity.' };
    }
    const prevCost = h.qty * h.avgPrice;
    h.qty     += qty;
    h.avgPrice = (prevCost + total) / h.qty;

    _state.cash -= total;

    _state.transactions.unshift({
      id:       crypto.randomUUID?.() || `tx_${Date.now()}`,
      type:     'buy',
      itemId,
      itemName: _findItemName(itemId),
      qty,
      price,
      total,
      date:     nowISO(),
    });

    _updateHistory();
    _save();

    return { ok: true, message: `Bought ${qty} × ${_findItemName(itemId)} for ${fmt(total)}.` };
  }

  /* ─────────────────────────────────────────────
     SELL INVESTMENT
  ───────────────────────────────────────────── */
  function sellInvestment(itemId, qty) {
    qty = _parseQuantity(qty);
    if (qty === null) {
      return { ok: false, error: 'Enter a valid quantity.' };
    }

    const h = _state.holdings[itemId];
    if (!h || h.qty === 0) {
      return { ok: false, error: 'You do not hold this asset.' };
    }
    if (qty > h.qty) {
      return { ok: false, error: `You only hold ${h.qty} unit(s).` };
    }

    const price = _state.prices[itemId];
    if (!finiteMoney(price)) return { ok: false, error: 'Asset price is invalid.' };
    const total = price * qty;
    if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(_state.cash + total)) {
      return { ok: false, error: 'This sale amount is outside the supported range.' };
    }

    h.qty -= qty;
    if (h.qty === 0) {
      h.avgPrice = 0;
    }

    _state.cash += total;

    _state.transactions.unshift({
      id:       crypto.randomUUID?.() || `tx_${Date.now()}`,
      type:     'sell',
      itemId,
      itemName: _findItemName(itemId),
      qty,
      price,
      total,
      date:     nowISO(),
    });

    _updateHistory();
    _save();

    return { ok: true, message: `Sold ${qty} × ${_findItemName(itemId)} for ${fmt(total)}.` };
  }

  /* ─────────────────────────────────────────────
     BUY LUXURY ITEM
  ───────────────────────────────────────────── */
  function buyLuxury(itemId) {
    if (_state.ownedLuxury.includes(itemId)) {
      return { ok: false, error: 'You already own this item.' };
    }

    const item = DATA.luxuryItems.find(i => i.id === itemId);
    if (!item) return { ok: false, error: 'Item not found.' };

    if (!finiteMoney(item.price)) {
      return { ok: false, error: 'Item price is invalid.' };
    }
    if (item.price > _state.cash) {
      return {
        ok: false,
        error: `Insufficient cash. Need ${fmt(item.price)}, have ${fmt(_state.cash)}.`
      };
    }

    _state.cash -= item.price;
    _state.ownedLuxury.push(itemId);

    _state.transactions.unshift({
      id:       crypto.randomUUID?.() || `tx_${Date.now()}`,
      type:     'buy-luxury',
      itemId,
      itemName: item.name,
      qty:      1,
      price:    item.price,
      total:    item.price,
      date:     nowISO(),
    });

    _updateHistory();
    _save();

    return { ok: true, message: `${item.name} acquired for ${fmt(item.price)}.` };
  }

  /* ─────────────────────────────────────────────
     DAILY MARKET EVENT
     Called once per calendar day; idempotent on repeat calls on same day.
  ───────────────────────────────────────────── */
  function applyDailyEvent() {
    const today = todayISO();

    // The stored local date and event id make refreshes idempotent.
    if (_state.lastEventDate === today && _state.lastEventId) {
      return { applied: false, event: _state.eventLog[0] || null };
    }

    // Pick a random event not in the last 3 entries (avoid repeat streaks)
    const recentIds = _state.eventLog.slice(0, 3).map(e => e.id);
    const pool = DATA.marketEvents.filter(e => !recentIds.includes(e.id));
    const source = pool.length > 0 ? pool : DATA.marketEvents;
    const event = source[Math.floor(Math.random() * source.length)];

    // Calculate and validate all prices before changing state.
    const nextPrices = {};
    for (const cat of DATA.investments) {
      const pct = event.impacts[cat.id];
      if (pct !== undefined) {
        for (const item of cat.items) {
          const current = _state.prices[item.id];
          const nextPrice = Math.round(current * (1 + pct / 100));
          if (!Number.isSafeInteger(nextPrice) || nextPrice <= 0) {
            return { applied: false, event: null, error: 'Market event price is outside the supported range.' };
          }
          nextPrices[item.id] = nextPrice;
        }
      }
    }
    Object.assign(_state.prices, nextPrices);

    const entry = {
      id:      event.id,
      headline: event.headline,
      desc:    event.desc,
      impacts: event.impacts,
      sign:    event.sign,
      date:    today,
    };

    _state.eventLog.unshift(entry);
    _state.lastEventDate = today;
    _state.lastEventId = event.id;

    _updateHistory();
    _save();

    return { applied: true, event: entry };
  }

  /* ─────────────────────────────────────────────
     CHECK MILESTONES
  ───────────────────────────────────────────── */
  function checkMilestones() {
    const nw = getNetWorth();
    const triggered = [];
    DATA.milestones.forEach(m => {
      const key = String(m.value);
      if (nw >= m.value && !_state.achievedMilestones.includes(key)) {
        _state.achievedMilestones.push(key);
        triggered.push(m);
      }
    });
    if (triggered.length) _save();
    return triggered;
  }

  /* ─────────────────────────────────────────────
     NET WORTH HISTORY
  ───────────────────────────────────────────── */
  function _updateHistory() {
    const today = todayISO();
    const nw = getNetWorth();
    const last = _state.netWorthHistory[_state.netWorthHistory.length - 1];
    if (last && last.date === today) {
      // Update today's entry rather than duplicate
      last.value = nw;
    } else {
      _state.netWorthHistory.push({ date: today, value: nw });
    }
    // Keep at most 365 entries
    if (_state.netWorthHistory.length > 365) {
      _state.netWorthHistory = _state.netWorthHistory.slice(-365);
    }
  }

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */
  function _findItemName(itemId) {
    for (const cat of DATA.investments) {
      const item = cat.items.find(i => i.id === itemId);
      if (item) return item.name;
    }
    return itemId;
  }

  function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function _parseQuantity(value) {
    if (typeof value === 'string' && value.trim() === '') return null;
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const qty = typeof value === 'number' ? value : Number(value);
    return Number.isSafeInteger(qty) && qty > 0 ? qty : null;
  }

  function finiteMoney(value) {
    return Number.isSafeInteger(value) && value > 0;
  }

  function offsetDate(isoDate, days) {
    const d = new Date(isoDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function fmt(n) {
    return formatINR(n);
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  return {
    init,
    reset,
    getState,
    getNetWorth,
    getInvestedValue,
    getPnL,
    getPortfolioByCategory,
    getCategoryValue,
    getCategoryCost,
    buyInvestment,
    sellInvestment,
    buyLuxury,
    applyDailyEvent,
    checkMilestones,
    todayISO,
  };

})();
