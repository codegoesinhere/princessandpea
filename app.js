/* global IPEA_DATA, Chart */
(function () {
  'use strict';

  function byId(id){ return document.getElementById(id); }

  function parseISODate(s){
    if (!s || typeof s !== 'string') return null;
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s.trim());
    if (!m) return null;
    // Use UTC to avoid timezone edges when comparing dates
    return new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
  }

  function formatReportId(rid){
    if (!rid || typeof rid !== 'string') return '';
    const m = /^([0-9]{4})Q([0-9]{2})$/.exec(rid.trim());
    if (!m) return rid.trim();
    return `${m[1]} Q${m[2]}`;
  }

  
  function initSortDropdown(){
    const host = document.querySelector('.bottom-strip-inner');
    const sortSelect = byId('sortSelect');
    if (!host || !sortSelect) return;

    // Populate only once
    if (!sortSelect.dataset.ready){
      sortSelect.innerHTML = '';
      const opts = [
        { value: 'surname_asc',  label: 'Surname (A-Z)' },
        { value: 'surname_desc', label: 'Surname (Z-A)' },
        { value: 'num_asc',      label: 'Prime Minister number (earliest to latest)' },
        { value: 'num_desc',     label: 'Prime Minister number (latest to earliest)' },
        { value: 'exp_desc',     label: 'Total expenditure ($$$$ to $)' },
        { value: 'exp_asc',      label: 'Total expenditure ($ to $$$$)' }
      ];
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sortSelect.appendChild(opt);
      });
      sortSelect.value = 'surname_asc';
      sortSelect.dataset.ready = '1';
    }

    sortSelect.addEventListener('change', () => {
      const periodSelect = byId('periodSelect');

    removeCompactControls();
      const pe = periodSelect ? periodSelect.value : null;
      if (pe) render(pe);

      // Resort & redraw the period-independent charts
      const records = window.IPEA_DATA && Array.isArray(window.IPEA_DATA.records) ? window.IPEA_DATA.records : [];
      renderTrendChartsOnce(records, { includeDoughnuts: false, includeQuarterly: false });
    });
  }


function ensureTableScrollStyles(){
  if (document.getElementById('tableScrollStyles')) return;
  const style = document.createElement('style');
  style.id = 'tableScrollStyles';
  style.textContent = `
    .table-scroll{
      overflow: auto;
      max-width: 100%;
      max-height: 420px;
      -webkit-overflow-scrolling: touch;
      border-radius: 10px;
    }
    /* Make sure wide tables don't break cards on small screens */
    .data-table{
      min-width: 720px;
    }
    @media (max-width: 720px){
      .table-scroll{ max-height: 55vh; }
      .data-table{ min-width: 640px; }
    }
    /* Bottom strip toggles */
    .bottom-strip-inner{
      display:flex;
      align-items:center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .bottom-toggle{
      display:flex;
      align-items:center;
      gap: 6px;
      user-select:none;
      white-space: nowrap;
    }
    .bottom-toggle input{ transform: translateY(1px); }
  `;
  document.head.appendChild(style);
}


function removeCompactControls(){
  // Feature removed: hide/remove any existing compact-mode controls if present
  const ids = ['compactModeSticky', 'compactMode'];
  ids.forEach((id) => {
    const el = byId(id);
    if (!el) return;

    // Remove any <label for="..."> sibling
    const lbl = document.querySelector(`label[for="${id}"]`);
    if (lbl) lbl.remove();

    // If it sits inside a wrapper (e.g. .bottom-toggle), remove the wrapper; otherwise remove the element
    const wrap = el.closest('.bottom-toggle');
    if (wrap) wrap.remove();
    else el.remove();
  });
}

