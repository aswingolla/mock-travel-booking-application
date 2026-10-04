// ============================================================
// Luxfly -  Flight Detail Page Logic
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await waitForMSW();
  renderAuthNav();
  const p           = getParams();
  const flightId    = p.get('flightId');
  const origin      = p.get('origin')      || '';
  const destination = p.get('destination') || '';
  const departDate  = p.get('departDate')  || '';
  const passengers  = parseInt(p.get('passengers') || '1', 10);
  const cabinClass  = p.get('cabinClass')  || 'Economy';
  const tripType    = p.get('tripType')    || 'one-way';

  const container = document.getElementById('flight-detail');

  if (!flightId) {
    renderError(container, 'No flight selected. Please go back and choose a flight.');
    return;
  }

  renderLoading(container, 'Loading flight details…');

  try {
    const flight = await getFlight(flightId);
    const airports = await getAirports();
    const airportMap = Object.fromEntries(airports.map(a => [a.id, a]));

    const origAirport = airportMap[flight.origin]      || { city: flight.origin,      name: flight.origin };
    const destAirport = airportMap[flight.destination] || { city: flight.destination, name: flight.destination };
    const totalPrice  = flight.price * passengers;

    container.innerHTML = `
      <h1 class="page-header-title" style="margin-bottom:1.5rem;font-size:1.75rem;" data-testid="flight-detail-heading">
        ${origAirport.city} → ${destAirport.city}
      </h1>

      <!-- Flight summary card -->
      <div class="flight-card" style="cursor:default;margin-bottom:1.5rem;" data-testid="flight-summary-card">
        <div class="flight-info">
          <div class="flight-airline" data-testid="detail-airline">${flight.airline} · ${flight.flightNumber}</div>
          <div class="flight-times">
            <div>
              <div class="flight-time" data-testid="detail-depart-time">${flight.departureTime}</div>
              <div style="font-size:.8rem;color:var(--fg-muted);" data-testid="detail-origin">${flight.origin} · ${origAirport.name}</div>
            </div>
            <div class="flight-route-line">
              <span class="flight-duration" data-testid="detail-duration">${flight.duration}</span>
              <div class="flight-line" aria-hidden="true"></div>
              ${flight.stops === 0
                ? '<span class="flight-stops direct">Direct</span>'
                : `<span class="flight-stops">${flight.stops} stop${flight.stops > 1 ? 's' : ''}${flight.stopCity ? ' via ' + flight.stopCity : ''}</span>`}
            </div>
            <div>
              <div class="flight-time" data-testid="detail-arrive-time">${flight.arrivalTime}</div>
              <div style="font-size:.8rem;color:var(--fg-muted);" data-testid="detail-destination">${flight.destination} · ${destAirport.name}</div>
            </div>
          </div>
        </div>
        <div class="flight-meta">
          ${flight.class.map(c => `<span class="flight-class-badge">${c}</span>`).join('')}
          <span class="flight-seats${flight.seatsAvailable <= 5 ? ' low' : ''}" data-testid="detail-seats">
            ${flight.seatsAvailable <= 5 ? `Only ${flight.seatsAvailable} seats left!` : `${flight.seatsAvailable} seats available`}
          </span>
        </div>
        <div class="flight-price-block">
          <span class="flight-price-label">per person</span>
          <span class="flight-price" data-testid="detail-price">${formatPrice(flight.price)}</span>
          ${passengers > 1 ? `<span class="flight-price-total" data-testid="detail-total">${formatPrice(totalPrice)} total (${passengers} passengers)</span>` : ''}
        </div>
      </div>

      <!-- Journey details -->
      <div class="passenger-card" style="margin-bottom:1.5rem;" data-testid="journey-details">
        <h2 class="passenger-heading">Journey details</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;">
          <div>
            <div style="font-size:.75rem;font-weight:600;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem;">Date</div>
            <div data-testid="detail-date">${formatDate(departDate) || ' - '}</div>
          </div>
          <div>
            <div style="font-size:.75rem;font-weight:600;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem;">Passengers</div>
            <div data-testid="detail-passengers">${passengers}</div>
          </div>
          <div>
            <div style="font-size:.75rem;font-weight:600;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem;">Cabin class</div>
            <div data-testid="detail-class">${cabinClass}</div>
          </div>
          <div>
            <div style="font-size:.75rem;font-weight:600;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem;">Trip type</div>
            <div data-testid="detail-trip-type" style="text-transform:capitalize;">${tripType}</div>
          </div>
        </div>
      </div>

      <!-- Price breakdown -->
      <div class="passenger-card" style="margin-bottom:2rem;" data-testid="price-breakdown">
        <h2 class="passenger-heading">Price breakdown</h2>
        <div style="display:flex;flex-direction:column;gap:.75rem;">
          <div style="display:flex;justify-content:space-between;">
            <span>Base fare × ${passengers}</span>
            <span data-testid="price-base">${formatPrice(flight.price)} × ${passengers}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>Taxes &amp; fees</span>
            <span data-testid="price-taxes">Included</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:1.25rem;font-weight:800;border-top:2px solid var(--border);padding-top:.75rem;">
            <span>Total</span>
            <span style="color:var(--gold);font-family:'Playfair Display',Georgia,serif;" data-testid="price-total">${formatPrice(totalPrice)}</span>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:flex-end;">
        <a
          href="results?${buildQuery({origin,destination,departDate,passengers:passengers.toString(),cabinClass,tripType})}"
          class="btn"
          style="background:var(--border);color:var(--fg);"
          data-testid="btn-back-results"
        >Back to results</a>
        <a
          href="passengers?${buildQuery({flightId,origin,destination,departDate,passengers:passengers.toString(),cabinClass,tripType})}"
          class="btn btn-search"
          data-testid="btn-continue-passengers"
          aria-label="Continue to passenger details"
        >Continue →</a>
      </div>
    `;
  } catch (err) {
    renderError(container, 'Could not load flight details. Please go back and try again.');
  }
});
