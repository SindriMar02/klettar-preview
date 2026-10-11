/* Klettar (Twin Villas pattern): intro, door open into each building's own
   page, scroll flow (Lenis + GSAP ScrollTrigger, vendored, optional: the page
   works without them), reveals, and the dates that deep-link into the
   owners' own booking engine. Runs on index.html, tower.html and hatchery.html. */
(() => {
  document.documentElement.classList.add('app-ready');
  const hero = document.querySelector('.hero');
  const doors = document.querySelector('.doors');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ---------- MOTION: Lenis + GSAP ScrollTrigger ----------
     Every effect has a job and none pins or hijacks the scroll (Sindri's
     simple-and-navigable rule): the wheel is smoothed on desktop only (phones
     keep native scrolling; Lenis on touch broke iOS Safari's toolbar on Dæli);
     leaving the doors, the photos sink slower than the page while the type
     lifts away faster; full-bleed photos settle from a slight zoom to their
     whole frame; offset photos drift against the text; the other building's
     photo moves inside its door; anchor jumps glide. Triggers are never the
     elements that move (a moved trigger fires late). Reduced motion: none. */
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let lenis = null;
  if (!reduce.matches && G && ST) {
    G.registerPlugin(ST);
    // iOS collapses its URL bar as a scroll starts; a refresh mid-fling kills
    // the momentum, so height-only resizes on touch never reach ScrollTrigger.
    ST.config({ ignoreMobileResize: true });
    if (fine && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 1, autoRaf: false });
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
    }
    G.ticker.lagSmoothing(0);
    // Native scroll events on iOS arrive out of step with rendering: a small lag.
    const SCRUB = fine ? true : 0.35;
    const vh = () => window.innerHeight;
    const leave = (trigger) => ({ trigger, start: 'top top', end: 'bottom top', scrub: SCRUB, invalidateOnRefresh: true });

    if (hero && doors) {
      G.to(doors, { yPercent: 28, ease: 'none', scrollTrigger: leave(hero) });
      doors.querySelectorAll('.door-top').forEach((el) => {
        G.to(el, { y: () => -vh() * 0.12, ease: 'none', scrollTrigger: leave(hero) });
      });
    }
    const opener = document.querySelector('.door--opener');
    if (opener) {
      G.to(opener.querySelector('.door-media'), { yPercent: 22, ease: 'none', scrollTrigger: leave(opener) });
      G.to(opener.querySelector('.door-top'), { y: () => -vh() * 0.12, ease: 'none', scrollTrigger: leave(opener) });
    }
    document.querySelectorAll('.bleed-frame').forEach((frame) => {
      G.fromTo(frame.querySelector('img'), { scale: 1.12 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'center center', scrub: SCRUB },
      });
    });
    document.querySelectorAll('.px-drift').forEach((fig) => {
      G.fromTo(fig, { y: () => vh() * 0.1 }, {
        y: () => -vh() * 0.06, ease: 'none',
        scrollTrigger: { trigger: fig.parentElement, start: 'top bottom', end: 'bottom top', scrub: SCRUB, invalidateOnRefresh: true },
      });
    });
    const next = document.querySelector('.door--next');
    if (next) {
      G.fromTo(next.querySelector('.door-media'), { yPercent: -9 }, {
        yPercent: 9, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'bottom top', scrub: SCRUB },
      });
    }
    // Fonts and late images change heights after the first measure.
    if (document.fonts) document.fonts.ready.then(() => ST.refresh());
    window.addEventListener('load', () => ST.refresh());
  }

  /* Anchor jumps (Check dates, back to the doors, the skip link) glide through
     Lenis. Measure again first: lazy images may have changed the height since
     Lenis last looked, and a stale height clamps the jump short. */
  if (lenis) {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id === '#top' ? null : document.querySelector(id);
        if (id.length < 2 || (id !== '#top' && !target)) return;
        e.preventDefault();
        lenis.resize();
        // Keyboard activation (Enter, the skip link) lands at once: keyboard
        // actions never wait on an animation. Pointer clicks glide.
        const kb = e.detail === 0;
        const land = () => {
          const h = target && (target.matches('[tabindex="-1"]') ? target : target.querySelector('[tabindex="-1"]'));
          if (h) h.focus({ preventScroll: true });
        };
        lenis.scrollTo(target || 0, { immediate: kb, duration: 1.3, onComplete: land });
        if (kb) land();
      });
    });
  }

  /* ---------- INTRO (home only) ----------
     The curtain parts once both door photographs are decoded, but never later
     than 2.2s and never sooner than the seam has had time to draw. */
  const ready = () => {
    if (!hero || hero.classList.contains('is-ready')) return;
    hero.classList.add('is-ready');
    const curtain = hero.querySelector('.curtain');
    // Removed from the DOM afterwards: a parked full-screen layer is what tints
    // iOS Safari's toolbar long after it is invisible.
    if (curtain) setTimeout(() => curtain.remove(), 1600);
  };
  if (hero) {
    if (reduce.matches) {
      ready();
    } else {
      const imgs = [...hero.querySelectorAll('.door-media img')];
      const decoded = Promise.all(imgs.map((img) => img.decode().catch(() => {})));
      const minWait = new Promise((r) => setTimeout(r, 650));
      Promise.race([
        Promise.all([decoded, minWait]),
        new Promise((r) => setTimeout(r, 2200)),
      ]).then(ready);
    }
  }

  /* ---------- OPEN (home only) ----------
     Clicking a door grows it to the full hero, then loads that building's
     page, which opens on the same picture with the same type at the same size
     (a cross-document view transition crossfades the two identical frames).
     Keyboard (Enter = click with detail 0), reduced motion and modified clicks
     are plain links: no animation to wait for. */
  if (doors) {
    let busy = false;
    let lastDoor = null;
    const reset = () => {
      doors.classList.add('is-resetting');
      doors.classList.remove('is-opening');
      doors.querySelectorAll('.is-opened').forEach((d) => d.classList.remove('is-opened'));
      raf2(() => { doors.classList.remove('is-resetting'); busy = false; });
    };

    doors.addEventListener('click', (e) => {
      const door = e.target.closest('[data-door]');
      if (!door || busy) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduce.matches || e.detail === 0) return;   // the browser follows the link
      e.preventDefault();
      busy = true;
      lastDoor = door;
      if (lenis) lenis.stop();   // no scrolling while the door opens
      door.classList.add('is-opened');
      doors.classList.add('is-opening');

      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        door.removeEventListener('transitionend', onEnd);
        location.assign(door.href);
      };
      const onEnd = (ev) => { if (ev.target === door && ev.propertyName === 'flex-grow') go(); };
      door.addEventListener('transitionend', onEnd);
      setTimeout(go, 1000);   // safety net if transitionend never fires
    });

    // Back from a building's page restores this one from the back/forward
    // cache with the door still opened: snap it shut before it is seen, and
    // hand focus back to the door that was chosen.
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      reset();
      if (lenis) lenis.start();
      if (ST) ST.refresh();
      if (lastDoor) lastDoor.focus({ preventScroll: true });
    });
  }

  /* ---------- CHAPTER REVEALS ---------- */
  const rv = document.querySelectorAll('.rv');
  if (reduce.matches || !('IntersectionObserver' in window)) {
    rv.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    rv.forEach((el) => io.observe(el));
  }

  /* ---------- STAY: the SNDR stay picker ----------
     Two months, arrival then departure (assets/vendor/staypicker.js, the
     picker the other SNDR builds carry). On the homepage the guest also picks
     a building; on a building page it is fixed. The Continue link opens that
     building's room group in the owners' own bookvisit engine with the dates
     filled in: the engine reads roomconfig (a2 = 1 room, 2 adults), year, month,
     day and staylength from its URL (the URL its own search produces, checked
     2026-10-10). Without roomconfig it answers "no rooms" for dates it sells.
     Without dates it opens the same page with none. */
  const ENGINE = 'https://online.bookvisit.com/accommodation/room-group-info'
    + '?channelid=c7e4bfc4-0f25-4e29-9dbd-ae3606b6962a&roomtypegroupid=';
  const GROUP = {
    tower: '79936d2e-3bcb-46ec-8fcb-51c64a616cf6',
    hatchery: '6626e2e1-e11d-4634-bee1-7316fb8ac7a2',
  };
  const NAME = { tower: 'Klettar Tower', hatchery: 'The Old Hatchery' };
  const cal = document.getElementById('stayCal');
  const go = document.getElementById('stayGo');
  const sum = document.getElementById('staySum');
  if (cal && go && sum && window.createStayPicker) {
    const KEY = 'klettar-stay';
    const opts = [...document.querySelectorAll('.stay-opt')];
    let which = cal.dataset.key;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { /* no storage */ }
    if (opts.length && saved && GROUP[saved.k]) which = saved.k;   // only the homepage lets you switch
    const asDate = (s) => (s ? new Date(s + 'T00:00:00') : null);

    const L = {
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      checkIn: 'Arrival', checkOut: 'Departure', pickDate: 'Pick a date', afterCheckIn: 'After arrival',
      night: 'night', nights: 'nights', prevMonth: 'Previous month', nextMonth: 'Next month',
      empty: '', minStay: () => '', chosen: () => '',
    };
    let picker;
    const short = (d) => `${d.getDate()} ${L.months[d.getMonth()].slice(0, 3)}`;
    const sync = () => {
      const r = picker.get();
      let query = '';
      if (r.start && r.end) {
        const s = r.start;
        query = `&roomconfig=a2&year=${s.getFullYear()}&month=${s.getMonth() + 1}&day=${s.getDate()}&staylength=${r.nights}`;
        sum.textContent = `${r.nights} ${r.nights === 1 ? 'night' : 'nights'} in ${NAME[which]}, ${short(r.start)} to ${short(r.end)}.`;
        go.querySelector('.stay-go-t').textContent = `Continue with ${r.nights === 1 ? 'this night' : `these ${r.nights} nights`}`;
      } else {
        sum.textContent = r.start
          ? `Arriving ${picker.fmtLong(r.start)}. Now choose your departure.`
          : 'Choose your arrival, then your departure.';
        go.querySelector('.stay-go-t').textContent = 'Continue to Klettar’s booking page';
      }
      go.dataset.engine = which;
      go.href = ENGINE + GROUP[which] + query;
      try {
        sessionStorage.setItem(KEY, JSON.stringify({
          k: opts.length ? which : (saved && saved.k) || which,
          s: r.start ? picker.key(r.start) : null,
          e: r.end ? picker.key(r.end) : null,
        }));
      } catch (_) { /* private mode: the stay just doesn't carry over */ }
    };
    picker = window.createStayPicker({
      mount: cal, prefix: 'kl-stay', minStay: 1, L, onChange: sync,
      start: saved && asDate(saved.s), end: saved && asDate(saved.e),
    });
    const mark = () => opts.forEach((b) => {
      const on = b.dataset.key === which;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    opts.forEach((b) => b.addEventListener('click', () => { which = b.dataset.key; mark(); sync(); }));
    mark();
    sync();
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return; }
      if (opts.length && saved && GROUP[saved.k]) which = saved.k;
      picker.set(saved && asDate(saved.s), saved && asDate(saved.e));
      mark();
      sync();
    });
  }
})();