function initBackToTopButton(){
    const host = document.querySelector('.bottom-strip-inner');
    if (!host) return;

    // Reserve fixed space on the right so the dropdown widths don't jump as the button shows/hides
    let slot = document.getElementById('backToTopSlot');
    if (!slot){
      slot = document.createElement('div');
      slot.id = 'backToTopSlot';
      slot.className = 'back-to-top-slot';
      host.appendChild(slot);
    }

    let btn = document.getElementById('backToTopBtn');
    if (!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'backToTopBtn';
      btn.className = 'back-to-top-btn';
      btn.textContent = 'Back to top';
      btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      slot.appendChild(btn);
    } else if (btn.parentElement !== slot){
      slot.appendChild(btn);
    }

    if (!document.getElementById('backToTopStyles')){
      const style = document.createElement('style');
      style.id = 'backToTopStyles';
      style.textContent = `
        /* Keep a fixed-width space reserved for the button */
        #backToTopSlot.back-to-top-slot{
          margin-left:auto;
          width: 128px;
          display:flex;
          justify-content:flex-end;
          align-items:center;
          flex: 0 0 auto;
        }
        #backToTopBtn.back-to-top-btn{
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.25);
          background: rgba(0,0,0,0.25);
          color: inherit;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 180ms ease;
        }
        #backToTopBtn.back-to-top-btn[aria-hidden="true"]{
          opacity: 0;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    const onScroll = () => {
      const hidden = window.scrollY < 250;
      btn.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }


  function ensureDropdownReadableStyles(){
    if (document.getElementById('dropdownReadableStyles')) return;
    const style = document.createElement('style');
    style.id = 'dropdownReadableStyles';
    style.textContent = `
      /* Improve readability of dropdown option text (non-selected list) */
      #periodSelect{ color: #111; }
      #periodSelect option{ color: #333; }
      #sortSelect{ color: #111; }
      #sortSelect option{ color: #333; }
    `;
    document.head.appendChild(style);
  }

  function fmtISO(d){
    if (!(d instanceof Date)) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,'0');
    const day = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function fmtAUD(val){
    // Dash for null/blank AND for 0
    if (val === null || val === undefined || val === '' || (typeof val === 'number' && !isFinite(val))) return '-';
    const n = Number(val);
    if (!isFinite(n) || n === 0) return '-';
    return n.toLocaleString(undefined, { style:'currency', currency:'AUD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function asNumber(val){
    const n = Number(val);
    return isFinite(n) ? n : 0;
  }

  function safeText(s){
    return (s === null || s === undefined) ? '' : String(s);
  }

  function roleBucket(roleType){
    const rt = (roleType || '').toLowerCase();
    // Check spouses FIRST because their role text contains "former prime minister"
    if (rt.includes('surviving spouse') || rt.includes('de facto partner')) return 'spouse';
    if (rt.includes('former prime minister')) return 'former';
    return 'other';
  }

  function pickName(r){
    return r.fullName || r.fullNameWithTitle || r.displayName || r.name || [r.firstName, r.surname].filter(Boolean).join(' ') || 'Unknown';
  }

  function pickSurname(rowOrName){
    // Prefer explicit surname field if present in the row
    if (rowOrName && typeof rowOrName === 'object'){
      const s = rowOrName.surname ?? rowOrName.Surname ?? rowOrName.lastName ?? rowOrName.familyName ?? rowOrName.FamilyName;
      if (s !== null && s !== undefined && String(s).trim()) return String(s).trim();
    }

    const full = (typeof rowOrName === 'string')
      ? rowOrName
      : pickName(rowOrName);

    if (!full) return '-';

    // Strip common honorifics/titles at the start
    let t = String(full).trim()
      .replace(/^(the\s+hon\.?|hon\.?|rt\.?\s+hon\.?|sir|dame|mr|mrs|ms|dr|prof)\s+/i, '')
      .trim();

    // Drop trailing post-nominals (e.g., AC, AO, OBE, QC, SC, etc.) by splitting on commas
    t = t.split(',')[0].trim();

    const parts = t.split(/\s+/).filter(Boolean);
    if (!parts.length) return '-';
    return parts[parts.length - 1];
  }

  
  function getSortMode(){
    const el = byId('sortSelect');
    return (el && el.value) ? el.value : 'surname_asc';
  }

  function numericOrderFromUserId(id, roleKey){
    const s = String(id || '');
    if (roleKey === 'former'){
      const m = s.match(/PM(\d+)/i);
      return m ? parseInt(m[1], 10) : NaN;
    }
    if (roleKey === 'spouse'){
      // SP23-2 -> 23
      const m = s.match(/SP(\d+)/i);
      return m ? parseInt(m[1], 10) : NaN;
    }
    return NaN;
  }

  function sortRowsForRole(rows, roleKey, mode){
    const arr = [...(rows || [])];

    const surnameCmp = (a, b) => {
      const sa = String(pickSurname(a) || '').trim();
      const sb = String(pickSurname(b) || '').trim();

      const aBlank = (!sa || sa === '-');
      const bBlank = (!sb || sb === '-');
      if (aBlank && bBlank) return 0;
      if (aBlank) return 1;
      if (bBlank) return -1;

      const cmp = sa.localeCompare(sb, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return String(pickName(a)).localeCompare(String(pickName(b)), undefined, { sensitivity: 'base' });
    };

    const numCmp = (a, b) => {
      const na = numericOrderFromUserId(a.userId, roleKey);
      const nb = numericOrderFromUserId(b.userId, roleKey);
      const aBad = !Number.isFinite(na);
      const bBad = !Number.isFinite(nb);
      if (aBad && bBad) return surnameCmp(a, b);
      if (aBad) return 1;
      if (bBad) return -1;
      if (na !== nb) return na - nb;
      return surnameCmp(a, b);
    };

    if (mode === 'surname_desc'){
      return arr.sort((a,b) => -surnameCmp(a,b));
    }
    if (mode === 'num_asc'){
      return arr.sort(numCmp);
    }
    if (mode === 'num_desc'){
      return arr.sort((a,b) => -numCmp(a,b));
    }
    if (mode === 'exp_desc' || mode === 'exp_asc'){
      const val = (r) => {
        const v = (r && r.amounts) ? r.amounts['total_expenditure'] : null;
        const n = asNumber(v);
        return Number.isFinite(n) ? n : null;
      };
      const expCmp = (a, b) => {
        const va = val(a);
        const vb = val(b);
        const aBad = (va === null);
        const bBad = (vb === null);
        if (aBad && bBad) return surnameCmp(a, b);
        if (aBad) return 1;
        if (bBad) return -1;
        if (va !== vb) return va - vb;
        return surnameCmp(a, b);
      };
      if (mode === 'exp_desc'){
        return arr.sort((a,b) => -expCmp(a,b));
      }
      return arr.sort(expCmp);
    }
    // default surname_asc
    return arr.sort(surnameCmp);
  }

function sortBySurname(rows){
    return [...rows].sort((a, b) => {
      const sa = String(pickSurname(a) || '').trim();
      const sb = String(pickSurname(b) || '').trim();

      // Push blanks/dashes to the bottom
      const aBlank = (!sa || sa === '-');
      const bBlank = (!sb || sb === '-');
      if (aBlank && bBlank) return 0;
      if (aBlank) return 1;
      if (bBlank) return -1;

      const cmp = sa.localeCompare(sb, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;

      // Tie-breaker: full name
      return String(pickName(a)).localeCompare(String(pickName(b)), undefined, { sensitivity: 'base' });
    });
  }



  function uniqueSortedPeriods(records){
    const map = new Map();
    records.forEach(r => {
      if (!r.periodEnd) return;
      map.set(r.periodEnd, r);
    });
    const items = Array.from(map.keys()).sort(); // ascending ISO date strings
    return items;
  }

  function chooseDefaultPeriod(periodEnds){
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    // choose latest end <= today, else latest available
    let chosen = null;
    for (const pe of periodEnds){
      const d = parseISODate(pe);
      if (d && d <= todayUTC) chosen = pe;
    }
    return chosen || periodEnds[periodEnds.length-1] || null;
  }

  function buildTable(container, rows, categories, opts){
    const { title, compactMode, showZeros } = opts;

    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');

    const thName = document.createElement('th');
    thName.textContent = title || 'Name';
    trh.appendChild(thName);

    const catIds = compactMode
      ? ['total_expenditure','travel_allowance','office_facilities','telecommunications']
      : categories.map(c => c.id);

    // filter columns if not showing zeros: we keep a column if any row has non-zero/nonnull for it
    const filteredCatIds = catIds.filter(id => {
      if (showZeros) return true;
      if (id === 'total_expenditure') return true;
      return rows.some(r => {
        const v = r.amounts ? r.amounts[id] : null;
        const n = asNumber(v);
        return (v !== null && v !== undefined && v !== '') && n !== 0;
      });
    });

    filteredCatIds.forEach((id) => {
      const cat = categories.find(c => c.id === id) || { label: id };
      const th = document.createElement('th');
      th.textContent = cat.label;
      th.className = 'num';
      if (id === 'total_expenditure') th.classList.add('col-total');
      trh.appendChild(th);
    });

    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    rows.forEach(r => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = pickName(r);
      tr.appendChild(tdName);

      filteredCatIds.forEach((id) => {
        const td = document.createElement('td');
        td.className = 'num';
        if (id === 'total_expenditure') td.classList.add('col-total');
        const v = r.amounts ? r.amounts[id] : null;

        // If showZeros is false, we might still have 0s in remaining columns; format will dash them.
        td.textContent = fmtAUD(v);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    container.innerHTML = '';

    const meta = document.createElement('div');
    meta.className = 'table-meta subtle';
    meta.textContent = `Rows: ${rows.length}`;
    container.appendChild(meta);

    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    scroll.appendChild(table);
    container.appendChild(scroll);
  }
// ---- Charts ----
let chartFormerTotal = null;
let chartFormerStacked = null;
let chartSpouseTotal = null;
let chartSpouseStacked = null;

// Period-independent trend charts (render once; NOT tied to the reporting period dropdown)
let chartFormerTrend = null;
let chartSpouseTrend = null;

// Period-independent aggregate charts (render once; NOT tied to the reporting period dropdown)
let chartFormerYearTotals = null;
let chartFormerGrandTotal = null;
let chartSpouseYearTotals = null;
let chartSpouseGrandTotal = null;

// Period-independent category totals (doughnut)
let chartFormerCategoryTotal = null;
let chartSpouseCategoryTotal = null;

function destroyCharts(){
  if (chartFormerTotal){ chartFormerTotal.destroy(); chartFormerTotal = null; }
  if (chartFormerStacked){ chartFormerStacked.destroy(); chartFormerStacked = null; }
  if (chartSpouseTotal){ chartSpouseTotal.destroy(); chartSpouseTotal = null; }
  if (chartSpouseStacked){ chartSpouseStacked.destroy(); chartSpouseStacked = null; }
}

function destroyTrendCharts(opts){
  const includeDoughnuts = !(opts && opts.includeDoughnuts === false);
  const includeQuarterly = !(opts && opts.includeQuarterly === false);

  if (includeQuarterly){
    if (chartFormerTrend){ chartFormerTrend.destroy(); chartFormerTrend = null; }
    if (chartSpouseTrend){ chartSpouseTrend.destroy(); chartSpouseTrend = null; }
  }

  if (chartFormerYearTotals){ chartFormerYearTotals.destroy(); chartFormerYearTotals = null; }
  if (chartFormerGrandTotal){ chartFormerGrandTotal.destroy(); chartFormerGrandTotal = null; }
  if (chartSpouseYearTotals){ chartSpouseYearTotals.destroy(); chartSpouseYearTotals = null; }
  if (chartSpouseGrandTotal){ chartSpouseGrandTotal.destroy(); chartSpouseGrandTotal = null; }

  if (includeDoughnuts){
    if (chartFormerCategoryTotal){ chartFormerCategoryTotal.destroy(); chartFormerCategoryTotal = null; }
    if (chartSpouseCategoryTotal){ chartSpouseCategoryTotal.destroy(); chartSpouseCategoryTotal = null; }
  }
}

  function ensureChartJs(){
    return (typeof Chart !== 'undefined' && Chart && typeof Chart === 'function');
  }

  
  function renderChartsForRole(rows, categories, ids, assign){
    const fallback = byId(ids.fallback);
    if (!ensureChartJs()){
      if (fallback) fallback.hidden = false;
      return;
    }
    if (fallback) fallback.hidden = true;

    if (!rows || !rows.length) return;

    const totalCat = categories.find(c => c.id === 'totalExpenditure') || categories.find(c => /total/i.test(c.id));
    const totalsForSort = (r) => asNumber(r.amounts?.[totalCat?.id] ?? r.totalExpenditure ?? r.total);

    const sortedRows = [...rows];

    const fullNames = sortedRows.map(r => pickName(r));
    const labels = sortedRows.map(r => pickSurname(r));
    const totals = sortedRows.map(r => totalsForSort(r));

    const ctxTotal = byId(ids.total);
    if (ctxTotal){
      assign.total(new Chart(ctxTotal, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Total expenditure (AUD)',
            data: totals,
            backgroundColor: '#8c7641',
            borderColor: '#8c7641',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const i = items && items[0] ? items[0].dataIndex : -1;
                  return (i >= 0 && fullNames[i]) ? fullNames[i] : '';
                },
                label: (ctx) => {
                  const v = ctx.parsed.y;
                  return (v === 0) ? '-' : v.toLocaleString(undefined, { style:'currency', currency:'AUD' });
                }
              }
            }
          },
          scales: {
            x: { ticks: { maxRotation: 50, minRotation: 0 } },
            y: { beginAtZero: true }
          }
        }
      }));
    }

    // Stacked breakdown (exclude Total expenditure)
    const breakdownCats = categories.filter(c => {
      const id = String(c.id || '').toLowerCase();
      const label = String(c.label || '').toLowerCase();
      // Exclude any 'total' category variants (e.g., totalExpenditure, total_expenditure)
      return !(id.includes('total') || label.includes('total'));
    });
    const nonZeroCats = breakdownCats.filter(c => sortedRows.some(r => asNumber(r.amounts?.[c.id]) > 0));

    const datasets = nonZeroCats.map(c => ({
      label: c.label,
      data: sortedRows.map(r => asNumber(r.amounts?.[c.id])),
      stack: 'stack1'
    }));

    const ctxStacked = byId(ids.stacked);
    if (ctxStacked){
      assign.stacked(new Chart(ctxStacked, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }, // hide legend for now (requested)
            tooltip: {
              callbacks: {
                title: (items) => {
                  const i = items && items[0] ? items[0].dataIndex : -1;
                  return (i >= 0 && fullNames[i]) ? fullNames[i] : '';
                },
                label: (ctx) => {
                  const v = ctx.parsed.y;
                  return `${ctx.dataset.label}: ` + ((v === 0) ? '-' : v.toLocaleString(undefined, { style:'currency', currency:'AUD' }));
                }
              }
            }
          },
          scales: {
            x: { stacked: true, ticks: { maxRotation: 50, minRotation: 0 } },
            y: { stacked: true, beginAtZero: true }
          }
        }
      }));
    }
  }

  function renderFormerCharts(rows, categories){
    if (chartFormerTotal){ chartFormerTotal.destroy(); chartFormerTotal = null; }
    if (chartFormerStacked){ chartFormerStacked.destroy(); chartFormerStacked = null; }
    renderChartsForRole(rows, categories, {
      total: 'chartFormerTotal',
      stacked: 'chartFormerStacked',
      fallback: 'chartFormerFallback'
    }, {
      total: (ch) => { chartFormerTotal = ch; },
      stacked: (ch) => { chartFormerStacked = ch; }
    });
  }

  function renderSpouseCharts(rows, categories){
    if (chartSpouseTotal){ chartSpouseTotal.destroy(); chartSpouseTotal = null; }
    if (chartSpouseStacked){ chartSpouseStacked.destroy(); chartSpouseStacked = null; }
    renderChartsForRole(rows, categories, {
      total: 'chartSpouseTotal',
      stacked: 'chartSpouseStacked',
      fallback: 'chartSpouseFallback'
    }, {
      total: (ch) => { chartSpouseTotal = ch; },
      stacked: (ch) => { chartSpouseStacked = ch; }
    });
  }

// ---- Period-independent quarterly trend (line) charts ----
function renderQuarterlyTrendChart(records, roleKey, canvasId, assignChart){
  const fallbackId = (roleKey === 'former') ? 'chartFormerFallback' : 'chartSpouseFallback';
  const fallback = byId(fallbackId);

  if (!ensureChartJs()){
    if (fallback) fallback.hidden = false;
    return;
  }

  const canvas = byId(canvasId);
  if (!canvas) return; // user will add the <canvas> in HTML

  // Hide fallback if the base charts are supported
  if (fallback) fallback.hidden = true;

  const roleRecords = (records || []).filter(r => roleBucket(r.roleType || r.role) === roleKey);

  // Unique periodEnds (ascending)
  const periodEnds = Array.from(new Set(roleRecords.map(r => r.periodEnd).filter(Boolean))).sort();

  // Use reportId (e.g. "2017 Q02") for a cleaner axis
  const labelByPeriodEnd = {};
  roleRecords.forEach(r => {
    if (!r.periodEnd || labelByPeriodEnd[r.periodEnd]) return;
    if (r.reportId){
      labelByPeriodEnd[r.periodEnd] = formatReportId(r.reportId);
    } else if (r.periodLabel){
      labelByPeriodEnd[r.periodEnd] = r.periodLabel;
    }
  });
  const xLabels = periodEnds.map(pe => labelByPeriodEnd[pe] || pe);
// Group totals by personId and periodEnd
  const byPerson = new Map();
  const toNumberOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  roleRecords.forEach(r => {
    const id = r.userId || pickName(r);
    if (!byPerson.has(id)){
      byPerson.set(id, {
        userId: r.userId,
        fullName: pickName(r),
        surname: pickSurname(r),
        points: Object.create(null)
      });
    }
    const p = byPerson.get(id);
    // data.js uses amounts.total_expenditure
    p.points[r.periodEnd] = toNumberOrNull(r.amounts?.total_expenditure);
  });

  // Ordering follows the Sort by dropdown
  const sortMode = getSortMode();
  const people = Array.from(byPerson.values()).sort((a, b) => {
    const ra = { surname: a.surname, fullName: a.fullName, userId: a.userId };
    const rb = { surname: b.surname, fullName: b.fullName, userId: b.userId };
    const sorted = sortRowsForRole([ra, rb], roleKey, sortMode);
    return (sorted[0] === ra) ? -1 : 1;
  });

  const datasets = people.map(p => ({
    label: p.surname || '—',
    _fullName: p.fullName || (p.surname || '-'),
    data: periodEnds.map(pe => (pe in p.points) ? p.points[pe] : null),
    tension: 0.25,
    spanGaps: true,
    pointRadius: 2
  }));

  // If this is being rerendered (e.g., hot reload), destroy the old chart bound to this canvas
  if (assignChart.current){ assignChart.current.destroy(); assignChart.current = null; }

  assignChart.current = new Chart(canvas, {
    type: 'line',
    data: {
      labels: xLabels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              const who = ctx.dataset._fullName || ctx.dataset.label;
              return `${who}: ` + (v === null ? '-' : v.toLocaleString(undefined, { style:'currency', currency:'AUD' }));
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true },
        x: { ticks: { maxRotation: 50, minRotation: 0 } }
      }
    }
  });
}


// ---- Period-independent aggregate charts ----
function buildPeopleYearMatrix(records, role, sortMode){
  const roleRecords = records.filter(r => roleBucket(r.roleType) === role);

  const years = [...new Set(
    roleRecords.map(r => (r.periodEnd || '').slice(0,4)).filter(y => /^\d{4}$/.test(y))
  )].sort(); // ascending

  const byId = new Map();
  for (const r of roleRecords){
    const id = r.userId || pickName(r);
    if (!byId.has(id)){
      byId.set(id, { id, row: r, byYear: Object.create(null), total: 0 });
    }
    const y = (r.periodEnd || '').slice(0,4);
    if (!/^\d{4}$/.test(y)) continue;
    const v = asNumber(r.amounts?.total_expenditure);
    byId.get(id).byYear[y] = (byId.get(id).byYear[y] || 0) + v;
    byId.get(id).total += v;
  }

  // Sort people by surname A–Z (consistent with your other charts/tables)
  const people = Array.from(byId.values());
  const sortedRows = sortRowsForRole(people.map(p => p.row), role, sortMode || getSortMode());
  const rowToPerson = new Map(people.map(p => [p.row, p]));
  const sortedPeople = sortedRows.map(r => rowToPerson.get(r)).filter(Boolean);

  const labels = sortedPeople.map(p => pickSurname(p.row));
  const fullNames = sortedPeople.map(p => pickName(p.row));

  return { years, sortedPeople, labels, fullNames };
}

function renderYearTotalsByPersonChart(records, role, canvasId, assign){
  if (!ensureChartJs()) return;
  const ctx = byId(canvasId);
  if (!ctx) return;

  const sortMode = getSortMode();
  let { years, sortedPeople } = buildPeopleYearMatrix(records, role, sortMode);
  if (!sortedPeople.length || !years.length) return;

  // IMPORTANT: For the "Total expenditure per calendar year" chart, when sorting by expenditure,
  // sort by the computed multi-year total (sum across all years), not by a single period row.
  if (sortMode === 'exp_desc' || sortMode === 'exp_asc'){
    const dir = (sortMode === 'exp_desc') ? -1 : 1;
    sortedPeople = [...sortedPeople].sort((a, b) => {
      const at = asNumber(a.total);
      const bt = asNumber(b.total);
      if (bt !== at) return (at - bt) * dir;
      // stable tiebreakers
      return pickSurname(a.row).localeCompare(pickSurname(b.row)) || pickName(a.row).localeCompare(pickName(b.row));
    });
  }

  const labels = sortedPeople.map(p => pickSurname(p.row));
  const fullNames = sortedPeople.map(p => pickName(p.row));

  const datasets = years.map(y => ({
    label: y,
    data: sortedPeople.map(p => p.byYear[y] || 0)
  }));

  assign(new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items && items[0] ? items[0].dataIndex : -1;
              return (i >= 0 && fullNames[i]) ? fullNames[i] : '';
            },
            label: (ctx) => {
              const v = ctx.parsed.y;
              const year = ctx.dataset.label;
              return `${year}: ` + ((v === 0) ? '-' : v.toLocaleString(undefined, { style:'currency', currency:'AUD' }));
            }
          }
        }
      },
      scales: {
        x: { ticks: { maxRotation: 50, minRotation: 0 } },
        y: { beginAtZero: true }
      }
    }
  }));
}

function renderGrandTotalByPersonChart(records, role, canvasId, assign){
  if (!ensureChartJs()) return;
  const ctx = byId(canvasId);
  if (!ctx) return;

  const sortMode = getSortMode();
  let { sortedPeople } = buildPeopleYearMatrix(records, role, sortMode);
  if (!sortedPeople.length) return;

  // IMPORTANT: For the "Grand total since reporting" chart, sort by the computed grand total,
  // not by a single period row's total_expenditure (which can mis-order the bars).
  if (sortMode === 'exp_desc' || sortMode === 'exp_asc'){
    const dir = (sortMode === 'exp_desc') ? -1 : 1;
    sortedPeople = [...sortedPeople].sort((a, b) => {
      const at = asNumber(a.total);
      const bt = asNumber(b.total);
      if (at !== bt) return dir * (at - bt);

      // Stable tie-break: surname A–Z
      const as = String(pickSurname(a.row) || '');
      const bs = String(pickSurname(b.row) || '');
      return as.localeCompare(bs);
    });
  }

  const labels = sortedPeople.map(p => pickSurname(p.row));
  const fullNames = sortedPeople.map(p => pickName(p.row));
  const totals = sortedPeople.map(p => p.total || 0);

  assign(new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total expenditure (AUD)',
        data: totals,
        backgroundColor: '#8c7641',
        borderColor: '#8c7641',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items && items[0] ? items[0].dataIndex : -1;
              return (i >= 0 && fullNames[i]) ? fullNames[i] : '';
            },
            label: (ctx) => {
              const v = ctx.parsed.y;
              return (v === 0) ? '-' : v.toLocaleString(undefined, { style:'currency', currency:'AUD' });
            }
          }
        }
      },
      scales: {
        x: { ticks: { maxRotation: 50, minRotation: 0 } },
        y: { beginAtZero: true }
      }
    }
  }));
}

// Total by category across all reporting periods (doughnut)
function renderCategoryTotalsDoughnut(records, role, categories, canvasId, assign){
  if (!ensureChartJs()) return;
  const canvas = byId(canvasId);
  if (!canvas) return;

  // Filter to role and sum each category across all records/people/periods
  const roleRecords = (records || []).filter(r => roleBucket(r.roleType || r.role) === role);

  // Exclude any 'total' category variants (e.g., totalExpenditure, total_expenditure)
  const cats = (categories || []).filter(c => {
    const id = String(c.id || '').toLowerCase();
    const label = String(c.label || '').toLowerCase();
    return !(id.includes('total') || label.includes('total'));
  });

  const totalsByCatId = Object.create(null);
  for (const c of cats) totalsByCatId[c.id] = 0;

  for (const r of roleRecords){
    const a = r.amounts || {};
    for (const c of cats){
      totalsByCatId[c.id] += asNumber(a[c.id]);
    }
  }

  // Keep non-zero categories only (doughnut with dozens of 0-slices is useless)
  const items = cats
    .map(c => ({ id: c.id, label: c.label, total: totalsByCatId[c.id] || 0 }))
    .filter(x => x.total > 0);

  if (!items.length) return;

  // Stable ordering: biggest slice first
  items.sort((a, b) => b.total - a.total);

  const labels = items.map(x => x.label);
  const data = items.map(x => x.total);

  // Create a simple hue wheel so slices are visually distinct without hard-coding a palette
    // Use the same *soft* palette approach as the other charts (muted + alpha)
  const n = Math.max(1, data.length);
  const colors = data.map((_, i) => `hsla(${Math.round((i * 360) / n)}, 45%, 60%, 0.65)`);

  // Destroy old chart bound to this canvas (prevents "Canvas is already in use" errors)
  if (assign.current){ assign.current.destroy(); assign.current = null; }

  const grand = data.reduce((a,b) => a + b, 0);

  assign.current = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed;
              const pct = grand ? (v / grand) * 100 : 0;
              return `${ctx.label}: ` + v.toLocaleString(undefined, { style:'currency', currency:'AUD' }) + ` (${pct.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}

function renderTrendChartsOnce(records, opts){
  const includeDoughnuts = !(opts && opts.includeDoughnuts === false);
  const includeQuarterly = !(opts && opts.includeQuarterly === false);
  // Re-create safely if init runs twice
  destroyTrendCharts({ includeDoughnuts, includeQuarterly });


  const categories = window.IPEA_DATA?.categories || [];

  // Canvas IDs to add in index.html:
  // Former PMs:
  // - chartFormerTrend
  // - chartFormerYearTotals
  // - chartFormerGrandTotal
  // Surviving spouses:
  // - chartSpouseTrend
  // - chartSpouseYearTotals
  // - chartSpouseGrandTotal

  // Quarterly trend (one line per person; legend = surname; tooltip = full name)
  if (includeQuarterly) renderQuarterlyTrendChart(
    records,
    'former',
    'chartFormerTrend',
    { get current(){ return chartFormerTrend; }, set current(v){ chartFormerTrend = v; } }
  );
  if (includeQuarterly) renderQuarterlyTrendChart(
    records,
    'spouse',
    'chartSpouseTrend',
    { get current(){ return chartSpouseTrend; }, set current(v){ chartSpouseTrend = v; } }
  );

  // Year totals per person (grouped columns by year for each person)
  renderYearTotalsByPersonChart(
    records,
    'former',
    'chartFormerYearTotals',
    (c) => { chartFormerYearTotals = c; }
  );
  renderYearTotalsByPersonChart(
    records,
    'spouse',
    'chartSpouseYearTotals',
    (c) => { chartSpouseYearTotals = c; }
  );

  // Grand total per person (single column per person across all periods)
  renderGrandTotalByPersonChart(
    records,
    'former',
    'chartFormerGrandTotal',
    (c) => { chartFormerGrandTotal = c; }
  );
  renderGrandTotalByPersonChart(
    records,
    'spouse',
    'chartSpouseGrandTotal',
    (c) => { chartSpouseGrandTotal = c; }
  );


  if (includeDoughnuts){
  
    // Total by category across all reporting periods (doughnut)
    renderCategoryTotalsDoughnut(
      records,
      'former',
      categories,
      'chartFormerCategoryTotal',
      { get current(){ return chartFormerCategoryTotal; }, set current(v){ chartFormerCategoryTotal = v; } }
    );
    renderCategoryTotalsDoughnut(
      records,
      'spouse',
      categories,
      'chartSpouseCategoryTotal',
      { get current(){ return chartSpouseCategoryTotal; }, set current(v){ chartSpouseCategoryTotal = v; } }
    );
  }
}

  function render(periodEnd){
    if (!window.IPEA_DATA || !Array.isArray(window.IPEA_DATA.records)){
      console.warn('IPEA_DATA not found or invalid.');
      return;
    }

    const records = window.IPEA_DATA.records;

    const selected = records.filter(r => r.periodEnd === periodEnd);

    const sortMode = getSortMode();

    const former = sortRowsForRole(selected.filter(r => roleBucket(r.roleType || r.role) === 'former'), 'former', sortMode);
    const spouses = sortRowsForRole(selected.filter(r => roleBucket(r.roleType || r.role) === 'spouse'), 'spouse', sortMode);

    const categories = window.IPEA_DATA.categories || [];

    // Period labels
    const sample = selected[0] || records.find(r => r.periodEnd === periodEnd) || null;
    const startISO = sample ? sample.periodStart : null;
    const endISO = sample ? sample.periodEnd : periodEnd;
    const periodLabel = sample?.periodLabel || '';
    const metaText = (startISO && endISO)
      ? `${periodLabel} (${startISO} → ${endISO})`
      : (periodLabel || (endISO ? `Period ending ${endISO}` : ''));

    const periodLabelEl = byId('periodLabel');
    if (periodLabelEl) periodLabelEl.textContent = metaText;

    const periodMeta = byId('periodMeta');
    if (periodMeta) periodMeta.textContent = metaText;

    const periodMetaSp = byId('periodMetaSpouses');
    if (periodMetaSp) periodMetaSp.textContent = metaText;

    // Options
    const showZeros = !!byId('showZeros')?.checked;
    const compactMode = !!byId('compactMode')?.checked;

    // Former table
    const tablesFormer = byId('tablesFormer');
    if (tablesFormer){
      buildTable(tablesFormer, former, categories, { title: 'Name', compactMode, showZeros });
    }

    // Spouses table
    const tablesSpouses = byId('tablesSpouses');
    if (tablesSpouses){
      buildTable(tablesSpouses, spouses, categories, { title: 'Name', compactMode: true, showZeros: true });
    }

    // Charts (Former PMs only for now)
    destroyCharts();
    renderFormerCharts(former, categories);
    renderSpouseCharts(spouses, categories);
  }

  function init(){
    if (!window.IPEA_DATA || !Array.isArray(window.IPEA_DATA.records)){
      console.warn('IPEA_DATA not found. Ensure data.js is loaded before app.js.');
      return;
    }

    const periodSelect = byId('periodSelect');
    const records = window.IPEA_DATA.records;

    const periodEnds = uniqueSortedPeriods(records); // ascending
    const defaultPeriod = chooseDefaultPeriod(periodEnds);

    if (periodSelect){
      // newest first
      const desc = periodEnds.slice().sort().reverse();
      periodSelect.innerHTML = '';
      desc.forEach(pe => {
        const r = records.find(x => x.periodEnd === pe);
        const prefix = (r && r.reportId) ? `${formatReportId(r.reportId)} - ` : '';
        const label = r ? `${prefix}${r.periodLabel} (${r.periodStart} → ${r.periodEnd})` : pe;
        const opt = document.createElement('option');
        opt.value = pe;
        opt.textContent = label;
        periodSelect.appendChild(opt);
      });
      periodSelect.value = defaultPeriod || (desc[0] || '');
      periodSelect.addEventListener('change', () => {
        render(periodSelect.value);
      });
    }

    initSortDropdown();

    initBackToTopButton();
    ensureDropdownReadableStyles();
    ensureTableScrollStyles();
    // re-render on toggles
    const showZeros = byId('showZeros');
    const compactMode = byId('compactMode');
    if (showZeros) showZeros.addEventListener('change', () => render(periodSelect.value));
    if (compactMode) compactMode.addEventListener('change', () => render(periodSelect.value));

    render(periodSelect?.value || defaultPeriod);
  

    // Render the quarterly trend line charts once (independent of reporting period)
    renderTrendChartsOnce(records);
}

  document.addEventListener('DOMContentLoaded', init);
})();
