// ============================================================
// Luxfly - MSW Request Handlers
// Intercepts /api/* fetch calls and serves from _DB in-memory store.
// This file is loaded AFTER app.js so _DB is available.
// ============================================================

(function () {
  // Wait for MSW to be available (loaded via CDN in HTML)
  if (typeof window.__mswReady === 'undefined') {
    window.__mswReady = false;
  }

  const { http, HttpResponse } = window.MockServiceWorker;

  const handlers = [

    // GET /api/airports
    http.get('/api/airports', () => {
      return HttpResponse.json(_DB.airports);
    }),

    // GET /api/flights?origin=&destination=&cabinClass=
    http.get('/api/flights', ({ request }) => {
      const url = new URL(request.url);
      const origin      = url.searchParams.get('origin')      || '';
      const destination = url.searchParams.get('destination') || '';
      const cabinClass  = url.searchParams.get('cabinClass')  || '';
      let flights = _DB.flights;
      if (origin)      flights = flights.filter(f => f.origin === origin);
      if (destination) flights = flights.filter(f => f.destination === destination);
      if (cabinClass)  flights = flights.filter(f =>
        Array.isArray(f.class) ? f.class.includes(cabinClass) : f.class === cabinClass
      );
      return HttpResponse.json(flights);
    }),

    // GET /api/flights/:id
    http.get('/api/flights/:id', ({ params }) => {
      const flight = _DB.flights.find(f => f.id === params.id);
      if (!flight) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json(flight);
    }),

    // GET /api/bookings  (all, for admin/agent)
    http.get('/api/bookings', () => {
      return HttpResponse.json(_DB.bookings);
    }),

    // POST /api/bookings
    http.post('/api/bookings', async ({ request }) => {
      const body   = await request.json();
      const saved  = { ...body, id: body.id || ('BK' + Date.now()), bookedAt: body.bookedAt || new Date().toISOString() };
      _DB.bookings.push(saved);
      try {
        const SEED_IDS = new Set(['BK001','BK002','BK003','BK004','BK005']);
        const toStore = _DB.bookings.filter(b => !SEED_IDS.has(b.id));
        localStorage.setItem('lf_bookings', JSON.stringify(toStore));
      } catch (_) {}
      return HttpResponse.json(saved, { status: 201 });
    }),

    // GET /api/users  (admin only)
    http.get('/api/users', () => {
      return HttpResponse.json(_DB.users.map(({ password: _pw, ...u }) => u));
    }),

    // POST /api/auth/login
    http.post('/api/auth/login', async ({ request }) => {
      const { email, password } = await request.json();
      const user = _DB.users.find(u => u.email === email && u.password === password);
      if (!user) return HttpResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      const { password: _pw, ...safe } = user;
      return HttpResponse.json(safe);
    }),

    // POST /api/auth/register
    http.post('/api/auth/register', async ({ request }) => {
      const data = await request.json();
      if (_DB.users.find(u => u.email === data.email)) {
        return HttpResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
      }
      const newUser = { id: 'U' + Date.now(), createdAt: new Date().toISOString(), ...data };
      _DB.users.push(newUser);
      const { password: _pw, ...safe } = newUser;
      return HttpResponse.json(safe, { status: 201 });
    }),

    // GET /api/coupons?role=
    http.get('/api/coupons', ({ request }) => {
      const url  = new URL(request.url);
      const role = url.searchParams.get('role') || '';
      const coupons = role
        ? _DB.coupons.filter(c => c.active && Array.isArray(c.applicableRoles) && c.applicableRoles.includes(role))
        : _DB.coupons;
      return HttpResponse.json(coupons);
    }),
  ];

  // Start the service worker
  const { setupWorker } = window.MockServiceWorker;
  const worker = setupWorker(...handlers);

  worker.start({
    onUnhandledRequest: 'bypass',   // pass through anything not in handlers (CDN, fonts, etc.)
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  }).then(() => {
    window.__mswReady = true;
    window.dispatchEvent(new Event('msw:ready'));
  }).catch(err => {
    console.warn('[MSW] Failed to start service worker:', err);
  });

  // Expose worker so Playwright can call worker.resetHandlers(), worker.use(), etc.
  window.__mswWorker = worker;
})();
