// ============================================================
// Luxfly -  Home Page Search Logic
// ============================================================

// ── Tab switching (runs immediately, no async needed) ────────
function activateTab(tripType) {
  const isReturn = tripType === 'return';
  document.querySelectorAll('.trip-tab').forEach(t => {
    const active = t.dataset.trip === tripType;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  const returnGroup = document.getElementById('return-date-group');
  const returnEl    = document.getElementById('return-date');
  const dateRow     = returnGroup && returnGroup.closest('.field-row');
  if (returnGroup) {
    returnGroup.hidden = !isReturn;
    returnGroup.setAttribute('aria-hidden', String(!isReturn));
  }
  if (returnEl) {
    returnEl.tabIndex = isReturn ? 0 : -1;
    returnEl.required = isReturn;
    if (!isReturn) returnEl.value = '';
  }
  if (dateRow) dateRow.classList.toggle('one-way', !isReturn);
}

// ── Card navigation (global function, called from onclick) ───
function luxflyCardClick(origin, destination, cabin) {
  if (!origin || !destination) return;
  const departEl    = document.getElementById('depart-date');
  const depart      = (departEl && departEl.value) || tomorrowISO();
  const cabinVal    = cabin || 'Economy';
  const params      = new URLSearchParams();
  params.set('origin',        origin);
  params.set('destination',   destination);
  params.set('departDate',    depart);
  params.set('passengers',    '1');
  params.set('adultsCount',   '1');
  params.set('childrenCount', '0');
  params.set('infantsCount',  '0');
  params.set('cabinClass',    cabinVal);
  params.set('tripType',      'one-way');
  window.location.href = 'results?' + params.toString();
}

document.addEventListener('DOMContentLoaded', async () => {
  await waitForMSW();
  renderAuthNav();

  const originEl    = document.getElementById('origin');
  const destEl      = document.getElementById('destination');
  const departEl    = document.getElementById('depart-date');
  const returnEl    = document.getElementById('return-date');
  const cabinEl     = document.getElementById('cabin-class');
  const form        = document.getElementById('search-form');
  const swapBtn     = document.querySelector('[data-testid="btn-swap"]');

  // ── Populate airports ──────────────────────────────────────
  const _earlyParams = getParams();
  const _preOrigin   = _earlyParams.get('origin')      || '';
  const _preDest     = _earlyParams.get('destination') || '';

  try {
    await populateAirportSelects([{ el: originEl }, { el: destEl }]);
  } catch (e) {
    console.error('Failed to load airports', e);
  }

  if (_preOrigin) originEl.value = _preOrigin;
  if (_preDest)   destEl.value   = _preDest;

  // ── Set minimum dates ──────────────────────────────────────
  const today = todayISO();
  departEl.min = today;
  returnEl.min = today;

  // ── Passenger counter widget ───────────────────────────────
  const paxToggle   = document.getElementById('pax-toggle');
  const paxDropdown = document.getElementById('pax-dropdown');
  const paxDone     = document.getElementById('pax-done');
  const paxSummary  = document.getElementById('pax-summary');
  const paxCounts   = { adults: 1, children: 0, infants: 0 };

  function updatePaxUI() {
    document.getElementById('count-adults').textContent   = paxCounts.adults;
    document.getElementById('count-children').textContent = paxCounts.children;
    document.getElementById('count-infants').textContent  = paxCounts.infants;
    document.getElementById('pax-adults').value   = paxCounts.adults;
    document.getElementById('pax-children').value = paxCounts.children;
    document.getElementById('pax-infants').value  = paxCounts.infants;
    const parts = [];
    if (paxCounts.adults)   parts.push(`${paxCounts.adults} adult${paxCounts.adults !== 1 ? 's' : ''}`);
    if (paxCounts.children) parts.push(`${paxCounts.children} child${paxCounts.children !== 1 ? 'ren' : ''}`);
    if (paxCounts.infants)  parts.push(`${paxCounts.infants} infant${paxCounts.infants !== 1 ? 's' : ''}`);
    paxSummary.textContent = parts.join(', ') || '1 adult';
    document.querySelector('[data-type="adults"][data-action="dec"]').disabled   = paxCounts.adults <= 1;
    document.querySelector('[data-type="children"][data-action="dec"]').disabled = paxCounts.children <= 0;
    document.querySelector('[data-type="infants"][data-action="dec"]').disabled  = paxCounts.infants <= 0;
  }

  paxToggle.addEventListener('click', () => {
    const open = paxDropdown.hidden;
    paxDropdown.hidden = !open;
    paxToggle.setAttribute('aria-expanded', String(open));
  });

  paxDone.addEventListener('click', () => {
    paxDropdown.hidden = true;
    paxToggle.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('click', e => {
    if (!paxToggle.contains(e.target) && !paxDropdown.contains(e.target)) {
      paxDropdown.hidden = true;
      paxToggle.setAttribute('aria-expanded', 'false');
    }
  });

  paxDropdown.querySelectorAll('.pax-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type   = btn.dataset.type;
      const action = btn.dataset.action;
      if (action === 'inc') {
        paxCounts[type]++;
      } else {
        if (type === 'adults'   && paxCounts.adults   <= 1) return;
        if (type === 'children' && paxCounts.children <= 0) return;
        if (type === 'infants'  && paxCounts.infants  <= 0) return;
        paxCounts[type]--;
      }
      updatePaxUI();
    });
  });

  updatePaxUI();

  // ── Pre-fill from URL params ───────────────────────────────
  const p = getParams();
  if (p.get('departDate')) departEl.value = p.get('departDate');
  if (p.get('returnDate')) returnEl.value = p.get('returnDate');
  if (p.get('cabinClass')) cabinEl.value  = p.get('cabinClass');
  if (p.get('adultsCount'))   paxCounts.adults   = parseInt(p.get('adultsCount'),   10) || 1;
  if (p.get('childrenCount')) paxCounts.children = parseInt(p.get('childrenCount'), 10) || 0;
  if (p.get('infantsCount'))  paxCounts.infants  = parseInt(p.get('infantsCount'),  10) || 0;
  updatePaxUI();

  // ── Trip type tabs ─────────────────────────────────────────
  activateTab(p.get('tripType') === 'return' ? 'return' : 'one-way');

  document.querySelectorAll('.trip-tab').forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.trip));
  });

  // ── Swap origin/destination ────────────────────────────────
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      const tmp = originEl.value;
      originEl.value = destEl.value;
      destEl.value = tmp;
    });
  }

  // ── Date guards ────────────────────────────────────────────
  departEl.addEventListener('change', () => {
    returnEl.min = departEl.value || today;
    if (returnEl.value && returnEl.value < departEl.value) returnEl.value = departEl.value;
    clearError('depart-error');
  });
  returnEl.addEventListener('change',  () => clearError('return-error'));
  originEl.addEventListener('change',  () => clearError('origin-error'));
  destEl.addEventListener('change',    () => clearError('destination-error'));

  // ── Form submit ────────────────────────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    const activeTripType  = document.querySelector('.trip-tab.active')?.dataset.trip || 'one-way';
    const totalPassengers = paxCounts.adults + paxCounts.children + paxCounts.infants;
    const query = buildQuery({
      origin:        originEl.value,
      destination:   destEl.value,
      departDate:    departEl.value,
      returnDate:    activeTripType === 'return' ? returnEl.value : '',
      passengers:    String(totalPassengers),
      adultsCount:   String(paxCounts.adults),
      childrenCount: String(paxCounts.children),
      infantsCount:  String(paxCounts.infants),
      cabinClass:    cabinEl.value,
      tripType:      activeTripType,
    });
    window.location.href = 'results?' + query;
  });

  // ── Validation ─────────────────────────────────────────────
  function validate() {
    let ok = true;
    if (!originEl.value) {
      showError('origin-error', 'Please select a departure airport.'); ok = false;
    }
    if (!destEl.value) {
      showError('destination-error', 'Please select a destination airport.'); ok = false;
    }
    if (originEl.value && destEl.value && originEl.value === destEl.value) {
      showError('destination-error', 'Origin and destination must be different.'); ok = false;
    }
    if (!departEl.value) {
      showError('depart-error', 'Please choose a departure date.'); ok = false;
    }
    const isReturn = document.querySelector('.trip-tab.active')?.dataset.trip === 'return';
    if (isReturn && !returnEl.value) {
      showError('return-error', 'Please choose a return date.'); ok = false;
    }
    return ok;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }
  function clearError(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  }
});
