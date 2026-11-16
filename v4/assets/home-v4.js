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

  /* ---------- 8. Year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
