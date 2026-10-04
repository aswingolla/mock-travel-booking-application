// ============================================================
// Luxfly -  Results Page Logic
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await waitForMSW();
  renderAuthNav();
  const p            = getParams();
  const origin       = p.get('origin')      || '';
  const destination  = p.get('destination') || '';
  const departDate   = p.get('departDate')  || '';
  const passengers   = parseInt(p.get('passengers') || '1', 10);
  const cabinClass   = p.get('cabinClass')  || 'Economy';
  const tripType     = p.get('tripType')    || 'one-way';

  const filterStops  = p.get('filterStops'); // pre-filter from deal card (e.g. "0" for direct)

  const flightsList  = document.getElementById('flights-list');
  const resultsCount = document.getElementById('results-count');
  const sortSelect   = document.getElementById('sort-select');
  const priceRange   = document.getElementById('max-price');
  const priceDisplay = document.getElementById('price-display');
  const resetBtn     = document.getElementById('reset-filters');
  const stopsInputs  = document.querySelectorAll('input[name="stops"]');
  const airlinesEl   = document.getElementById('airline-filters');

  // ── Browse-all mode when no route given ──────────────────
  // browseAll shows every flight across all routes (176 flights);
  // filters still work but the starting set is the entire catalogue.
  const browseAll = !origin && !destination;

  // ── Pre-apply stops filter from deal card ─────────────────
  if (filterStops !== null && filterStops !== '') {
    const targetStops = Number(filterStops);
    stopsInputs.forEach(inp => {
      inp.checked = (Number(inp.value) === targetStops);
    });
  }

  // Update summary bar
  updateSummary();

  let allFlights = [];
  let airlineSet = new Set();

  // ── Fetch flights ──────────────────────────────────────────
  renderLoading(flightsList);
  try {
    // Fetch all flights from in-memory store, then filter client-side by route and cabin class
    const rawFlights = await getFlights({});

    // Filter by route
    allFlights = browseAll
      ? rawFlights
      : rawFlights.filter(f => f.origin === origin && f.destination === destination);

    // Filter by cabin class
    allFlights = allFlights.filter(f => Array.isArray(f.class) ? f.class.includes(cabinClass) : f.class === cabinClass);

    // Derive max price for range
    const maxPrice = allFlights.reduce((m, f) => Math.max(m, f.price), 0);
    priceRange.max   = maxPrice || 1000;
    priceRange.value = maxPrice || 1000;
    priceDisplay.textContent = formatPrice(maxPrice || 1000);

    // Build airline checkboxes
    allFlights.forEach(f => airlineSet.add(f.airline));
    buildAirlineFilters([...airlineSet]);

    render();
  } catch (err) {
    renderError(flightsList, 'Could not load flights. Please try refreshing the page.');
    resultsCount.textContent = '0 flights';
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    let flights = [...allFlights];
    const totalBeforeFilters = flights.length;

    // Filter: stops -  re-query live so we always read current checked state
    const stopsChecked = [...document.querySelectorAll('input[name="stops"]:checked')].map(i => Number(i.value));
    if (stopsChecked.length) {
      flights = flights.filter(f => stopsChecked.includes(f.stops));
    }

    // Filter: airlines
    const airlineChecked = [...document.querySelectorAll('input[name="airline"]:checked')].map(i => i.value);
    if (airlineChecked.length) {
      flights = flights.filter(f => airlineChecked.includes(f.airline));
    }

    // Filter: max price
    const maxP = Number(priceRange.value);
    const priceRangeMax = Number(priceRange.max);
    if (maxP < priceRangeMax) {
      flights = flights.filter(f => f.price <= maxP);
    }

    // Sort
    const sort = sortSelect.value;
    flights.sort((a, b) => {
      if (sort === 'price-asc')     return a.price - b.price;
      if (sort === 'price-desc')    return b.price - a.price;
      if (sort === 'depart-asc')    return a.departureTime.localeCompare(b.departureTime);
      if (sort === 'depart-desc')   return b.departureTime.localeCompare(a.departureTime);
      if (sort === 'duration-asc')  return durationMins(a.duration) - durationMins(b.duration);
      return 0;
    });

    // Update count -  show filtered context when filters are active
    const filtersActive = stopsChecked.length > 0 || airlineChecked.length > 0 || maxP < priceRangeMax;
    const countLabel = filtersActive && flights.length < totalBeforeFilters
      ? `${flights.length} of ${totalBeforeFilters} flight${totalBeforeFilters !== 1 ? 's' : ''} match your filters`
      : `${flights.length} flight${flights.length !== 1 ? 's' : ''} found`;
    resultsCount.textContent = countLabel;

    if (!flights.length) {
      renderEmpty(flightsList, 'No flights match your filters', 'Try adjusting the filters on the left.');
      return;
    }

    flightsList.innerHTML = flights.map(f => flightCardHTML(f)).join('');

    // Attach click handlers
    flightsList.querySelectorAll('.flight-card').forEach(card => {
      const handler = () => selectFlight(card.dataset.flightId);
      card.addEventListener('click', handler);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    });
  }

  // ── Flight card HTML ───────────────────────────────────────
  function flightCardHTML(f) {
    const stopsLabel = f.stops === 0
      ? '<span class="flight-stops direct">Direct</span>'
      : `<span class="flight-stops">${f.stops} stop${f.stops > 1 ? 's' : ''}${f.stopCity ? ' via ' + f.stopCity : ''}</span>`;

    const seatsClass = f.seatsAvailable <= 5 ? 'low' : '';
    const seatsLabel = f.seatsAvailable <= 5
      ? `Only ${f.seatsAvailable} seats left!`
      : `${f.seatsAvailable} seats available`;

    const totalPrice = f.price * passengers;
    const classes = f.class.map(c =>
      `<span class="flight-class-badge">${c}</span>`
    ).join('');

    const routeLabel = browseAll
      ? `<div class="flight-route-badge" data-testid="flight-route-${f.id}" style="font-size:0.78rem;font-weight:700;letter-spacing:0.04em;color:var(--gold);margin-bottom:2px;">${f.origin} → ${f.destination}</div>`
      : '';

    return `
      <article
        class="flight-card"
        role="button"
        tabindex="0"
        data-flight-id="${f.id}"
        data-testid="flight-card-${f.id}"
        aria-label="${f.airline} ${f.flightNumber}, departs ${f.departureTime}, arrives ${f.arrivalTime}, ${f.duration}, ${f.stops === 0 ? 'direct' : f.stops + ' stop'}, from ${formatPrice(f.price)}"
      >
        <div class="flight-info">
          ${routeLabel}
          <div class="flight-airline" data-testid="flight-airline-${f.id}">${f.airline} · ${f.flightNumber}</div>
          <div class="flight-times">
            <span class="flight-time" data-testid="flight-depart-${f.id}">${f.departureTime}</span>
            <div class="flight-route-line">
              <span class="flight-duration" data-testid="flight-duration-${f.id}">${f.duration}</span>
              <div class="flight-line" aria-hidden="true"></div>
              ${stopsLabel}
            </div>
            <span class="flight-time" data-testid="flight-arrive-${f.id}">${f.arrivalTime}</span>
          </div>
        </div>
        <div class="flight-meta">
          <div>${classes}</div>
          <span class="flight-seats ${seatsClass}" data-testid="flight-seats-${f.id}">${seatsLabel}</span>
        </div>
        <div class="flight-price-block">
          <span class="flight-price-label">per person</span>
          <span class="flight-price" data-testid="flight-price-${f.id}">${formatPrice(f.price)}</span>
          ${passengers > 1
            ? `<span class="flight-price-total" data-testid="flight-total-${f.id}">${formatPrice(totalPrice)} total</span>`
            : ''}
          <button
            class="btn btn-primary"
            data-testid="btn-select-flight-${f.id}"
            aria-label="Select ${f.airline} ${f.flightNumber} for ${formatPrice(f.price)}"
            onclick="event.stopPropagation(); selectFlight('${f.id}')"
          >Select</button>
        </div>
      </article>`;
  }

  // ── Navigate to flight detail ──────────────────────────────
  window.selectFlight = function(flightId) {
    // In browse-all mode, use the flight's own route
    const flight = allFlights.find(f => f.id === flightId);
    const query = buildQuery({
      flightId,
      origin:      origin || flight?.origin      || '',
      destination: destination || flight?.destination || '',
      departDate:  departDate || tomorrowISO(),
      passengers:  passengers.toString(),
      cabinClass,
      tripType,
    });
    window.location.href = `flight?${query}`;
  };

  // ── Build airline filter checkboxes ───────────────────────
  function buildAirlineFilters(airlines) {
    airlinesEl.innerHTML = airlines.map(a => `
      <label class="filter-option" data-testid="filter-airline-${a.replace(/\s+/g,'-').toLowerCase()}">
        <input type="checkbox" name="airline" value="${a}" />
        ${a}
      </label>`).join('');
    airlinesEl.querySelectorAll('input').forEach(i => i.addEventListener('change', render));
  }

  // ── Filter/sort event listeners ────────────────────────────
  stopsInputs.forEach(i => i.addEventListener('change', render));
  sortSelect.addEventListener('change', render);
  priceRange.addEventListener('input', () => {
    priceDisplay.textContent = formatPrice(priceRange.value);
    render();
  });
  resetBtn.addEventListener('click', () => {
    stopsInputs.forEach(i => i.checked = false);
    document.querySelectorAll('input[name="airline"]').forEach(i => i.checked = false);
    const maxP = allFlights.reduce((m, f) => Math.max(m, f.price), 0) || 1000;
    priceRange.value = maxP;
    priceDisplay.textContent = formatPrice(maxP);
    sortSelect.value = 'price-asc';
    render();
  });

  // ── Summary bar ────────────────────────────────────────────
  function updateSummary() {
    const routeEl   = document.querySelector('[data-testid="summary-route"]');
    const detailsEl = document.querySelector('[data-testid="summary-details"]');
    if (routeEl)   routeEl.textContent   = browseAll ? 'All destinations' : `${origin} → ${destination}`;
    if (detailsEl) detailsEl.textContent = browseAll
      ? `${passengers} passenger${passengers > 1 ? 's' : ''} · ${cabinClass} · Browse all available flights`
      : `${formatDate(departDate)} · ${passengers} passenger${passengers > 1 ? 's' : ''} · ${cabinClass}`;
  }

  // ── Helpers ────────────────────────────────────────────────
  function durationMins(str) {
    // e.g. "1h 30m" → 90
    const h = str.match(/(\d+)h/);
    const m = str.match(/(\d+)m/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }
});
