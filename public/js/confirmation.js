// ============================================================
// Luxfly -  Confirmation Page Logic
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await waitForMSW();
  renderAuthNav();
  const p           = getParams();
  const ref         = p.get('ref');
  const flightId    = p.get('flightId');
  const origin      = p.get('origin')      || '';
  const destination = p.get('destination') || '';
  const departDate  = p.get('departDate')  || '';
  const cabinClass  = p.get('cabinClass')  || 'Economy';

  const adults   = parseInt(p.get('adultsCount')   || '1', 10);
  const children = parseInt(p.get('childrenCount') || '0', 10);
  const infants  = parseInt(p.get('infantsCount')  || '0', 10);
  const totalPax = adults + children + infants || parseInt(p.get('passengers') || '1', 10);

  const refEl     = document.getElementById('booking-ref');
  const detailsEl = document.getElementById('confirmation-details');

  // Show itinerary reference
  refEl.textContent = ref || ' - ';

  // Fill details
  try {
    const flight  = await getFlight(flightId);
    const airports = await getAirports();
    const airportMap = Object.fromEntries(airports.map(a => [a.id, a]));

    const origCity = airportMap[origin]?.city      || origin;
    const destCity = airportMap[destination]?.city || destination;

    // Passenger breakdown label
    const paxParts = [];
    if (adults)   paxParts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
    if (children) paxParts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
    if (infants)  paxParts.push(`${infants} infant${infants !== 1 ? 's' : ''}`);
    const paxLabel = paxParts.join(', ') || `${totalPax} passenger${totalPax !== 1 ? 's' : ''}`;

    detailsEl.innerHTML = `
      <strong>${origCity} → ${destCity}</strong><br>
      ${formatDate(departDate)} · ${flight.airline} ${flight.flightNumber}<br>
      ${paxLabel} · ${cabinClass}
    `;

    // Payment notice
    const paymentNotice = document.getElementById('payment-notice');
    if (paymentNotice) paymentNotice.hidden = false;

    // Update page title
    document.title = `Booking ${ref} -  Luxfly`;

  } catch (err) {
    detailsEl.textContent = `Flight ${origin} → ${destination} on ${formatDate(departDate)} · ${totalPax} passenger${totalPax !== 1 ? 's' : ''} · ${cabinClass}`;
  }
});
