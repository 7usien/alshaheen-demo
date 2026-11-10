/* =========================================================================
   Dar Al-Shaheen: homepage mockup behaviour (Task 1.1).
   Vanilla JS, no jQuery. Loaded with defer after GSAP 3.15.0 + ScrollTrigger (motion only, section 8).
   Every feature works when GSAP is missing.
   Parts marked "MOCKUP ONLY" exist to compare options and are not shipped.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');
  var isRTL = root.dir === 'rtl';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 1024px)');
  var I18N = readJSON('page-i18n') || {};
  var phone = window.matchMedia('(max-width: 767px)');

  /* Global motion switch (WCAG 2.2.2). html.motion-paused freezes every CSS animation (see CSS section 23); each JS loop
     registers a hook (hero autoplay + Ken Burns, team carousels) and also checks MOTION.paused itself.
     The choice is remembered in localStorage (wrapped: it can be blocked). Wired at the end of this file. */
  var MOTION = {
    paused: false,
    hooks: [],
    set: function (p, save) {
      MOTION.paused = !!p;
      root.classList.toggle('motion-paused', MOTION.paused);
      if (save) { try { window.localStorage.setItem('ds-motion', MOTION.paused ? 'paused' : 'play'); } catch (e) { /* storage blocked */ } }
      MOTION.hooks.forEach(function (fn) { fn(MOTION.paused); });
    }
  };
  try { MOTION.paused = window.localStorage.getItem('ds-motion') === 'paused'; } catch (e) { /* storage blocked */ }
  root.classList.toggle('motion-paused', MOTION.paused);

  function readJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  function fmt(str, map) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#ph-' + name + '"></use></svg>';
  }

  /* ---------- 1. Years of experience and copyright year ---------- */
  var year = new Date().getFullYear();
  Array.prototype.forEach.call(document.querySelectorAll('[data-founded]'), function (el) {
    var founded = parseInt(el.getAttribute('data-founded'), 10);
    if (founded) el.textContent = String(Math.max(1, year - founded));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) { el.textContent = String(year); });

  /* ---------- 2. Header shadow on scroll (no height change, so no layout shift) ---------- */
  var header = document.getElementById('site-header');
  if (header) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 3. Mobile menu: Esc closes, focus returns to the button, focus stays inside ----------
     While open, everything behind the menu is inert (no Tab, no clicks, hidden from screen readers) and Tab cycles through the
     panel links and then the toggle (DOM order). The toggle keeps one static label ("Menu"); aria-expanded carries the state. */
  var toggle = document.querySelector('.menu-toggle');
  var panel = document.getElementById('site-menu');
  if (toggle && panel) {
    var focusables = function () {
      return Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled])')).concat([toggle])
        .filter(function (el) { return el.offsetParent !== null; });
    };
    var behind = function () {
      return Array.prototype.slice.call(document.querySelectorAll('.topbar, .site-header .logo, .mainbar__actions > :not(.menu-toggle), main, .site-footer, .fab, [data-motion-toggle]'));
    };
    var openMenu = function () {
      panel.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      root.classList.add('menu-open');
      behind().forEach(function (el) { el.setAttribute('inert', ''); });
      var first = panel.querySelector('a[href]');
      if (first) first.focus();
      document.addEventListener('keydown', onMenuKey);
    };
    var closeMenu = function (returnFocus) {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      root.classList.remove('menu-open');
      behind().forEach(function (el) { el.removeAttribute('inert'); });
      document.removeEventListener('keydown', onMenuKey);
      if (returnFocus) toggle.focus();
    };
    var onMenuKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
      if (e.key !== 'Tab') return;
      var list = focusables();
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closeMenu(true); else openMenu();
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a[href^="#"]')) closeMenu(false);
    });
    desktop.addEventListener('change', function (e) { if (e.matches) closeMenu(false); });
  }

  /* ---------- 4. Hero (v3): cinematic slideshow + glass project navigator ----------
     Change = ONE GSAP timeline: an ink veil and then the next photo are revealed by a diagonal clip-path mask
     that travels in the reading direction (mirrored in RTL, reversed for "previous"), while the incoming photo
     settles from a slow scale and the card text lines stagger in. Autoplay 6s with a progress ring.
     Pauses on hover, keyboard focus, hidden tab and when the hero is off screen.
     Reduced motion: no autoplay, instant swap. No GSAP: CSS crossfade, controls still work. */
  var hero = document.querySelector('[data-hero]');
  var HERO = readJSON('hero-data');
  if (hero && HERO && HERO.length > 1) {
    var slides = hero.querySelectorAll('[data-hero-slide]');
    var thumbs = hero.querySelectorAll('.hero-thumb');
    var heroToggle = hero.querySelector('[data-hero-toggle]');
    var heroPrev = hero.querySelector('[data-hero-prev]');
    var heroNext = hero.querySelector('[data-hero-next]');
    var heroNav = hero.querySelector('[data-hero-nav]');
    var heroNow = hero.querySelector('[data-hero-now]');
    var heroStatus = hero.querySelector('[data-hero-status]');
    var heroCard = hero.querySelector('[data-hero-card]');
    var heroThumb = hero.querySelector('[data-hero-thumb]');
    var heroIcon = hero.querySelector('[data-hero-icon]');
    var heroCat = hero.querySelector('[data-hero-cat]');
    var heroSite = hero.querySelector('[data-hero-site]');
    var heroLinks = hero.querySelectorAll('[data-hero-link]');
    var heroNames = hero.querySelectorAll('[data-hero-name]');
    var veil = hero.querySelector('.hero__veil');
    var N = slides.length;
    var DURATION = 6000;
    var h = { i: 0, elapsed: 0, last: 0, userPaused: reduceMotion.matches, hover: false, focus: false, inView: true, tl: null, kb: null };
    var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var imgOf = function (k) { return slides[k].querySelector('img'); };
    var motionOK = function () { return !!(window.gsap && window.gsap.timeline) && !reduceMotion.matches; };
    var setMotionClass = function () { hero.classList.toggle('hero--motion', motionOK()); };
    setMotionClass();

    var loadSlide = function (k) {
      var im = imgOf((k + N) % N);
      if (im.hasAttribute('data-src')) {
        im.srcset = im.getAttribute('data-srcset');
        im.src = im.getAttribute('data-src');
        im.removeAttribute('data-src');
        im.removeAttribute('data-srcset');
      }
    };
    var isReady = function (k) { var im = imgOf(k); return !im.hasAttribute('data-src') && im.complete && im.naturalWidth > 0; };
    var setRing = function (p) { heroToggle.style.setProperty('--ring', String(Math.max(0, Math.min(1, p)))); };

    // Counter + thumbnails update at once; the card text is swapped mid-timeline.
    var markActive = function (k) {
      if (heroNow) heroNow.textContent = pad2(k + 1);
      Array.prototype.forEach.call(thumbs, function (tb, n) {
        tb.classList.toggle('is-active', n === k);
        if (n === k) tb.setAttribute('aria-current', 'true'); else tb.removeAttribute('aria-current');
      });
    };
    var fillCard = function (k) {
      var d = HERO[k];
      Array.prototype.forEach.call(heroLinks, function (a) { a.href = d.url; });
      Array.prototype.forEach.call(heroNames, function (el) { el.textContent = d.name; });
      if (heroCat) heroCat.textContent = d.cat || '';
      if (heroSite) { heroSite.textContent = d.site || ''; heroSite.parentNode.hidden = !d.site; }
      if (heroIcon && d.icon) heroIcon.setAttribute('href', '#phd-' + d.icon);
      if (heroThumb && d.thumb) heroThumb.src = d.thumb;
    };

    // Diagonal mask: p 0 = hidden, 1 = full. fromRight = the edge the reveal starts from.
    var SLANT = 18;
    var mask = function (p, fromRight) {
      var a = p * (100 + SLANT), b = a - SLANT;
      return fromRight
        ? 'polygon(100% 0%, ' + (100 - a) + '% 0%, ' + (100 - b) + '% 100%, 100% 100%)'
        : 'polygon(0% 0%, ' + a + '% 0%, ' + b + '% 100%, 0% 100%)';
    };
    var kenBurns = function (k) {
      if (h.kb) h.kb.kill();
      h.kb = motionOK() ? window.gsap.to(imgOf(k), { scale: 1, duration: 8, ease: 'none' }) : null;
      if (h.kb && MOTION.paused) h.kb.pause();
    };
    var swapClasses = function (from, to) {
      slides[from].classList.remove('is-active', 'is-leaving');
      slides[to].classList.remove('is-entering');
      slides[to].classList.add('is-active');
    };

    var go = function (k, opts) {
      opts = opts || {};
      k = (k + N) % N;
      if (h.tl) h.tl.progress(1); // finish a running change at once (fires its onComplete)
      if (k === h.i) return;
      var from = h.i;
      var forward = opts.forward != null ? opts.forward : k > from;
      h.i = k;
      h.elapsed = 0;
      setRing(h.userPaused ? 1 : 0);
      loadSlide(k);
      markActive(k);
      if (opts.manual && heroStatus) heroStatus.textContent = pad2(k + 1) + ' / ' + pad2(N) + ': ' + HERO[k].name;

      if (!motionOK()) { swapClasses(from, k); fillCard(k); return; }

      var gsap = window.gsap;
      try {
        var inS = slides[k], outS = slides[from], inImg = imgOf(k), outImg = imgOf(from);
        var fromRight = forward !== isRTL; // LTR next enters from the right; RTL mirrors it
        var shift = fromRight ? 1 : -1;
        var vp = { p: 0 }, sp = { p: 0 };
        var lines = Array.prototype.slice.call(heroCard.children).filter(function (el) { return !el.hidden; });
        if (h.kb) h.kb.kill();
        inS.style.clipPath = mask(0, fromRight);
        veil.style.clipPath = mask(0, fromRight);
        veil.style.visibility = 'visible';
        inS.classList.add('is-entering');
        outS.classList.add('is-leaving');
        h.tl = gsap.timeline({
          defaults: { ease: 'power3.inOut' },
          onComplete: function () {
            swapClasses(from, k);
            inS.style.clipPath = '';
            veil.style.visibility = '';
            veil.style.clipPath = '';
            gsap.set(outImg, { clearProps: 'transform' });
            h.tl = null;
            kenBurns(k);
          }
        });
        h.tl
          .to(vp, { p: 1, duration: 1.0, onUpdate: function () { veil.style.clipPath = mask(vp.p, fromRight); } }, 0)
          .to(sp, { p: 1, duration: 1.15, onUpdate: function () { inS.style.clipPath = mask(sp.p, fromRight); } }, 0.16)
          .fromTo(inImg, { scale: 1.16, xPercent: 4 * shift }, { scale: 1.06, xPercent: 0, duration: 1.7, ease: 'power2.out' }, 0.16)
          .to(outImg, { xPercent: -5 * shift, scale: 1.02, duration: 1.3, ease: 'power2.inOut' }, 0)
          .to(lines, { opacity: 0, y: -8, duration: 0.28, stagger: 0.03, ease: 'power2.in' }, 0)
          .to(heroThumb, { opacity: 0, scale: 0.92, duration: 0.28, ease: 'power2.in' }, 0)
          .add(function () { fillCard(k); }, 0.38)
          .to(heroThumb, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', clearProps: 'opacity,transform' }, 0.42)
          .fromTo(lines, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', immediateRender: false, clearProps: 'opacity,transform' }, 0.46);
      } catch (err) {
        h.tl = null;
        veil.style.visibility = '';
        Array.prototype.forEach.call(slides, function (s) { s.style.clipPath = ''; s.classList.remove('is-entering', 'is-leaving', 'is-active'); });
        slides[k].classList.add('is-active');
        hero.classList.remove('hero--motion');
        fillCard(k);
      }
    };

    var running = function () { return !MOTION.paused && !h.userPaused && !h.hover && !h.focus && h.inView && !document.hidden; };
    var frame = function (now) {
      if (running()) {
        h.elapsed += Math.min(100, now - (h.last || now));
        if (h.elapsed > DURATION - 3500) loadSlide(h.i + 1); // fetch the next photo a few seconds before it is needed
        if (h.elapsed >= DURATION) {
          if (isReady((h.i + 1) % N)) go(h.i + 1, { forward: true }); else h.elapsed = DURATION;
        }
        setRing(h.elapsed / DURATION);
      }
      h.last = now;
      window.requestAnimationFrame(frame);
    };
    var setHeroPaused = function (paused) {
      h.userPaused = paused;
      heroToggle.classList.toggle('is-paused', paused);
      heroToggle.setAttribute('aria-label', paused ? I18N.play : I18N.pause);
      if (paused) setRing(1);
    };

    heroToggle.hidden = false;
    setHeroPaused(h.userPaused); // never auto-plays with reduced motion
    // While the global switch is on, pressing Play here lifts it (everything resumes); the hook below keeps both in sync.
    heroToggle.addEventListener('click', function () { if (MOTION.paused) MOTION.set(false, true); else setHeroPaused(!h.userPaused); });
    MOTION.hooks.push(function (p) {
      setHeroPaused(p || reduceMotion.matches);
      if (h.kb) { if (p) h.kb.pause(); else h.kb.resume(); }
    });
    heroPrev.addEventListener('click', function () { go(h.i - 1, { manual: true, forward: false }); });
    heroNext.addEventListener('click', function () { go(h.i + 1, { manual: true, forward: true }); });
    // Warm up the neighbour photo as soon as the visitor reaches for a control.
    heroPrev.addEventListener('pointerenter', function () { loadSlide(h.i - 1); });
    heroNext.addEventListener('pointerenter', function () { loadSlide(h.i + 1); });
    Array.prototype.forEach.call(thumbs, function (tb, n) {
      tb.addEventListener('pointerenter', function () { loadSlide(n); });
      tb.addEventListener('click', function () { go(n, { manual: true }); });
    });
    // Arrow keys while focus is inside the navigator (mirrored in RTL).
    heroNav.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var fwd = (e.key === 'ArrowRight') !== isRTL;
      go(h.i + (fwd ? 1 : -1), { manual: true, forward: fwd });
    });
    hero.addEventListener('mouseenter', function () { h.hover = true; });
    hero.addEventListener('mouseleave', function () { h.hover = false; });
    // Keyboard focus pauses; a mouse click on a control does not freeze the slideshow forever.
    hero.addEventListener('focusin', function (e) {
      var fv = false;
      try { fv = e.target.matches(':focus-visible'); } catch (err) { fv = true; }
      h.focus = fv;
    });
    hero.addEventListener('focusout', function (e) { if (!hero.contains(e.relatedTarget)) h.focus = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { h.inView = en[0].isIntersecting; }, { threshold: 0.25 }).observe(hero);
    }
    reduceMotion.addEventListener('change', function (e) {
      if (h.tl) h.tl.progress(1);
      if (h.kb) { h.kb.kill(); h.kb = null; window.gsap.set(imgOf(h.i), { clearProps: 'transform' }); }
      setMotionClass();
      if (e.matches) setHeroPaused(true);
    });

    // Intro: text lines and navigator rise once; the first photo settles slowly (motion only).
    if (motionOK()) {
      try {
        var intro = hero.querySelector('[data-hero-intro]');
        window.gsap.timeline({ defaults: { ease: 'power3.out' } })
          .fromTo(imgOf(0), { scale: 1.12 }, { scale: 1.06, duration: 1.8, ease: 'power2.out', onComplete: function () { if (h.i === 0) kenBurns(0); } }, 0)
          .from(intro.children, { opacity: 0, y: 24, duration: 0.8, stagger: 0.09, clearProps: 'opacity,transform' }, 0.1)
          .from(heroNav, { opacity: 0, y: 24, duration: 0.8, clearProps: 'opacity,transform' }, 0.45);
        // Stat cards overlapping the hero rise with it when they are already on screen (else data-reveal-group handles them).
        var statList = document.querySelector('.stats');
        if (statList && statList.getBoundingClientRect().top < window.innerHeight) {
          statList._dsRevealed = true;
          window.gsap.from(statList.children, { opacity: 0, y: 32, duration: 0.8, delay: 0.6, stagger: 0.08, ease: 'power3.out', clearProps: 'opacity,transform' });
        }
      } catch (err) { /* content is already visible in the HTML */ }
    }
    window.requestAnimationFrame(frame);
  } else if (hero) {
    var lone = hero.querySelector('.hero__controls');
    if (lone) lone.hidden = true;
  }

  /* ---------- 5. Services: select (desktop: hover/focus/click) or accordion (mobile); arrow keys move between rows.
     Ambient layer: the orange glow glides to the active row (CSS transition on --glow-y), a soft spotlight follows the
     pointer (desktop, fine pointer), the cover drifts with scroll (ScrollTrigger, --svc-par). Ambient CSS animation
     runs only while the section is on screen (.is-live). Reduced motion: no glide, no spotlight, no parallax, instant switch. ---------- */
  var svcList = document.querySelector('[data-svc]');
  if (svcList) {
    var svcSection = svcList.closest('.svc-section') || svcList.parentNode;
    var svcs = svcList.querySelectorAll('.svc');
    var svcBtns = svcList.querySelectorAll('.svc__btn');
    var svcGlow = svcSection.querySelector('.svc-fx__glow--a');
    var moveGlow = function () {
      if (!svcGlow) return;
      var open = svcList.querySelector('.svc.is-open .svc__head') || svcs[0].querySelector('.svc__head');
      var top = open.getBoundingClientRect().top - svcSection.getBoundingClientRect().top;
      var y = top + open.offsetHeight / 2 - svcGlow.offsetHeight / 2;
      svcSection.style.setProperty('--glow-y', Math.round(y) + 'px');
    };
    var svcFx = function (s) {
      // Coordinated switch (max ~700ms): cover settles inside the frame, number rises, chip floats in, text follows.
      var g = window.gsap;
      if (!g || reduceMotion.matches) return;
      try {
        var cover = s.querySelector('.svc__cover');
        var num = s.querySelector('.svc__bignum');
        var chip = s.querySelector('.svc__float');
        var kids = s.querySelectorAll('.svc__body > *');
        g.killTweensOf([cover, num, chip, kids]);
        g.fromTo(cover, { scale: 1.08, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out', clearProps: 'transform,opacity' });
        if (num) g.fromTo(num, { yPercent: 35, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' });
        if (chip) g.fromTo(chip, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.15, ease: 'power3.out', clearProps: 'transform,opacity' });
        g.from(kids, { opacity: 0, y: 16, duration: 0.45, stagger: 0.05, delay: 0.12, ease: 'power3.out', clearProps: 'opacity,transform' });
      } catch (err) { /* panel is already visible in the HTML */ }
    };
    var openSvc = function (target, toggleMode) {
      var wasOpen = target.classList.contains('is-open');
      Array.prototype.forEach.call(svcs, function (s) {
        var on = s === target ? (toggleMode ? !wasOpen : true) : false;
        s.classList.toggle('is-open', on);
        s.querySelector('.svc__btn').setAttribute('aria-expanded', String(on));
      });
      if (!wasOpen && target.classList.contains('is-open')) svcFx(target);
      moveGlow();
    };
    Array.prototype.forEach.call(svcs, function (s) {
      var btn = s.querySelector('.svc__btn');
      btn.addEventListener('click', function () { openSvc(s, !desktop.matches); });
      btn.addEventListener('mouseenter', function () { if (desktop.matches) openSvc(s, false); });
      btn.addEventListener('focus', function () { if (desktop.matches) openSvc(s, false); });
    });
    svcList.addEventListener('keydown', function (e) {
      var i = Array.prototype.indexOf.call(svcBtns, document.activeElement);
      if (i < 0) return;
      var next = -1;
      if (e.key === 'ArrowDown') next = (i + 1) % svcBtns.length;
      else if (e.key === 'ArrowUp') next = (i - 1 + svcBtns.length) % svcBtns.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = svcBtns.length - 1;
      if (next < 0) return;
      e.preventDefault();
      svcBtns[next].focus();
    });
    // Desktop always shows one panel: reopen the first if the visitor collapsed all on mobile.
    desktop.addEventListener('change', function (e) {
      if (e.matches && !svcList.querySelector('.svc.is-open')) openSvc(svcs[0], false);
      moveGlow();
    });
    window.addEventListener('resize', moveGlow);
    window.addEventListener('load', moveGlow);
    moveGlow();

    // Pause ambient animation off-screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        svcSection.classList.toggle('is-live', entries[0].isIntersecting);
      }, { rootMargin: '100px 0px' }).observe(svcSection);
    } else {
      svcSection.classList.add('is-live');
    }

    // Soft spotlight following the pointer (CSS shows it only on desktop, fine pointer, motion OK).
    var fine = window.matchMedia('(pointer: fine)');
    var spotFrame = 0, spotX = 0, spotY = 0;
    svcSection.addEventListener('pointermove', function (e) {
      if (!fine.matches || !desktop.matches || reduceMotion.matches) return;
      var r = svcSection.getBoundingClientRect();
      spotX = e.clientX - r.left; spotY = e.clientY - r.top;
      if (spotFrame) return;
      spotFrame = window.requestAnimationFrame(function () {
        spotFrame = 0;
        svcSection.style.setProperty('--mx', spotX + 'px');
        svcSection.style.setProperty('--my', spotY + 'px');
        svcSection.classList.add('is-pointer');
      });
    });
    svcSection.addEventListener('pointerleave', function () { svcSection.classList.remove('is-pointer'); });

    // Scroll-linked drift of the cover inside its frame (needs GSAP ScrollTrigger; static otherwise).
    var svcPar = null;
    var setupPar = function () {
      var ST = window.ScrollTrigger;
      if (svcPar) { svcPar.kill(); svcPar = null; }
      svcList.style.removeProperty('--svc-par');
      if (!ST || !window.gsap || reduceMotion.matches) return;
      try {
        window.gsap.registerPlugin(ST);
        svcPar = ST.create({
          trigger: svcSection, start: 'top bottom', end: 'bottom top',
          onUpdate: function (self) { svcList.style.setProperty('--svc-par', ((self.progress - 0.5) * 8).toFixed(2)); }
        });
      } catch (err) { svcPar = null; }
    };
    setupPar();
    reduceMotion.addEventListener('change', setupPar);
  }

  /* ---------- 6. Projects: featured + grid + sector filter (v3 C3) ----------
     The pool in #projects-data is exactly the set shown (the server renders the same list), so chip counts are true.
     Without JS: every card is already in the HTML and the filter bar stays hidden. */
  var PROJECTS = readJSON('projects-data');
  var pshow = document.getElementById('pshow');
  var filters = document.querySelector('.filters');
  var filterStatus = document.getElementById('filter-status');

  /* PROJECTS-TEMPLATES-START (also executed by the mockup build script to write the no-JS HTML) */
  function iconDuo(name, cls) {
    return '<svg class="icon icon--duo' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#phd-' + name + '"></use></svg>';
  }
  function sectorIcon(catId) {
    var s = (PROJECTS && PROJECTS.sectors || []).filter(function (x) { return x.id === catId; })[0];
    return s ? s.icon : 'squares-four';
  }
  function bigImg(u, w, h) { return u.replace('width=640&height=480', 'width=' + w + '&height=' + h); }
  function metaHTML(p) {
    var f = I18N.facts || {};
    var rows = [['site', 'map-pin'], ['size', 'ruler'], ['yr', 'clock']].filter(function (r) { return p[r[0]]; }).map(function (r) {
      return '<li>' + icon(r[1]) + '<span class="sr-only">' + esc(f[r[0]]) + ': </span><span>' + esc(p[r[0]]) + '</span></li>';
    });
    return rows.length ? '<ul class="pmeta">' + rows.join('') + '</ul>' : '';
  }
  function featureHTML(p) {
    var i = bigImg(p.img, 960, 720), j = bigImg(p.img, 1280, 960);
    return '<article class="pfeature" data-cat="' + esc(p.catId) + '">' +
      '<div class="pfeature__media media--overlay"><img src="' + esc(i) + '" srcset="' + esc(p.img) + ' 640w, ' + esc(i) + ' 960w, ' + esc(j) + ' 1280w" sizes="(min-width: 1024px) 1136px, 100vw" width="960" height="720" alt="" loading="lazy" decoding="async"></div>' + /* alt empty: the title link names the project */
      '<div class="pfeature__panel glass glass--dark">' +
      '<p class="pfeature__sector"><span class="icon-badge icon-badge--sm icon-badge--on-dark" aria-hidden="true">' + iconDuo(sectorIcon(p.catId)) + '</span><span>' + esc(p.cat) + '</span></p>' +
      '<h3 class="pfeature__title"><a class="pcard__link" href="' + esc(p.url) + '">' + esc(p.name) + '</a></h3>' +
      metaHTML(p) +
      '<span class="pfeature__cta" aria-hidden="true">' + esc(I18N.viewProject) + icon('arrow-right', 'icon--dir') + '</span>' +
      '</div></article>';
  }
  function cardHTML(p) {
    return '<li><article class="pcard" data-cat="' + esc(p.catId) + '">' +
      '<div class="pcard__media media--overlay"><img src="' + esc(p.img) + '" srcset="' + esc(p.img400) + ' 400w, ' + esc(p.img) + ' 640w" sizes="(min-width: 1024px) 368px, (min-width: 560px) 50vw, 100vw" width="640" height="480" alt="" loading="lazy" decoding="async"></div>' +
      '<span class="pcard__badge badge badge--glass">' + iconDuo(sectorIcon(p.catId)) + '<span>' + esc(p.cat) + '</span></span>' +
      '<div class="pcard__body"><h3 class="pcard__title"><a class="pcard__link" href="' + esc(p.url) + '">' + esc(p.name) + '</a></h3>' +
      (p.site ? '<p class="pcard__loc">' + icon('map-pin') + '<span>' + esc(p.site) + '</span></p>' : '') + '</div>' +
      '<span class="pcard__go" aria-hidden="true">' + icon('arrow-right', 'icon--dir') + '</span></article></li>';
  }
  function showHTML(list, cat) {
    if (!list.length) {
      return '<div class="pempty"><span class="icon-badge icon-badge--lg" aria-hidden="true">' + iconDuo('squares-four') + '</span><p><strong>' + esc(I18N.emptyTitle) + '</strong></p><p>' + esc(I18N.emptyText) + '</p></div>';
    }
    if (cat && cat !== 'all') { // filtered: regular same-size cards for any count (1 project = one normal card)
      return '<ul class="pgrid">' + list.map(cardHTML).join('') + '</ul>';
    }
    return '<div class="pfeat">' + featureHTML(list[0]) + '</div>' +
      (list.length > 1 ? '<ul class="pgrid">' + list.slice(1).map(cardHTML).join('') + '</ul>' : '');
  }
  /* PROJECTS-TEMPLATES-END */

  var currentCat = 'all';
  var PHONE_MAX = 4; // phones: "all" shows at most 4 projects; the rest is one tap away ("View all projects"). A sector filter shows all of its projects.
  function poolFor(cat) {
    return cat === 'all' ? PROJECTS.all.slice() : PROJECTS.all.filter(function (p) { return p.catId === cat; });
  }
  function listFor(cat) {
    var l = poolFor(cat);
    return (cat === 'all' && phone.matches) ? l.slice(0, PHONE_MAX) : l;
  }
  function setPressed(btn) {
    Array.prototype.forEach.call(filters.querySelectorAll('[data-filter]'), function (b) {
      b.setAttribute('aria-pressed', String(b === btn));
    });
  }
  function renderShow(cat) {
    var list = listFor(cat);
    pshow.innerHTML = showHTML(list, cat);
    pshow.setAttribute('data-count', String(list.length));
    return list.length;
  }
  function applyFilter(btn) {
    var cat = btn.getAttribute('data-filter');
    if (cat === currentCat) return;
    currentCat = cat;
    setPressed(btn);
    try { btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' }); } catch (e) { /* older browsers */ }
    var g = window.gsap, token = (applyFilter.token = (applyFilter.token || 0) + 1);
    var label = btn.querySelector('.chip__label');
    var done = function (n) {
      if (filterStatus) {
        filterStatus.textContent = cat === 'all' ? fmt(I18N.filterStatusAll, { n: n }) : fmt(I18N.filterStatus, { n: n, c: label ? label.textContent.trim() : '' });
      }
    };
    if (!g || !(window.DSMotion && window.DSMotion.enabled)) { done(renderShow(cat)); return; }
    g.killTweensOf(pshow);
    pshow.style.minHeight = pshow.offsetHeight + 'px'; // no jump while the content swaps
    g.to(pshow, {
      opacity: 0, y: 8, duration: 0.18, ease: 'power2.in', overwrite: true,
      onComplete: function () {
        if (token !== applyFilter.token) return;
        var n = renderShow(cat);
        done(n);
        var items = pshow.querySelectorAll('.pfeature, .pgrid > li, .pempty');
        g.set(pshow, { y: 0 });
        g.to(pshow, { opacity: 1, duration: 0.15, clearProps: 'opacity,transform' });
        g.from(items, {
          opacity: 0, y: 18, scale: 0.97, duration: 0.5, ease: 'power3.out', stagger: 0.07, clearProps: 'opacity,transform',
          onComplete: function () { if (token === applyFilter.token) pshow.style.minHeight = ''; }
        });
      }
    });
  }
  if (PROJECTS && pshow && filters) {
    filters.hidden = false; // without JS the filter stays hidden and every project in the set stays visible
    // Counts come from the pool itself.
    Array.prototype.forEach.call(filters.querySelectorAll('[data-filter]'), function (b) {
      var c = b.querySelector('.chip__count');
      if (c) c.textContent = String(poolFor(b.getAttribute('data-filter')).length);
    });
    // Phones: trim "all" to 4 on load and when the viewport crosses 768px (the static HTML holds every card).
    if (phone.matches) renderShow('all');
    phone.addEventListener('change', function () { if (currentCat === 'all') renderShow('all'); });
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (btn && filters.contains(btn)) applyFilter(btn);
    });
    // One scrollable row: wrap it, add glass scroll buttons at both ends (CSS shows them on desktop only while the
    // row overflows) and fade only the edge that still hides chips. RTL scrollLeft runs from 0 to negative.
    (function () {
      var wrap = document.createElement('div');
      wrap.className = 'chip-scroller';
      filters.parentNode.insertBefore(wrap, filters);
      wrap.appendChild(filters);
      var mk = function (dir) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip-scroll chip-scroll--' + dir + ' glass glass--light';
        b.setAttribute('aria-label', (dir === 'prev' ? I18N.prev : I18N.next) || dir);
        b.tabIndex = -1; // keyboard users reach every chip with Tab; the buttons are a mouse convenience
        b.innerHTML = icon(dir === 'prev' ? 'caret-left' : 'caret-right', 'icon--dir');
        b.addEventListener('click', function () {
          var step = Math.max(160, filters.clientWidth * 0.7) * (dir === 'next' ? 1 : -1) * (isRTL ? -1 : 1);
          try { filters.scrollBy({ left: step, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); } catch (e) { filters.scrollLeft += step; }
        });
        wrap.appendChild(b);
      };
      mk('prev'); mk('next');
      var raf = 0;
      var update = function () {
        raf = 0;
        var max = filters.scrollWidth - filters.clientWidth;
        var pos = Math.abs(filters.scrollLeft);
        wrap.classList.toggle('can-prev', max > 2 && pos > 2);
        wrap.classList.toggle('can-next', max > 2 && pos < max - 2);
      };
      var queue = function () { if (!raf) raf = window.requestAnimationFrame(update); };
      filters.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue);
      if ('ResizeObserver' in window) new ResizeObserver(queue).observe(filters);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
      update();
    })();
    // Subtle parallax of the featured photo inside its frame (CSS reads --pp from -1 to 1).
    var pST = window.ScrollTrigger, pSec = document.getElementById('projects');
    var setupPPar = function () {
      if (pSec._ppar) { pSec._ppar.kill(); pSec._ppar = null; }
      pSec.style.removeProperty('--pp');
      if (!pST || !window.gsap || reduceMotion.matches) return;
      try {
        window.gsap.registerPlugin(pST);
        pSec._ppar = pST.create({
          trigger: pshow, start: 'top bottom', end: 'bottom top',
          onUpdate: function (self) { pSec.style.setProperty('--pp', ((self.progress - 0.5) * 2).toFixed(3)); }
        });
      } catch (err) { /* static image */ }
    };
    setupPPar();
    reduceMotion.addEventListener('change', setupPPar);
  }

  /* ---------- 6b. Capabilities: document showcase tabs (WAI-ARIA tabs, automatic activation) ----------
     Arrow keys move between the tabs (mirrored in RTL), Home / End jump to the ends. Inactive panels are inert.
     The switch animation is pure CSS (section 15): this only sets --shift (direction) on the two covers first. */
  (function () {
    var box = document.querySelector('[data-docshow]');
    if (!box) return;
    var seg = box.querySelector('[role="tablist"]');
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    if (!seg || !tabs.length) return;
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var docs = tabs.map(function (t) { return box.querySelector('.doc-wrap[data-doc="' + t.getAttribute('data-doc') + '"]'); });
    var current = Math.max(0, tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; }));

    function apply(i) {
      tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach(function (p, k) {
        if (!p) return;
        p.classList.toggle('is-active', k === i);
        if (k === i) p.removeAttribute('inert'); else p.setAttribute('inert', '');
      });
      docs.forEach(function (d, k) { if (d) d.classList.toggle('is-active', k === i); });
      seg.setAttribute('data-active', String(i));
      current = i;
    }
    function select(i, focus) {
      if (i !== current) {
        var s = (i > current ? 1 : -1) * (isRTL ? -1 : 1); // the new cover enters from the reading direction
        var inDoc = docs[i], outDoc = docs[current];
        if (inDoc) { inDoc.style.transition = 'none'; inDoc.style.setProperty('--shift', String(s)); void inDoc.offsetWidth; inDoc.style.transition = ''; }
        if (outDoc) outDoc.style.setProperty('--shift', String(-s));
        apply(i);
      }
      if (focus) tabs[i].focus();
    }
    apply(current);
    tabs.forEach(function (t, k) { t.addEventListener('click', function () { select(k, false); }); });
    seg.addEventListener('keydown', function (e) {
      var n = tabs.length, next = null;
      if (e.key === 'ArrowRight') next = current + (isRTL ? -1 : 1);
      else if (e.key === 'ArrowLeft') next = current + (isRTL ? 1 : -1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next === null) return;
      e.preventDefault();
      select((next + n) % n, true);
    });
  })();


  /* ---------- 7. Team: grid or carousel by count (design-plan 6.1.1) ---------- */
  var TEAM = readJSON('team-data');
  var team = document.getElementById('team');
  var track = document.getElementById('team-track');
  var controls = team ? team.querySelector('.team__controls') : null;
  var counter = team ? team.querySelector('.team__counter') : null;
  var btnPrev = team ? team.querySelector('[data-team-prev]') : null;
  var btnNext = team ? team.querySelector('[data-team-next]') : null;
  var btnToggle = team ? team.querySelector('[data-team-toggle]') : null;

  var carousel = {
    active: false, userPaused: false, hover: false, focus: false, inView: true, timer: 0,
    canAuto: function () { return this.active && !MOTION.paused && !reduceMotion.matches && !this.userPaused && !this.hover && !this.focus && this.inView && !document.hidden; },
    schedule: function () {
      window.clearTimeout(this.timer);
      if (this.canAuto()) {
        var self = this;
        this.timer = window.setTimeout(function () { self.step(1, false); self.schedule(); }, 5000);
      }
    },
    metrics: function () {
      var cards = track.children;
      var gap = cards.length > 1 ? Math.abs(cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left) : track.clientWidth;
      var max = track.scrollWidth - track.clientWidth;
      return { stepW: gap || 1, max: max, pos: Math.min(max, Math.abs(track.scrollLeft)) };
    },
    step: function (dir, manual) {
      var m = this.metrics();
      var target = m.pos + dir * m.stepW;
      if (dir > 0 && m.pos >= m.max - 4) target = 0;            // end reached: back to the start, no clones
      else if (dir < 0 && m.pos <= 4) target = m.max;
      target = Math.max(0, Math.min(m.max, target));
      counter.setAttribute('aria-live', manual ? 'polite' : 'off'); // announce manual moves only
      track.scrollTo({ left: isRTL ? -target : target, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    },
    updateCounter: function () {
      var n = track.children.length;
      var m = this.metrics();
      var first = Math.round(m.pos / m.stepW);
      var perView = Math.max(1, Math.floor((track.clientWidth + 30) / m.stepW)); // +30 absorbs the last gap
      var last = Math.min(n, first + perView);
      counter.textContent = fmt(I18N.counter, { a: first + 1, b: last, n: n });
    },
    setPaused: function (paused) {
      this.userPaused = paused;
      btnToggle.classList.toggle('is-paused', paused);
      btnToggle.setAttribute('aria-label', paused ? I18N.play : I18N.pause);
      this.schedule();
    }
  };

  /* ---------- 7b. Team: vertical carousel (desktop, 5+ members, motion allowed) ----------
     3 columns of the same cards drift slowly in opposite directions (up / down / up) inside a fixed-height rounded window.
     #team-track stays the canonical list (hidden while this runs). Real cards are tabindex=0; the duplicate lists that make the
     loop seamless are aria-hidden + inert, so keyboard and screen readers see every member exactly once.
     Pauses on hover, focus, touch and with the visible button; never builds with prefers-reduced-motion (static grid instead). */
  var vert = {
    on: false, userPaused: false, hover: false, focus: false, inView: true, raf: 0, last: 0, win: null, cols: [], view: 640,
    want: function () { return !!track && desktop.matches && !reduceMotion.matches && track.children.length >= 5; },
    canRun: function () { return this.on && !MOTION.paused && !this.userPaused && !this.hover && !this.focus && this.inView && !document.hidden && !reduceMotion.matches; },
    schedule: function () {
      if (this.canRun()) {
        if (!this.raf) { this.last = 0; this.raf = window.requestAnimationFrame(this.frame); }
      } else if (this.raf) { window.cancelAnimationFrame(this.raf); this.raf = 0; }
    },
    frame: function (ts) {
      var v = vert;
      v.raf = 0;
      if (!v.canRun()) return;
      var dt = v.last ? Math.min(64, ts - v.last) / 1000 : 0;
      v.last = ts;
      v.cols.forEach(function (c) { c.p = (c.p + c.speed * dt) % c.H; v.paint(c); });
      v.raf = window.requestAnimationFrame(v.frame);
    },
    paint: function (c) {
      var y = c.dir > 0 ? -c.p : c.p - c.H; // dir 1 = content moves up, -1 = down
      c.belt.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
    },
    setPaused: function (paused) {
      this.userPaused = paused;
      btnToggle.classList.toggle('is-paused', paused);
      btnToggle.setAttribute('aria-label', paused ? I18N.play : I18N.pause);
      this.schedule();
    },
    teardown: function () {
      if (this.raf) { window.cancelAnimationFrame(this.raf); this.raf = 0; }
      if (this.win && this.win.parentNode) this.win.parentNode.removeChild(this.win);
      this.win = null; this.cols = []; this.on = false;
    },
    build: function () {
      var self = this;
      this.teardown();
      var src = Array.prototype.slice.call(track.children);
      var win = document.createElement('div');
      win.className = 'team-v';
      var wrap = document.createElement('div');
      wrap.className = 'team-v__cols';
      win.appendChild(wrap);
      var speeds = [20, 26, 17], dirs = [1, -1, 1];
      var cols = [0, 1, 2].map(function (ci) {
        var col = document.createElement('div'); col.className = 'team-v__col';
        var belt = document.createElement('div'); belt.className = 'team-v__belt';
        var ul = document.createElement('ul'); ul.className = 'team-v__list';
        src.forEach(function (li, i) {
          if (i % 3 !== ci) return;
          var k = li.cloneNode(true);
          k.removeAttribute('role'); k.removeAttribute('aria-roledescription'); k.removeAttribute('aria-label');
          k.setAttribute('tabindex', '0');
          ul.appendChild(k);
        });
        belt.appendChild(ul); col.appendChild(belt); wrap.appendChild(col);
        return { col: col, belt: belt, ul: ul, speed: speeds[ci], dir: dirs[ci], p: 0, H: 1 };
      });
      team.insertBefore(win, track);
      track.hidden = true;
      this.hover = false; this.focus = false;
      win.addEventListener('mouseenter', function () { self.hover = true; self.schedule(); });
      win.addEventListener('mouseleave', function () { self.hover = false; self.schedule(); });
      win.addEventListener('focusin', function (e) {
        self.focus = true; self.schedule();
        var li = e.target.closest ? e.target.closest('li.tcard') : null;
        if (li && !li.closest('[aria-hidden=\'true\']')) self.reveal(li);
      });
      win.addEventListener('focusout', function (e) { if (!win.contains(e.relatedTarget)) { self.focus = false; self.schedule(); } });
      win.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' && !self.userPaused) self.setPaused(true); });
      this.win = win; this.cols = cols; this.on = true;
      carousel.active = false; window.clearTimeout(carousel.timer);
      controls.hidden = false;
      team.setAttribute('data-vertical', '');
      team.setAttribute('role', 'region');
      team.removeAttribute('aria-roledescription');
      team.setAttribute('aria-label', I18N.carousel);

      // Measure, then add enough aria-hidden/inert duplicates that the loop never shows a gap.
      this.view = wrap.clientHeight || 640;
      cols.forEach(function (c, i) {
        var gap = parseFloat(getComputedStyle(c.belt).rowGap) || 24;
        var h = c.ul.offsetHeight;
        c.H = Math.max(1, h + gap);
        var dups = Math.ceil((self.view + gap) / c.H);
        for (var d = 0; d < dups; d++) {
          var dup = c.ul.cloneNode(true);
          dup.setAttribute('aria-hidden', 'true');
          dup.setAttribute('inert', '');
          Array.prototype.forEach.call(dup.children, function (li) { li.removeAttribute('tabindex'); });
          c.belt.appendChild(dup);
        }
        c.p = (c.H * 0.2 * i) % c.H;
        self.paint(c);
      });
      this.setPaused(this.userPaused);
    },
    destroy: function () {
      if (!this.on) return;
      this.teardown();
      track.hidden = false;
      team.removeAttribute('data-vertical');
      setupTeam(track.children.length, false); // restores the horizontal layout, controls and aria
    },
    sync: function (force) {
      if (!team || !track) return;
      if (this.want()) { if (!this.on || force) this.build(); }
      else if (this.on) this.destroy();
    },
    // Keyboard: make sure the focused real card is on screen inside its column
    reveal: function (li) {
      var c = this.cols.filter(function (x) { return x.ul === li.parentNode; })[0];
      if (!c) return;
      var t = li.offsetTop, ch = li.offsetHeight, mid = (this.view - ch) / 2;
      var p = c.dir > 0 ? t - mid : mid + c.H - t;
      c.p = Math.max(0, Math.min(c.H - 1, p));
      this.paint(c);
    }
  };

  function teamCardHTML(m, i, n, isCarousel) {
    var sep = isRTL ? '، ' : ', ';
    return '<li class="tcard"' + (isCarousel ? ' role="group" aria-roledescription="' + esc(I18N.slide) + '" aria-label="' + esc(fmt(I18N.group, { i: i + 1, n: n })) + '"' : '') + '>' +
      '<div class="tcard__photo"><img src="' + esc(m.photo) + '" width="364" height="364" alt="' + esc(m.name + sep + m.position) + '" loading="lazy" decoding="async"></div>' +
      '<h3 class="tcard__name">' + esc(m.name) + '</h3><p class="tcard__role">' + esc(m.position) + '</p></li>';
  }

  function setupTeam(count, rerender) {
    var layout = count > 8 ? 'carousel' : count > 4 ? 'grid' : 'row';
    var isCarousel = layout === 'carousel';
    if (rerender && TEAM) {
      var list = TEAM.slice(0, count);
      track.innerHTML = list.map(function (m, i) { return teamCardHTML(m, i, list.length, isCarousel); }).join('');
      track.scrollLeft = 0;
    } else if (isCarousel) {
      Array.prototype.forEach.call(track.children, function (li, i, all) {
        li.setAttribute('role', 'group');
        li.setAttribute('aria-roledescription', I18N.slide);
        li.setAttribute('aria-label', fmt(I18N.group, { i: i + 1, n: all.length }));
      });
    }
    team.setAttribute('data-layout', layout);
    controls.hidden = !isCarousel;
    carousel.active = isCarousel;
    if (isCarousel) {
      team.setAttribute('role', 'region');
      team.setAttribute('aria-roledescription', I18N.carouselRole);
      team.setAttribute('aria-label', I18N.carousel);
      carousel.setPaused(reduceMotion.matches || MOTION.paused); // never auto-advance with reduced motion or the global pause
      carousel.updateCounter();
    } else {
      team.removeAttribute('role');
      team.removeAttribute('aria-roledescription');
      team.removeAttribute('aria-label');
      window.clearTimeout(carousel.timer);
    }
    vert.sync(true);
  }

  if (team && track && controls) {
    var scrollTick = 0;
    track.addEventListener('scroll', function () {
      if (!carousel.active) return;
      window.cancelAnimationFrame(scrollTick);
      scrollTick = window.requestAnimationFrame(function () { carousel.updateCounter(); });
    }, { passive: true });
    btnPrev.addEventListener('click', function () { carousel.step(-1, true); });
    btnNext.addEventListener('click', function () { carousel.step(1, true); });
    btnToggle.addEventListener('click', function () {
      if (MOTION.paused) MOTION.set(false, true); // Play here lifts the global pause; the hook below syncs the button
      else if (vert.on) vert.setPaused(!vert.userPaused); else carousel.setPaused(!carousel.userPaused);
    });
    MOTION.hooks.push(function (p) { vert.setPaused(p); carousel.setPaused(p || reduceMotion.matches); });
    team.addEventListener('mouseenter', function () { carousel.hover = true; carousel.schedule(); });
    team.addEventListener('mouseleave', function () { carousel.hover = false; carousel.schedule(); });
    team.addEventListener('focusin', function () { carousel.focus = true; carousel.schedule(); });
    team.addEventListener('focusout', function (e) {
      if (!team.contains(e.relatedTarget)) { carousel.focus = false; carousel.schedule(); }
    });
    // A touch or swipe means the visitor took control: stop until they press play.
    track.addEventListener('pointerdown', function (e) {
      if (carousel.active && e.pointerType !== 'mouse' && !carousel.userPaused) carousel.setPaused(true);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        carousel.inView = entries[0].isIntersecting;
        vert.inView = entries[0].isIntersecting;
        carousel.schedule();
        vert.schedule();
      }, { threshold: 0.25 }).observe(team);
    }
    document.addEventListener('visibilitychange', function () { carousel.schedule(); });
    reduceMotion.addEventListener('change', function () { if (carousel.active) carousel.setPaused(reduceMotion.matches || carousel.userPaused); });
    window.addEventListener('resize', function () { if (carousel.active) carousel.updateCounter(); });

    setupTeam(track.children.length, false);
    document.addEventListener('visibilitychange', function () { vert.schedule(); });
    reduceMotion.addEventListener('change', function () { vert.sync(false); });
    desktop.addEventListener('change', function () { vert.sync(false); });
    var vertTimer = 0;
    window.addEventListener('resize', function () { window.clearTimeout(vertTimer); vertTimer = window.setTimeout(function () { if (vert.on) vert.sync(true); }, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (vert.on) vert.sync(true); });

    // MOCKUP ONLY: preview the layout with 4 / 8 / 12 members
    var teamBtns = document.querySelectorAll('[data-team]');
    Array.prototype.forEach.call(teamBtns, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(teamBtns, function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        setupTeam(parseInt(btn.getAttribute('data-team'), 10), true);
      });
    });
  }

  /* ---------- 7c2. How we work: progress rail above the step cards ----------
     The rail (.flowrail, decorative, aria-hidden: the cards carry the content) has 4 numbered nodes aligned with the card columns.
     Desktop: the node of the hovered / focused card is active (Ember fill) and the line is filled up to it.
     Phones and tablets: the cards are a scroll-snap row and the rail follows the card snapped at the start edge. No GSAP needed. */
  (function () {
    var flow = document.querySelector('.flow'), rail = document.querySelector('[data-flow-rail]');
    if (!flow || !rail) return;
    var steps = flow.querySelectorAll('[data-flow-step]'), items = rail.children, cur = -1, queued = false;
    var set = function (n) {
      if (n === cur) return;
      cur = n;
      Array.prototype.forEach.call(items, function (it, i) { it.classList.toggle('is-active', i === n); it.classList.toggle('is-done', i < n); });
    };
    var track = function () {
      queued = false;
      if (desktop.matches) return;
      var fr = flow.getBoundingClientRect(), cs = window.getComputedStyle(flow);
      var ref = isRTL ? fr.right - parseFloat(cs.paddingRight) : fr.left + parseFloat(cs.paddingLeft);
      var best = 0, bestD = Infinity;
      Array.prototype.forEach.call(steps, function (s, i) {
        var r = s.getBoundingClientRect(), d = Math.abs((isRTL ? r.right : r.left) - ref);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (Math.abs(flow.scrollLeft) + flow.clientWidth >= flow.scrollWidth - 2) best = steps.length - 1; // scrolled to the end
      set(best);
    };
    var queue = function () { if (!queued) { queued = true; window.requestAnimationFrame(track); } };
    Array.prototype.forEach.call(steps, function (s, i) {
      s.addEventListener('pointerenter', function () { if (desktop.matches) set(i); });
      s.addEventListener('focusin', function () { if (desktop.matches) set(i); });
    });
    flow.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    desktop.addEventListener('change', function () { if (desktop.matches) set(0); else queue(); });
    set(0);
    queue();
  })();

  /* ---------- 7d. Sector marquee + CTA vertical slider (v3 refinements) ----------
     Both loops are CSS animations (see CSS section 22). Duplicates are aria-hidden + inert, so keyboard and screen readers meet each
     item once. Pause: hover, focus (CSS) and touch (.is-held, released after 3s). Reduced motion: no duplicates, no animation;
     the sector tiles become a plain horizontally scrollable row and the CTA images stay a static column. */
  (function () {
    function hold(box) {
      var t = 0;
      box.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        box.classList.add('is-held'); window.clearTimeout(t);
        t = window.setTimeout(function () { box.classList.remove('is-held'); }, 3000);
      });
    }
    function dup(node) {
      var c = node.cloneNode(true);
      c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', '');
      Array.prototype.forEach.call(c.querySelectorAll('[data-countup]'), function (n) { n.removeAttribute('data-countup'); });
      return c;
    }
    var ul = document.querySelector('.sectors');
    if (ul && !ul.parentNode.classList.contains('sector-marquee')) {
      var box = document.createElement('div');
      box.className = 'sector-marquee';
      ul.removeAttribute('data-reveal-group');
      box.setAttribute('data-reveal', '');
      ul.parentNode.insertBefore(box, ul);
      box.appendChild(ul);
      if (reduceMotion.matches) {
        box.classList.add('is-scroll'); ul.classList.add('is-scroll');
      } else {
        ul.classList.add('is-marquee');
        var items = Array.prototype.slice.call(ul.children);
        var setW = 0;
        items.forEach(function (li) { setW += li.offsetWidth + parseFloat(getComputedStyle(li).marginInlineEnd || 0); });
        var k = Math.max(1, Math.ceil((box.clientWidth || window.innerWidth) / Math.max(1, setW)));
        var total = items.length * (2 * k - 1);
        for (var i = 0; i < total; i++) ul.appendChild(dup(items[i % items.length]));
        ul.style.setProperty('--mq-dur', Math.round((setW * k) / 32) + 's'); // ~32px per second
        hold(box);
      }
    }
    var vis = document.querySelector('.cta__visual');
    if (vis && !reduceMotion.matches) {
      vis.classList.add('is-vslide');
      Array.prototype.forEach.call(vis.querySelectorAll('.cta__vbelt'), function (belt) { belt.appendChild(dup(belt.firstElementChild)); });
      hold(vis);
    }
  })();

  /* ---------- 7e. How we work: on phones the steps are a horizontal scroll-snap row, so keyboard users can focus it to scroll ---------- */
  (function () {
    var flow = document.querySelector('.flow');
    if (!flow) return;
    var sync = function () { if (phone.matches) flow.setAttribute('tabindex', '0'); else flow.removeAttribute('tabindex'); };
    sync();
    phone.addEventListener('change', sync);
  })();

  /* ---------- 7c. Mockup only: the PDF buttons point nowhere yet (aria-disabled buttons, "available soon") ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-pdf-placeholder]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ---------- 8. Motion foundation (design system v3): GSAP 3.15.0 + ScrollTrigger, loaded with defer ----------
     Public API for later sections: window.DSMotion
       .enabled          true only when GSAP loaded AND the visitor has no reduced-motion preference
       .ease             'power3.out' (same curve as CSS --ease)
       .dur              { fast: .3, base: .5, slow: .7 } seconds (CSS --dur-fast/base/slow)
       .reveal(scope)    animate [data-reveal] and [data-reveal-group] inside scope (call after re-rendering)
       .countUp(el)      count el from 0 to the number already written in it
     Content is always correct in the HTML: without GSAP, without JS or with reduced motion nothing is hidden. */
  var DSMotion = {
    enabled: false,
    ease: 'power3.out',
    dur: { fast: 0.3, base: 0.5, slow: 0.7 },
    reveal: function () {},
    countUp: function () {}
  };
  window.DSMotion = DSMotion;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger && gsap.matchMedia) {
    try {
      gsap.registerPlugin(ScrollTrigger);
      var START = 'top 88%';

      var revealIn = function (scope) {
        scope = scope || document;
        // Opacity only (not visibility), so hidden-until-scrolled items stay reachable by keyboard and screen readers.
        Array.prototype.forEach.call(scope.querySelectorAll('[data-reveal]'), function (el) {
          if (el._dsRevealed) return;
          el._dsRevealed = true;
          gsap.from(el, {
            opacity: 0, y: 24, duration: DSMotion.dur.slow, ease: DSMotion.ease, clearProps: 'opacity,transform',
            scrollTrigger: { trigger: el, start: START, once: true }
          });
        });
        Array.prototype.forEach.call(scope.querySelectorAll('[data-reveal-group]'), function (group) {
          if (group._dsRevealed || !group.children.length) return;
          group._dsRevealed = true;
          gsap.from(group.children, {
            opacity: 0, y: 24, duration: DSMotion.dur.base, ease: DSMotion.ease, stagger: 0.08, clearProps: 'opacity,transform',
            scrollTrigger: { trigger: group, start: START, once: true }
          });
        });
      };

      var countUp = function (el) {
        if (el._dsCount) return;
        var finalText = el.textContent;
        var target = parseInt(finalText.replace(/[^\d]/g, ''), 10);
        if (!target) return;
        // Screen readers get the final number at once; the animated digits are aria-hidden.
        var shown = document.createElement('span');
        shown.setAttribute('aria-hidden', 'true');
        shown.textContent = '0';
        var spoken = document.createElement('span');
        spoken.className = 'sr-only';
        spoken.textContent = finalText;
        el.textContent = '';
        el.appendChild(shown);
        el.appendChild(spoken);
        el._dsCount = { finalText: finalText };
        var counter = { v: 0 };
        ScrollTrigger.create({
          trigger: el, start: 'top 92%', once: true,
          onEnter: function () {
            gsap.to(counter, {
              v: target, duration: 1.2, ease: 'power2.out',
              onUpdate: function () { shown.textContent = String(Math.round(counter.v)); },
              onComplete: function () { shown.textContent = String(target); }
            });
          }
        });
      };
      var restoreCounts = function () {
        Array.prototype.forEach.call(document.querySelectorAll('[data-countup]'), function (el) {
          if (el._dsCount) { el.textContent = el._dsCount.finalText; el._dsCount = null; }
        });
      };

      var mm = gsap.matchMedia();
      mm.add({ motionOK: '(prefers-reduced-motion: no-preference)' }, function (ctx) {
        if (!ctx.conditions.motionOK || reduceMotion.matches) return;
        DSMotion.enabled = true;
        DSMotion.reveal = revealIn;
        DSMotion.countUp = countUp;
        revealIn(document);
        // Group D extras: founder accent drifts with the scroll; the giant footer word rises into place. Both are off with reduced motion.
        var accent = document.querySelector('[data-parallax]');
        if (accent) gsap.fromTo(accent, { y: 22 }, { y: -22, ease: 'none', scrollTrigger: { trigger: accent.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
        var word = document.querySelector('.footer__word');
        if (word) gsap.fromTo(word, { yPercent: 16 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
        Array.prototype.forEach.call(document.querySelectorAll('[data-countup]'), countUp);
        // If the visitor switches to reduced motion, matchMedia reverts the tweens: everything shows at its final state.
        return function () {
          DSMotion.enabled = false;
          DSMotion.reveal = function () {};
          DSMotion.countUp = function () {};
          restoreCounts();
          Array.prototype.forEach.call(document.querySelectorAll('[data-reveal], [data-reveal-group]'), function (el) {
            el._dsRevealed = false;
            gsap.set(el.hasAttribute('data-reveal-group') ? el.children : el, { clearProps: 'opacity,transform' });
          });
        };
      });
    } catch (err) {
      // Any GSAP failure leaves the page exactly as written in the HTML.
      if (gsap && gsap.set) {
        gsap.set(document.querySelectorAll('[data-reveal], [data-reveal-group] > *'), { clearProps: 'opacity,transform' });
      }
    }
  }

  /* ---------- 9. Global motion toggle (pill at the inline-start bottom corner). aria-pressed = motion is paused.
     Pressing it applies the saved/new state to every hook registered above (hero, team) and to the CSS class. Hidden with reduced motion. */
  var motionBtn = document.querySelector('[data-motion-toggle]');
  if (motionBtn) {
    var motionLabel = motionBtn.querySelector('[data-motion-label]');
    MOTION.hooks.push(function (p) {
      motionBtn.setAttribute('aria-pressed', String(p));
      if (motionLabel) motionLabel.textContent = (p ? I18N.motionPlay : I18N.motionPause) || motionLabel.textContent;
    });
    motionBtn.addEventListener('click', function () { MOTION.set(!MOTION.paused, true); });
    var showMotionBtn = function () { motionBtn.hidden = reduceMotion.matches; };
    showMotionBtn();
    reduceMotion.addEventListener('change', showMotionBtn);
  }
  /* ---------- 10. Footer back-to-top: smooth scroll (instant with reduced motion), then focus the page top without scrolling again. ---------- */
  var topBtn = document.querySelector('.footer__top');
  if (topBtn) {
    topBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      var main = document.getElementById('main');
      if (main) { try { main.focus({ preventScroll: true }); } catch (err) { /* older browsers */ } }
    });
  }
  MOTION.set(MOTION.paused, false); // apply the saved state to every hook once everything is built
})();
