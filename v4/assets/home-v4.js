/* Dar Al-Shaheen — homepage v4 demo. Vanilla JS, no dependencies.
   Every feature degrades: without JS the page is fully readable, the first
   project/step/sector is shown, and the form posts nowhere (demo). */
(function () {
  'use strict';
  var root = document.documentElement;
  var isRtl = root.dir === 'rtl';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ---------- 1. Global motion switch (WCAG 2.2.2) ---------- */
  var pauseLabels = { pause: isRtl ? 'إيقاف الحركة' : 'Pause motion', play: isRtl ? 'تشغيل الحركة' : 'Play motion' };
  function motionPaused() { return root.classList.contains('motion-paused') || root.classList.contains('motion-off'); }
  function syncMotionButtons() {
    var p = motionPaused();
    $$('[data-motion-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', p ? 'true' : 'false');
      b.setAttribute('aria-label', p ? pauseLabels.play : pauseLabels.pause);
    });
    if (p) root.classList.add('motion-paused');
  }
  if (store.get('asco-motion') === 'off') root.classList.add('motion-off');
  $$('[data-motion-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (motionPaused()) { root.classList.remove('motion-paused', 'motion-off'); store.set('asco-motion', 'on'); }
      else { root.classList.add('motion-paused'); store.set('asco-motion', 'off'); }
      syncMotionButtons();
    });
  });
  syncMotionButtons();

  /* ---------- 2. Sticky bar state ---------- */
  var topbar = $('.topbar');
  function onScroll() { if (topbar) topbar.classList.toggle('is-scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- 3. Mobile menu (Esc closes, focus returns) ---------- */
  var drawer = $('#menu'), opener = $('.menubtn');
  function openMenu() {
    if (!drawer) return;
    drawer.classList.add('is-open'); drawer.removeAttribute('hidden');
    opener.setAttribute('aria-expanded', 'true');
    var first = $('a, button', drawer.querySelector('.drawer__panel')); if (first) first.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open'); drawer.setAttribute('hidden', '');
    opener.setAttribute('aria-expanded', 'false'); opener.focus();
    document.body.style.overflow = '';
  }
  if (drawer && opener) {
    opener.addEventListener('click', openMenu);
    $$('[data-close-menu]', drawer).forEach(function (el) { el.addEventListener('click', closeMenu); });
    $$('a.dl', drawer).forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
      if (e.key === 'Tab' && drawer.classList.contains('is-open')) {
        var f = $$('a, button', drawer.querySelector('.drawer__panel'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ---------- 4. Projects: sector filter with entrance animation ---------- */
  var seg = $('[data-filter-group]');
  if (seg) {
    var cards = $$('.pj');
    var status = $('#filter-status');
    $$('button', seg).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        $$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        var key = btn.getAttribute('data-filter');
        var shown = cards.filter(function (c) { return key === 'all' || c.getAttribute('data-sector') === key; });
        cards.forEach(function (c) { c.hidden = shown.indexOf(c) === -1; c.classList.remove('is-in', 'g-feat', 'g-side', 'g-third'); });
        shown.forEach(function (c, i) {
          var cls = i === 0 ? 'g-feat' : (i < 3 ? 'g-side' : 'g-third');
          c.classList.add(cls);
          var idx = $('.pj__idx', c); if (idx) idx.textContent = '0' + (i + 1);
          c.style.animationDelay = (i * 0.09) + 's';
          if (!reduce && !motionPaused()) restart(c, 'is-in');
        });
        if (status) status.textContent = (isRtl ? 'عدد المشاريع المعروضة: ' : 'Projects shown: ') + shown.length;
      });
    });
  }

  /* ---------- 5. How we work: step switcher ---------- */
  var steps = $$('.step');
  var stageImg = $('.stage__img'), stageT = $('.stage__t'), stageN = $('.stage__n b'), dots = $$('.stage__dots span');
  steps.forEach(function (s, i) {
    s.addEventListener('click', function () {
      if (s.getAttribute('aria-pressed') === 'true') return;
      steps.forEach(function (o) { o.setAttribute('aria-pressed', o === s ? 'true' : 'false'); });
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
      if (stageImg) {
        stageImg.src = s.getAttribute('data-img');
        stageImg.alt = s.getAttribute('data-alt');
        if (!reduce) restart(stageImg, 'is-in');
      }
      if (stageT) { stageT.textContent = $('.step__title', s).textContent; }
      if (stageN) stageN.textContent = '0' + (i + 1);
    });
  });

  /* ---------- 6. Sectors: auto-open every 3 s, pause on hover/focus ---------- */
  var secs = $$('.sec');
  if (secs.length) {
    var cur = 0, hold = false, visible = true, timer = null;
    function openSec(i, held) {
      cur = i;
      secs.forEach(function (s, j) {
        var on = j === i;
        s.classList.toggle('is-open', on);
        s.classList.toggle('is-hold', on && !!held);
        s.setAttribute('aria-current', on ? 'true' : 'false');
      });
      if (!held) { var bar = $('.pbar i', secs[i]); if (bar) restart(secs[i], 'is-open'); }
    }
    secs.forEach(function (s, i) {
      s.addEventListener('mouseenter', function () { hold = true; openSec(i, true); });
      s.addEventListener('focus', function () { hold = true; openSec(i, true); });
      s.addEventListener('mouseleave', function () { hold = false; secs[i].classList.remove('is-hold'); restart(secs[i], 'is-open'); });
      s.addEventListener('blur', function () { hold = false; secs[i].classList.remove('is-hold'); });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.25 }).observe($('.secrow'));
    }
    if (!reduce) {
      timer = setInterval(function () {
        if (hold || !visible || motionPaused() || document.hidden) return;
        openSec((cur + 1) % secs.length, false);
      }, 3000);
    }
  }

  /* ---------- 7. Quote form (demo: validates, then shows the success state) ---------- */
  var card = $('.formcard'), form = $('.form');
  if (card && form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      $$('[required]', form).forEach(function (f) {
        var ok = f.checkValidity();
        f.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok && !bad) bad = f;
      });
      if (bad) { bad.focus(); bad.reportValidity && bad.reportValidity(); return; }
      card.classList.add('is-sent');
      var msg = $('.sent', card); if (msg) { msg.setAttribute('tabindex', '-1'); msg.focus(); }
    });
    $$('[required]', form).forEach(function (f) {
      f.addEventListener('input', function () { if (f.getAttribute('aria-invalid') === 'true' && f.checkValidity()) f.setAttribute('aria-invalid', 'false'); });
    });
    var again = $('[data-form-reset]', card);
    if (again) again.addEventListener('click', function () { form.reset(); card.classList.remove('is-sent'); $('input', form).focus(); });
  }

  /* ---------- 8. Motion layer: reveal on scroll, headline words, counters, progress, parallax, spotlight ---------- */
  var still = reduce || root.classList.contains('motion-off');
  var sp = $('.scrollbar i');
  var pars = $$('[data-par]');
  var ticking = false;
  function onFrame() {
    ticking = false;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (sp) sp.style.setProperty('--sp', h > 0 ? (window.scrollY / h).toFixed(4) : 0);
    if (!still) pars.forEach(function (el) {
      var r = el.parentElement.getBoundingClientRect();
      var k = parseFloat(el.getAttribute('data-par')) || 0.1;
      el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - window.innerHeight / 2) * -k).toFixed(1) + 'px,0)';
    });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } }, { passive: true });
  window.addEventListener('resize', onFrame); onFrame();

  if (!still && 'IntersectionObserver' in window) {
    // headline words
    $$('.h2, .cta__text h2').forEach(function (h) {
      var i = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (c) {
          if (c.nodeType === 3 && c.textContent.trim()) {
            var frag = document.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--i', i++); w.textContent = part; frag.appendChild(w);
            });
            c.parentNode.replaceChild(frag, c);
          } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
        });
      })(h);
      if (!h.classList.contains('h2')) h.classList.add('h2-anim');
    });
    // groups: [selector, variant, stagger]
    var groups = [
      ['.stats li', '', .08], ['.clients', '', 0],
      ['.head .eyebrow', '', 0], ['.head .lead, .bignum', '', .15],
      ['.svc, .svc-cta', 'img', .07], ['.filterbar', '', 0], ['.pj', 'img', .08],
      ['.founder', 'side', 0], ['.about__text > .eyebrow, .about__p, .values li, .badges, .about__text > .btn', '', .07],
      ['.step', '', .08], ['.stage', 'img', 0],
      ['.team__text > *', '', .07], ['.team__stage', '', 0],
      ['.capcard', 'img', .12], ['.sec', 'img', .06],
      ['.cta__text > p, .cta__links', '', .1], ['.formcard', 'side', .1],
      ['.footer__cols > *', '', .08], ['.footer__bottom', '', 0]
    ];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    groups.forEach(function (g) {
      var parents = new Map();
      $$(g[0]).forEach(function (el) {
        var key = el.parentElement; var n = parents.get(key) || 0; parents.set(key, n + 1);
        el.classList.add('rv'); if (g[1]) el.classList.add('rv--' + g[1]);
        el.style.setProperty('--d', (n * g[2]).toFixed(2) + 's');
        io.observe(el);
      });
    });
    $$('.h2, .h2-anim').forEach(function (h) { io.observe(h); });

    // counters
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return; cio.unobserve(e.target);
        var el = e.target, node = null;
        Array.prototype.slice.call(el.childNodes).forEach(function (c) { if (c.nodeType === 3 && /\d/.test(c.textContent)) node = c; });
        if (!node) return;
        var m = node.textContent.match(/^(\D*)(\d[\d,]*)(\D*)$/); if (!m) return;
        var end = parseInt(m[2].replace(/,/g, ''), 10); if (end > 3000 || end < 2) return;
        var t0 = null, dur = 1400;
        (function step(t) {
          if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur); k = 1 - Math.pow(1 - k, 3);
          node.textContent = m[1] + Math.round(end * k) + m[3];
          if (k < 1) requestAnimationFrame(step);
        })(performance.now());
      });
    }, { threshold: 0.6 });
    $$('.stats .n, .minis b, .teambadge .row b, .sec__body .c b').forEach(function (el) { cio.observe(el); });
  }

  // pointer spotlight on photo cards
  $$('.svc, .pj, .sec').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- 9. CTA: interactive blueprint dot grid ---------- */
  (function () {
    var cv = $('.cta__dots'); if (!cv || !cv.getContext) return;
    var sec = cv.closest('.cta'), ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, gap = 26, pts = [], inView = false, raf = 0;
    var mx = -9999, my = -9999, tx = -9999, ty = -9999, energy = 0;
    function build() {
      var r = sec.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height; gap = W < 640 ? 22 : 26;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = [];
      for (var y = gap / 2; y < H; y += gap) for (var x = gap / 2; x < W; x += gap) pts.push(x, y);
      draw(performance.now());
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      mx += (tx - mx) * 0.12; my += (ty - my) * 0.12;
      var moving = !(still || motionPaused());
      var R = 170;
      for (var i = 0; i < pts.length; i += 2) {
        var x = pts[i], y = pts[i + 1];
        var dx = x - mx, dy = y - my, d = Math.sqrt(dx * dx + dy * dy);
        var near = d < R ? 1 - d / R : 0; near = near * near * energy;
        var wave = moving ? (Math.sin((x * 0.9 + y * 0.6) * 0.012 - t * 0.0016) + 1) / 2 : 0;
        wave = Math.pow(wave, 6) * 0.9;
        var k = Math.min(1, near + wave * 0.55);
        var rad = 1.05 + near * 3.2 + wave * 1.1;
        var px = x + (d > 0 ? dx / d : 0) * near * 6, py = y + (d > 0 ? dy / d : 0) * near * 6;
        ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + Math.round(140 + 78 * k) + ',' + Math.round(132 - 35 * k) + ',' + Math.round(126 - 93 * k) + ',' + (0.28 + 0.6 * k).toFixed(3) + ')';
        ctx.fill();
      }
      if (moving && inView) raf = requestAnimationFrame(draw); else raf = 0;
    }
    function kick() { if (!raf && inView && !(still || motionPaused())) raf = requestAnimationFrame(draw); }
    sec.addEventListener('pointermove', function (e) {
      var r = sec.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (mx < -999) { mx = tx; my = ty; } energy = 1; kick();
    });
    sec.addEventListener('pointerleave', function () { tx = ty = -9999; energy = 0.0; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { inView = en[0].isIntersecting; kick(); }).observe(sec);
    else inView = true;
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 150); });
    $$('[data-motion-toggle]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { kick(); if (motionPaused()) draw(performance.now()); }, 0); }); });
    build();
  })();

  /* ---------- 10. Year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
