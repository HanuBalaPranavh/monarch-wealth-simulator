/**
 * MONARCH — Charts
 * Pure SVG charts drawn to tasteskill app-screen rules:
 *  - One accent hue on data, never on chrome
 *  - 3–5 gridlines, no y-axis line, light horizontal only
 *  - No point markers except hover dot
 *  - Lines in straight segments (no smoothing)
 *  - Bars: square corners
 *  - Portfolio ring: thin stroke (6px), 5 segments max
 *  - All text: tabular figures, right-aligned in columns
 */
'use strict';

const Charts = (() => {

  /* ── Colour tokens (mirror CSS vars for SVG context) ── */
  const C = {
    accent:  '#c9a84c',
    ink:     '#e4e1dd',
    muted:   '#a7a39b',
    rule:    '#222222',
    surface: '#141414',
    neg:     '#c0392b',
    // Ring segment colours: accent for dominant, rest as tone steps
    segments: ['#c9a84c', '#5a564e', '#3d3a33', '#2a2824', '#1e1c18'],
  };

  const NS = 'http://www.w3.org/2000/svg';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HISTORY_PERIODS = [
    { id: '1W', label: '1W', days: 7 },
    { id: '1M', label: '1M', days: 30 },
    { id: '3M', label: '3M', days: 90 },
    { id: '6M', label: '6M', days: 180 },
    { id: '1Y', label: '1Y', days: 365 },
  ];

  /* ─────────────────────────────────────────────
     LINE CHART — portfolio performance over time
     Charts.line(containerEl, historyArr, opts)
     historyArr: [{ date: string, value: number }]
  ───────────────────────────────────────────── */
  function line(container, history, opts = {}) {
    if (!container) return;
    container.innerHTML = '';
    const points = validHistory(history);
    if (points.length < 2) {
      container.innerHTML = '<div class="chart-empty-state">A performance line will appear after more history is recorded.</div>';
      return;
    }

    const W   = opts.width  || container.clientWidth || 800;
    const H   = opts.height || 200;
    const PAD = { top: 12, right: 16, bottom: 28, left: 72 };
    const pw  = W - PAD.left - PAD.right;
    const ph  = H - PAD.top  - PAD.bottom;

    const values = points.map(d => d.value);
    const minV   = Math.min(...values);
    const maxV   = Math.max(...values);
    // Nice y-axis ticks (4–5 steps)
    const ticks = niceLinearTicks(minV, maxV, 4);
    const tickMin = ticks[0];
    const tickMax = ticks[ticks.length - 1];
    const yScaleBase = Math.max(Math.abs(tickMin), Math.abs(tickMax)) || 1;

    const pointTimes = points.map(point => dateValue(point.date));
    const firstTime = pointTimes[0];
    const timeRange = pointTimes[pointTimes.length - 1] - firstTime;
    const xScale = i => PAD.left + (timeRange > 0
      ? (pointTimes[i] - firstTime) / timeRange
      : i / (points.length - 1)) * pw;
    const yScale = v => tickMax === tickMin
      ? PAD.top + ph / 2
      : PAD.top + (1 - (v / yScaleBase - tickMin / yScaleBase) /
        (tickMax / yScaleBase - tickMin / yScaleBase)) * ph;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img',
      'aria-label': opts.label || 'Simulated portfolio net worth over time' });

    // Gridlines (horizontal only, light)
    const gridG = el('g', { stroke: C.rule, 'stroke-width': 1 });
    ticks.forEach(t => {
      const y = yScale(t);
      gridG.appendChild(el('line', { x1: PAD.left, y1: y, x2: PAD.left + pw, y2: y }));
      // Y label
      const txt = el('text', {
        x: PAD.left - 8, y: y + 4,
        'text-anchor': 'end',
        fill: C.muted,
        'font-size': 11,
        'font-family': 'var(--ff-data)',
        'font-variant-numeric': 'tabular-nums',
      });
      txt.textContent = shortINR(t);
      gridG.appendChild(txt);
    });
    svg.appendChild(gridG);

    // X labels (4 evenly spaced dates)
    const xLabelCount = Math.min(6, points.length);
    const xStep = (points.length - 1) / (xLabelCount - 1);
    const xG = el('g', { fill: C.muted, 'font-size': 11, 'font-family': 'var(--ff-data)' });
    const usedLabels = new Set();
    for (let k = 0; k < xLabelCount; k++) {
      const idx = Math.min(Math.round(k * xStep), points.length - 1);
      if (usedLabels.has(idx)) continue;
      usedLabels.add(idx);
      const x   = xScale(idx);
      const txt = el('text', { x, y: H - PAD.bottom + 14, 'text-anchor': 'middle', fill: C.muted, 'font-size': 11 });
      txt.textContent = formatDateShort(points[idx].date);
      xG.appendChild(txt);
    }
    svg.appendChild(xG);

    // Line path
    const pts = points.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.value)}`).join(' ');

    // Subtle area fill below line (flat tint ~14%)
    const areaD = pts + ` L${xScale(points.length - 1)},${PAD.top + ph} L${xScale(0)},${PAD.top + ph} Z`;
    svg.appendChild(el('path', {
      d: areaD,
      fill: C.accent,
      opacity: 0.08,
    }));

    // Draw the line after the fill so it stays crisp and visible.
    svg.appendChild(el('path', {
      d: pts,
      fill: 'none',
      stroke: C.accent,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }));

    // Hover interaction: vertical line + dot
    const hoverG = el('g', { visibility: 'hidden', 'pointer-events': 'none' });
    const hoverLine = el('line', { stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '3 3' });
    const hoverDot  = el('circle', { r: 5, fill: C.accent, stroke: C.surface, 'stroke-width': 2 });
    const hoverLbl  = el('text', {
      'text-anchor': 'middle', fill: C.ink, 'font-size': 12,
      'font-family': 'var(--ff-data)', 'font-variant-numeric': 'tabular-nums'
    });
    hoverG.append(hoverLine, hoverDot, hoverLbl);
    svg.appendChild(hoverG);

    // Invisible hit area for hover
    const hitArea = el('rect', {
      x: PAD.left, y: PAD.top, width: pw, height: ph,
      fill: 'transparent', 'pointer-events': 'all',
    });
    hitArea.addEventListener('mousemove', evt => {
      const rect = svg.getBoundingClientRect();
      const mx   = evt.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, (mx - PAD.left) / pw));
      const targetTime = timeRange > 0 ? firstTime + ratio * timeRange : null;
      let nearest = 0;
      for (let i = 1; i < points.length; i++) {
        const currentDistance = targetTime === null
          ? Math.abs(i / (points.length - 1) - ratio)
          : Math.abs(pointTimes[i] - targetTime);
        const nearestDistance = targetTime === null
          ? Math.abs(nearest / (points.length - 1) - ratio)
          : Math.abs(pointTimes[nearest] - targetTime);
        if (currentDistance < nearestDistance) nearest = i;
      }
      const clamped = nearest;
      const x = xScale(clamped);
      const y = yScale(points[clamped].value);
      hoverLine.setAttribute('x1', x); hoverLine.setAttribute('x2', x);
      hoverLine.setAttribute('y1', PAD.top); hoverLine.setAttribute('y2', PAD.top + ph);
      hoverDot.setAttribute('cx', x); hoverDot.setAttribute('cy', y);
      const lblY = y > PAD.top + 24 ? y - 10 : y + 20;
      hoverLbl.setAttribute('x', x); hoverLbl.setAttribute('y', lblY);
      hoverLbl.textContent = shortINR(points[clamped].value);
      hoverG.setAttribute('visibility', 'visible');
    });
    hitArea.addEventListener('mouseleave', () => hoverG.setAttribute('visibility', 'hidden'));
    svg.appendChild(hitArea);

    container.appendChild(svg);
  }

  /* ─────────────────────────────────────────────
     PORTFOLIO RING — allocation by asset class
     Charts.ring(containerEl, segments)
     segments: [{ label, value, colour }]
  ───────────────────────────────────────────── */
  function ring(container, segments) {
    if (!container) return;
    container.innerHTML = '';
    const allocation = normalizeAllocation(segments);
    if (allocation.length === 0) {
      // No investments: draw empty grey ring
      const svg = el('svg', { viewBox: '0 0 180 180', width: '100%', height: '100%', role: 'img',
        'aria-label': 'Portfolio allocation — no investments yet' });
      svg.appendChild(el('circle', { cx: 90, cy: 90, r: 72, fill: 'none', stroke: C.rule, 'stroke-width': 6 }));
      container.appendChild(svg);
      return;
    }

    const W = 180, H = 180, cx = 90, cy = 90, R = 72, stroke = 6;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: '100%', role: 'img',
      'aria-label': 'Portfolio allocation including available cash and invested assets' });

    const circumference = 2 * Math.PI * R;
    let offset = circumference * 0.25; // start from top (12 o'clock)

    // Sort so dominant segment (largest) gets the accent colour
    const sorted = allocation;
    sorted.forEach((seg, i) => {
      const pct  = seg.percentage / 100;
      const dash = pct * circumference;
      const gap  = circumference - dash;

      const circle = el('circle', {
        cx, cy, r: R,
        fill: 'none',
        stroke: seg.colour || C.segments[i] || C.muted,
        'stroke-width': stroke,
        'stroke-dasharray': `${dash} ${gap}`,
        'stroke-dashoffset': -offset + circumference * 0.25,
        'stroke-linecap': 'butt',
      });

      // Tooltip via title
      const title = el('title');
      title.textContent = `${seg.label}: ${shortINR(seg.value)} (${seg.percentage.toFixed(1)}%)`;
      circle.appendChild(title);
      svg.appendChild(circle);

      offset += dash;
      // 2px seam between segments
      offset += (circumference * 0.004);
    });

    container.appendChild(svg);
  }

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */
  function el(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function niceLinearTicks(min, max, count) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    if (max < min) [min, max] = [max, min];
    const steps = Number.isInteger(count) && count > 1 ? Math.min(count, 8) : 4;
    if (min === max) {
      const padding = min === 0 ? 1 : Math.max(Math.abs(min) * 0.05, Number.MIN_VALUE * 4);
      const lower = min - padding;
      const upper = max + padding;
      if (Number.isFinite(lower) && Number.isFinite(upper)) return [lower, min, upper];
      if (!Number.isFinite(upper)) return [min - padding * 2, min - padding, min];
      return [min, max + padding, max + padding * 2];
    }

    // Scale first so subtracting extreme finite values cannot overflow.
    const scale = Math.max(Math.abs(min), Math.abs(max));
    if (scale === 0) return [0];
    const low = min / scale;
    const high = max / scale;
    const raw = (high - low) / (steps - 1);
    if (!Number.isFinite(raw) || raw <= 0) return [min, max];

    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const factor = [1, 2, 2.5, 5, 10].find(n => n * magnitude >= raw) || 10;
    const interval = factor * magnitude;
    if (!Number.isFinite(interval) || interval <= 0) return [min, max];

    const start = Math.floor(low / interval) * interval;
    const ticks = [];
    // A fixed iteration bound guarantees termination even at floating-point limits.
    for (let i = 0; i < steps + 3; i++) {
      const normalized = start + i * interval;
      const value = normalized * scale;
      if (Number.isFinite(value) && value >= min && value <= max) ticks.push(value);
      if (normalized >= high) break;
    }
    if (!ticks.length || ticks[0] > min) ticks.unshift(min);
    if (ticks[ticks.length - 1] < max) ticks.push(max);
    return [...new Set(ticks)];
  }

  function normalizeAllocation(segments) {
    if (!Array.isArray(segments)) return [];
    const valid = segments.filter(seg => seg && typeof seg.label === 'string' &&
      Number.isFinite(seg.value) && seg.value > 0);
    if (!valid.length) return [];
    valid.sort((a, b) => b.value - a.value);
    const scale = valid[0].value;
    const scaledTotal = valid.reduce((sum, seg) => sum + seg.value / scale, 0);
    return valid.map((seg, i) => ({
      label: seg.label,
      value: seg.value,
      percentage: (seg.value / scale) / scaledTotal * 100,
      colour: C.segments[i] || C.muted,
    }));
  }

  function validHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.filter(point => point && Number.isFinite(point.value) &&
      typeof point.date === 'string' && Number.isFinite(dateValue(point.date)))
      .map(point => ({ date: point.date, value: point.value }))
      .sort((a, b) => dateValue(a.date) - dateValue(b.date));
  }

  function dateValue(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
    const time = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : NaN;
  }

  function availablePeriods(history) {
    const points = validHistory(history);
    if (points.length < 2) return [];
    const first = dateValue(points[0].date);
    const last = dateValue(points[points.length - 1].date);
    const periods = [{ id: 'ALL', label: 'All' }];
    HISTORY_PERIODS.forEach(period => {
      const cutoff = last - (period.days - 1) * DAY_MS;
      const windowPoints = points.filter(point => dateValue(point.date) >= cutoff);
      if (first <= cutoff && windowPoints.length >= 2) periods.push(period);
    });
    return periods;
  }

  function historyForPeriod(history, periodId) {
    const points = validHistory(history);
    if (periodId === 'ALL') return points;
    const period = HISTORY_PERIODS.find(option => option.id === periodId);
    if (!period || !availablePeriods(points).some(option => option.id === periodId)) return [];
    const last = dateValue(points[points.length - 1].date);
    const cutoff = last - (period.days - 1) * DAY_MS;
    return points.filter(point => dateValue(point.date) >= cutoff);
  }

  function formatDateShort(isoDate) {
    if (typeof isoDate !== 'string' || !isoDate.trim()) return '—';
    try {
      const d = new Date(isoDate + 'T00:00:00');
      if (!Number.isFinite(d.getTime())) return isoDate;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return isoDate.slice(5); }
  }

  return { line, ring, niceLinearTicks, normalizeAllocation, availablePeriods, historyForPeriod };

})();
