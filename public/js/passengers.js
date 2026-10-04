// ============================================================
// Luxfly -  Passengers Page Logic
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await waitForMSW();
  renderAuthNav();
  const p             = getParams();
  const flightId      = p.get('flightId');
  const adults        = parseInt(p.get('adultsCount')   || p.get('passengers') || '1', 10);
  const children      = parseInt(p.get('childrenCount') || '0', 10);
  const infants       = parseInt(p.get('infantsCount')  || '0', 10);
  const totalPax      = adults + children + infants;
  const cabinClass    = p.get('cabinClass')  || 'Economy';
  const origin        = p.get('origin')      || '';
  const destination   = p.get('destination') || '';
  const departDate    = p.get('departDate')  || '';
  const tripType      = p.get('tripType')    || 'one-way';

  const fieldsEl  = document.getElementById('passengers-fields');
  const form      = document.getElementById('passengers-form');
  const backBtn   = document.getElementById('btn-back');

  backBtn.addEventListener('click', () => history.back());

  // ── Fare summary (with promo apply) ───────────────────────
  let flightPrice  = null;
  let flightData   = null;
  let allCoupons   = [];           // all eligible coupons for this user
  let appliedCoupon = null;        // currently applied coupon object
  let baseTotal    = 0;            // total before any discount

  try {
    flightData  = await getFlight(flightId);
    flightPrice = flightData?.price ?? null;
  } catch (_) {}

  if (flightData && flightPrice !== null) {
    const childPrice  = Math.round(flightPrice * 0.75);
    const infantPrice = Math.round(flightPrice * 0.1);
    baseTotal = (adults * flightPrice) + (children * childPrice) + (infants * infantPrice);

    const fareHtml = `
      <div class="passenger-card" id="fare-summary-card" data-testid="fare-summary-card"
        style="margin-bottom:1.5rem;background:color-mix(in srgb, var(--gold) 8%, var(--surface));border-color:color-mix(in srgb, var(--gold) 40%, transparent);">
        <h2 class="passenger-heading" style="color:var(--gold);font-family:'Playfair Display',Georgia,serif;">Fare summary</h2>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:0.9rem;color:var(--fg);">
          <div style="display:flex;justify-content:space-between;color:var(--gold);font-size:0.82rem;margin-bottom:6px;font-weight:600;">
            <span>${flightData.airline} ${flightData.flightNumber} &middot; ${cabinClass}</span>
          </div>
          ${adults   ? `<div style="display:flex;justify-content:space-between;color:var(--fg-mid);"><span>${adults} adult${adults !== 1 ? 's' : ''} &times; ${formatPrice(flightPrice)}</span><span><strong style="color:var(--fg);">${formatPrice(adults * flightPrice)}</strong></span></div>` : ''}
          ${children ? `<div style="display:flex;justify-content:space-between;color:var(--fg-mid);"><span>${children} child${children !== 1 ? 'ren' : ''} &times; ${formatPrice(childPrice)} (75%)</span><span><strong style="color:var(--fg);">${formatPrice(children * childPrice)}</strong></span></div>` : ''}
          ${infants  ? `<div style="display:flex;justify-content:space-between;color:var(--fg-mid);"><span>${infants} infant${infants !== 1 ? 's' : ''} &times; ${formatPrice(infantPrice)} (10%)</span><span><strong style="color:var(--fg);">${formatPrice(infants * infantPrice)}</strong></span></div>` : ''}

          <!-- Discount row (hidden until applied) -->
          <div id="discount-row" style="display:none;justify-content:space-between;color:#16a34a;font-size:0.88rem;">
            <span id="discount-label">Promo discount</span>
            <span id="discount-amount" style="font-weight:700;"></span>
          </div>

          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;font-size:1rem;">
            <span style="font-weight:700;">Estimated total</span>
            <span id="fare-total" style="font-weight:800;color:var(--gold);font-family:'Playfair Display',Georgia,serif;font-size:1.2rem;" data-testid="fare-total">${formatPrice(baseTotal)}</span>
          </div>
          <p style="font-size:0.78rem;color:var(--fg-muted);margin-top:2px;">Prices in AUD, inclusive of taxes and fees.</p>

          <!-- Promo code entry -->
          <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
            <label for="promo-input" style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--fg-muted);display:block;margin-bottom:6px;">Promo / offer code</label>
            <div style="display:flex;gap:8px;align-items:stretch;">
              <input id="promo-input" type="text" placeholder="e.g. WELCOME10"
                data-testid="promo-input"
                style="flex:1;padding:9px 12px;font-size:0.88rem;font-family:var(--body);
                       border:1.5px solid var(--border);border-radius:8px;background:var(--bg);
                       color:var(--fg);outline:none;text-transform:uppercase;letter-spacing:0.05em;" />
              <button id="promo-apply-btn" type="button" data-testid="promo-apply-btn"
                style="padding:9px 18px;background:var(--navy);color:#fff;border:none;border-radius:8px;
                       font-size:0.88rem;font-weight:600;font-family:var(--body);cursor:pointer;
                       white-space:nowrap;transition:background 0.2s;">Apply</button>
            </div>
            <div id="promo-msg" style="font-size:0.8rem;margin-top:6px;min-height:1em;" aria-live="polite" data-testid="promo-msg"></div>
          </div>
        </div>
      </div>`;

    fieldsEl.insertAdjacentHTML('beforebegin', fareHtml);

    // Wire up promo apply
    const promoInput    = document.getElementById('promo-input');
    const promoApplyBtn = document.getElementById('promo-apply-btn');
    const promoMsg      = document.getElementById('promo-msg');
    const fareTotal     = document.getElementById('fare-total');
    const discountRow   = document.getElementById('discount-row');
    const discountLabel = document.getElementById('discount-label');
    const discountAmt   = document.getElementById('discount-amount');

    function applyPromoCode(code) {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) {
        promoMsg.style.color = '#ef4444';
        promoMsg.textContent = 'Please enter a promo code.';
        return;
      }
      const match = allCoupons.find(c => c.code.toUpperCase() === trimmed);
      if (!match) {
        promoMsg.style.color = '#ef4444';
        promoMsg.textContent = 'Code not found or not valid for your account.';
        appliedCoupon = null;
        discountRow.style.display = 'none';
        fareTotal.textContent = formatPrice(baseTotal);
        return;
      }

      // Compute discounted total
      let discountAbs = 0;
      let newTotal = baseTotal;
      if (match.discountType === 'percentage') {
        discountAbs = Math.round(baseTotal * match.discountValue / 100);
        newTotal    = baseTotal - discountAbs;
      } else if (match.discountType === 'fixed') {
        discountAbs = Math.min(match.discountValue, baseTotal);
        newTotal    = baseTotal - discountAbs;
      } else if (match.discountType === 'upgrade') {
        // Upgrade type -  no price change, just a perk
        discountAbs = 0;
        newTotal    = baseTotal;
      }

      appliedCoupon = { ...match, discountAbs };

      // Update fare summary UI
      discountLabel.textContent = `${match.code} -  ${match.description}`;
      discountAmt.textContent   = match.discountType === 'upgrade'
        ? 'Complimentary upgrade applied'
        : `−${formatPrice(discountAbs)}`;
      discountRow.style.display  = 'flex';
      fareTotal.textContent      = formatPrice(newTotal);
      promoInput.value           = match.code;
      promoInput.style.borderColor = '#16a34a';
      promoApplyBtn.textContent  = 'Applied ✓';
      promoApplyBtn.style.background = '#16a34a';
      promoMsg.style.color       = '#16a34a';
      promoMsg.textContent       = match.discountType === 'upgrade'
        ? `✓ ${match.description}`
        : `✓ ${match.discountValue}${match.discountType === 'percentage' ? '%' : ' AUD'} discount applied -  you save ${formatPrice(discountAbs)}!`;
    }

    promoApplyBtn.addEventListener('click', () => applyPromoCode(promoInput.value));
    promoInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(promoInput.value); } });
    promoInput.addEventListener('input', () => {
      // Reset to un-applied state on edit
      if (appliedCoupon) {
        appliedCoupon = null;
        discountRow.style.display = 'none';
        fareTotal.textContent = formatPrice(baseTotal);
        promoInput.style.borderColor = '';
        promoApplyBtn.textContent = 'Apply';
        promoApplyBtn.style.background = '';
        promoMsg.textContent = '';
      }
    });
  }

  // ── Coupon strip for logged-in users ──────────────────────
  const user = getCurrentUser();
  if (user) {
    try {
      allCoupons = await getCoupons(user.role);
      if (allCoupons.length > 0) {
        const strip = document.createElement('div');
        strip.className = 'coupon-strip';
        strip.setAttribute('data-testid', 'coupon-strip');
        strip.innerHTML = `
          <div class="coupon-strip-heading">Your exclusive offers</div>
          ${allCoupons.map(c => `
            <div class="coupon-card" data-testid="coupon-card-${c.id}">
              <span class="coupon-icon" aria-hidden="true">🏷️</span>
              <div class="coupon-body">
                <div class="coupon-code" data-code="${c.code}" data-testid="coupon-code-${c.id}">${c.code}</div>
                <div class="coupon-desc">${c.description}</div>
                <div class="coupon-terms">${c.terms}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
                <span class="coupon-badge">${c.discountType === 'percentage' ? c.discountValue + '% off' : c.discountType === 'fixed' ? '$' + c.discountValue + ' off' : 'Upgrade'}</span>
                <button class="coupon-apply-btn" data-code="${c.code}" data-testid="coupon-apply-${c.id}"
                  type="button" style="font-size:0.75rem;font-weight:600;padding:4px 12px;border-radius:6px;
                  border:1.5px solid var(--gold);background:transparent;color:var(--gold);cursor:pointer;
                  font-family:var(--body);white-space:nowrap;transition:all 0.15s;">Apply</button>
              </div>
            </div>`).join('')}`;

        // Insert before the fare summary card
        const fareSummary = document.getElementById('fare-summary-card');
        if (fareSummary) {
          fareSummary.parentElement.insertBefore(strip, fareSummary);
        } else {
          fieldsEl.parentElement.insertBefore(strip, fieldsEl.previousElementSibling || fieldsEl);
        }

        // Copy-on-click for coupon code text
        strip.querySelectorAll('.coupon-code[data-code]').forEach(el => {
          el.title = 'Click to copy';
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => {
            navigator.clipboard.writeText(el.dataset.code).catch(() => {});
            const orig = el.textContent;
            el.textContent = 'Copied!';
            setTimeout(() => { el.textContent = orig; }, 1500);
          });
        });

        // Apply button: fills the promo input and triggers apply
        strip.querySelectorAll('.coupon-apply-btn[data-code]').forEach(btn => {
          btn.addEventListener('click', () => {
            const promoInput = document.getElementById('promo-input');
            if (promoInput) {
              promoInput.value = btn.dataset.code;
              // Reset applied state so applyPromoCode runs fresh
              const applyBtn = document.getElementById('promo-apply-btn');
              if (applyBtn) applyBtn.click();
            }
          });
        });
      }
    } catch (_) {}
  }

  // ── Build passenger cards ──────────────────────────────────
  const paxList = [
    ...Array.from({ length: adults },   (_, i) => ({ type: 'adult',  label: 'Adult',  badge: 'badge-adult',  idx: i })),
    ...Array.from({ length: children }, (_, i) => ({ type: 'child',  label: 'Child',  badge: 'badge-child',  idx: i })),
    ...Array.from({ length: infants },  (_, i) => ({ type: 'infant', label: 'Infant', badge: 'badge-infant', idx: i })),
  ];

  const today = todayISO();

  fieldsEl.innerHTML = paxList.map((pax, i) => {
    const n = i + 1;
    const isInfant = pax.type === 'infant';
    const isChild  = pax.type === 'child';

    // Infants: no passport required; title simplified
    const titleOptions = isInfant
      ? `<option value="Mstr">Mstr</option><option value="Miss">Miss</option>`
      : `<option value="Mr">Mr</option><option value="Ms">Ms</option><option value="Mrs">Mrs</option><option value="Dr">Dr</option><option value="Mx">Mx</option>`;

    // Pre-fill with plausible demo data so the form isn't blank in a workshop
    const demoFirstNames = ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Casey', 'Taylor', 'Drew'];
    const demoLastNames  = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    const demoFirst = i === 0 ? '' : demoFirstNames[i % demoFirstNames.length];
    const demoLast  = i === 0 ? '' : demoLastNames[i % demoLastNames.length];

    return `
    <div class="passenger-card" data-testid="passenger-card-${n}" data-pax-type="${pax.type}">
      <h2 class="passenger-heading">
        Passenger ${n}
        <span class="passenger-type-badge ${pax.badge}" data-testid="pax-type-badge-${n}">${pax.label}</span>
      </h2>
      <div class="passenger-fields">

        <div class="field-group" data-testid="field-title-${n}">
          <label for="title-${n}" class="field-label">Title</label>
          <div class="select-wrapper">
            <select id="title-${n}" name="title_${n}" class="field-select"
              aria-label="Title for passenger ${n}"
              data-testid="select-title-${n}">${titleOptions}</select>
          </div>
        </div>

        <div class="field-group" data-testid="field-firstname-${n}">
          <label for="first-${n}" class="field-label">First name</label>
          <input type="text" id="first-${n}" name="firstName_${n}" class="field-input"
            placeholder="Given name" value="${demoFirst}"
            autocomplete="${i === 0 ? 'given-name' : 'off'}"
            aria-required="true" aria-describedby="first-err-${n}"
            data-testid="input-firstname-${n}" />
          <span id="first-err-${n}" class="field-error" role="alert" aria-live="polite" data-testid="error-firstname-${n}"></span>
        </div>

        <div class="field-group" data-testid="field-lastname-${n}">
          <label for="last-${n}" class="field-label">Last name</label>
          <input type="text" id="last-${n}" name="lastName_${n}" class="field-input"
            placeholder="Family name" value="${demoLast}"
            autocomplete="${i === 0 ? 'family-name' : 'off'}"
            aria-required="true" aria-describedby="last-err-${n}"
            data-testid="input-lastname-${n}" />
          <span id="last-err-${n}" class="field-error" role="alert" aria-live="polite" data-testid="error-lastname-${n}"></span>
        </div>

        <div class="field-group" data-testid="field-dob-${n}">
          <label for="dob-${n}" class="field-label">Date of birth</label>
          <input type="date" id="dob-${n}" name="dob_${n}" class="field-input"
            aria-required="true" aria-describedby="dob-err-${n}"
            data-testid="input-dob-${n}" />
          <span id="dob-err-${n}" class="field-error" role="alert" aria-live="polite" data-testid="error-dob-${n}"></span>
        </div>

        ${!isInfant ? `
        <div class="field-group" data-testid="field-passport-${n}">
          <label for="passport-${n}" class="field-label">Passport / ID number</label>
          <input type="text" id="passport-${n}" name="passport_${n}" class="field-input"
            placeholder="e.g. PA1234567"
            aria-required="true" aria-describedby="passport-err-${n}"
            data-testid="input-passport-${n}" />
          <span id="passport-err-${n}" class="field-error" role="alert" aria-live="polite" data-testid="error-passport-${n}"></span>
        </div>` : `<input type="hidden" id="passport-${n}" name="passport_${n}" value="N/A-INFANT">`}

        <div class="field-group" data-testid="field-nationality-${n}">
          <label for="nationality-${n}" class="field-label">Nationality</label>
          <div class="select-wrapper">
            <select id="nationality-${n}" name="nationality_${n}" class="field-select"
              aria-label="Nationality for passenger ${n}"
              data-testid="select-nationality-${n}">
              <option value="AU">Australian</option>
              <option value="NZ">New Zealander</option>
              <option value="GB">British</option>
              <option value="US">American</option>
              <option value="IN">Indian</option>
              <option value="SG">Singaporean</option>
              <option value="JP">Japanese</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

      </div>
    </div>`;
  }).join('');

  // ── Form submit ────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) return;

    const submitBtn = form.querySelector('[data-testid="btn-confirm-booking"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
      const passengerList = paxList.map((pax, i) => {
        const n = i + 1;
        return {
          type:        pax.type,
          title:       form[`title_${n}`]?.value || '',
          firstName:   form[`firstName_${n}`].value.trim(),
          lastName:    form[`lastName_${n}`].value.trim(),
          dob:         form[`dob_${n}`].value,
          passport:    form[`passport_${n}`]?.value?.trim() || 'N/A',
          nationality: form[`nationality_${n}`]?.value || 'AU',
        };
      });

      const ref = generateRef();

      const booking = {
        id:             ref,
        flightId,
        origin,
        destination,
        departDate,
        tripType,
        cabinClass,
        adultsCount:    adults,
        childrenCount:  children,
        infantsCount:   infants,
        passengers:     passengerList,
        contactEmail:   form['contactEmail'].value.trim(),
        contactPhone:   form['contactPhone']?.value?.trim() || '',
        bookedAt:       new Date().toISOString(),
        status:         'confirmed',
        promoCode:      appliedCoupon?.code      || null,
        discountAmount: appliedCoupon?.discountAbs || 0,
        finalTotal:     appliedCoupon
          ? baseTotal - (appliedCoupon.discountAbs || 0)
          : baseTotal,
      };

      await createBooking(booking);

      const query = buildQuery({
        ref,
        flightId,
        origin,
        destination,
        departDate,
        passengers:    String(totalPax),
        adultsCount:   String(adults),
        childrenCount: String(children),
        infantsCount:  String(infants),
        cabinClass,
      });
      window.location.href = `confirmation?${query}`;

    } catch (err) {
      alert('Booking failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm booking';
    }
  });

  // ── Validation ─────────────────────────────────────────────
  function validate() {
    let ok = true;
    const today = todayISO();

    paxList.forEach((pax, i) => {
      const n  = i + 1;
      const fn = document.getElementById(`first-${n}`);
      const ln = document.getElementById(`last-${n}`);
      const db = document.getElementById(`dob-${n}`);
      const pp = document.getElementById(`passport-${n}`);

      if (!fn.value.trim()) { setErr(`first-err-${n}`, 'First name is required.');    fn.classList.add('is-error'); ok = false; }
      else                  { clearErr(`first-err-${n}`); fn.classList.remove('is-error'); }

      if (!ln.value.trim()) { setErr(`last-err-${n}`, 'Last name is required.');      ln.classList.add('is-error'); ok = false; }
      else                  { clearErr(`last-err-${n}`); ln.classList.remove('is-error'); }

      if (!db.value)             { setErr(`dob-err-${n}`, 'Date of birth is required.'); db.classList.add('is-error'); ok = false; }
      else if (db.value >= today) { setErr(`dob-err-${n}`, 'Date of birth must be in the past.'); db.classList.add('is-error'); ok = false; }
      else                        { clearErr(`dob-err-${n}`); db.classList.remove('is-error'); }

      // Passport not required for infants
      if (pax.type !== 'infant' && pp && !pp.value.trim()) {
        setErr(`passport-err-${n}`, 'Passport / ID number is required.'); pp.classList.add('is-error'); ok = false;
      } else if (pp) { clearErr(`passport-err-${n}`); pp.classList.remove('is-error'); }
    });

    // Contact
    const emailEl = document.getElementById('contact-email');
    if (!emailEl.value.trim()) {
      setErr('email-err', 'Email address is required.'); emailEl.classList.add('is-error'); ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
      setErr('email-err', 'Enter a valid email address.'); emailEl.classList.add('is-error'); ok = false;
    } else {
      clearErr('email-err'); emailEl.classList.remove('is-error');
    }

    return ok;
  }

  function setErr(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }
  function clearErr(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  }
});
