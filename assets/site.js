/* ============================================================
   JTS SOLUTIONS shared script. Vanilla JS, no libraries.
   Every feature checks that its elements exist, so each page only
   runs the parts it uses. Storage access is wrapped in try/catch.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- config ---------- */
  // Every .js-booking element gets this URL (Calendly consultation call).
  var BOOKING_URL = 'https://calendly.com/solutionsfromjts/jts-solutions-consultation-call';

  var doc = document;
  var win = window;

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function mq(query) {
    try { return win.matchMedia(query).matches; } catch (e) { return false; }
  }

  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  var finePointer = mq('(hover: hover) and (pointer: fine)');

  /* Coalesce pointer work into one update per animation frame, per element. */
  function onFrame(el, key, fn) {
    el.__jtsQ = el.__jtsQ || {};
    el.__jtsQ[key] = fn;
    if (!el.__jtsRaf) {
      el.__jtsRaf = win.requestAnimationFrame(function () {
        var q = el.__jtsQ;
        el.__jtsRaf = 0;
        el.__jtsQ = {};
        Object.keys(q).forEach(function (k) { q[k](); });
      });
    }
  }

  /* ---------- 1. booking buttons ---------- */
  function wireBooking() {
    $$('.js-booking').forEach(function (el) {
      el.setAttribute('href', BOOKING_URL);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });
  }

  /* ---------- 2. theme toggle (restore runs inline in <head>) ---------- */
  function wireTheme() {
    var btn = $('#theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var root = doc.documentElement;
      if (root.getAttribute('data-theme') === 'light') {
        root.removeAttribute('data-theme');
        try { win.localStorage.setItem('jts-theme', 'dark'); } catch (e) { /* private mode */ }
      } else {
        root.setAttribute('data-theme', 'light');
        try { win.localStorage.setItem('jts-theme', 'light'); } catch (e) { /* private mode */ }
      }
    });
  }

  /* ---------- 3. nav: mobile menu, services dropdown, scrolled state ---------- */
  function wireNav() {
    var nav = $('nav.top');
    if (!nav) return;
    var menuBtn = $('.menu-btn', nav);
    var links = $('.nav-links', nav);
    var dd = $('.nav-dd', nav);
    var ddBtn = dd ? $('.nav-dd-btn', dd) : null;

    function setMenu(open) {
      nav.classList.toggle('is-menu-open', open);
      if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open && dd) setDropdown(false);
    }
    function setDropdown(open) {
      if (!dd) return;
      dd.classList.toggle('is-open', open);
      if (ddBtn) ddBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    if (menuBtn && links) {
      menuBtn.addEventListener('click', function () {
        setMenu(!nav.classList.contains('is-menu-open'));
      });
      // Close after a link is followed (same-page anchors included).
      links.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a') : null;
        if (a) setMenu(false);
      });
    }
    if (ddBtn) {
      ddBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setDropdown(!dd.classList.contains('is-open'));
      });
    }
    doc.addEventListener('click', function (e) {
      if (dd && !dd.contains(e.target)) setDropdown(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (dd && dd.classList.contains('is-open')) {
        setDropdown(false);
        if (ddBtn && dd.contains(doc.activeElement)) ddBtn.blur();
      }
      if (nav.classList.contains('is-menu-open')) {
        setMenu(false);
        if (menuBtn) menuBtn.focus();
      }
    });
    try {
      win.matchMedia('(min-width: 881px)').addEventListener('change', function (m) {
        if (m.matches) setMenu(false);
      });
    } catch (e) { /* older browsers: menu just stays as the user left it */ }

    function scrolled() {
      nav.classList.toggle('is-scrolled', (win.pageYOffset || doc.documentElement.scrollTop) > 8);
    }
    function syncNavHeight() {
      var h = nav.offsetHeight;
      if (h) doc.documentElement.style.setProperty('--nav-h', h + 'px');
    }
    syncNavHeight();
    win.addEventListener('resize', syncNavHeight);
    scrolled();
    nav.__jtsScrolled = scrolled;
  }

  /* ---------- 4. scroll loop: progress bar, nav state, pinned story ---------- */
  var scrollTasks = [];
  var scrollQueued = false;
  function runScrollTasks() {
    scrollQueued = false;
    scrollTasks.forEach(function (fn) { fn(); });
  }
  function onScrollOrResize() {
    if (scrollQueued) return;
    scrollQueued = true;
    win.requestAnimationFrame(runScrollTasks);
  }
  function addScrollTask(fn) {
    scrollTasks.push(fn);
    fn();
  }

  function wireProgress() {
    var bar = $('.progress span');
    if (!bar) return;
    addScrollTask(function () {
      var doc2 = doc.documentElement;
      var max = doc2.scrollHeight - doc2.clientHeight;
      var p = max > 0 ? clamp((win.pageYOffset || doc2.scrollTop) / max, 0, 1) : 0;
      bar.style.setProperty('--p', p.toFixed(4));
    });
  }

  function wireNavScrolled() {
    var nav = $('nav.top');
    if (nav && nav.__jtsScrolled) addScrollTask(nav.__jtsScrolled);
  }

  /* ---------- 5. hero: word-by-word headline, spotlight, tilt ---------- */
  function splitWords(el) {
    var idx = 0;
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = doc.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
            var s = doc.createElement('span');
            s.className = 'split-word';
            s.style.setProperty('--i', String(idx++));
            s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    }
    if (!reduceMotion) walk(el);
  }

  function wireHeadline() {
    var h1 = $('h1[data-split]');
    if (h1) splitWords(h1);
  }

  function bindSpotlight(el) {
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 100;
      var y = ((e.clientY - r.top) / r.height) * 100;
      onFrame(el, 'spot', function () {
        el.style.setProperty('--mx', x.toFixed(2) + '%');
        el.style.setProperty('--my', y.toFixed(2) + '%');
        el.style.setProperty('--spot-o', '1');
      });
    });
    el.addEventListener('pointerleave', function () {
      onFrame(el, 'spot', function () { el.style.setProperty('--spot-o', '0'); });
    });
  }

  function bindTilt(el) {
    var max = parseFloat(el.getAttribute('data-tilt')) || 8;
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      onFrame(el, 'tilt', function () {
        el.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-(py - 0.5) * 2 * max).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (px * r.width).toFixed(0) + 'px');
        el.style.setProperty('--gy', (py * r.height).toFixed(0) + 'px');
      });
    });
    el.addEventListener('pointerleave', function () {
      onFrame(el, 'tilt', function () {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  function bindMagnet(el) {
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) * 0.22;
      var y = (e.clientY - (r.top + r.height / 2)) * 0.3;
      onFrame(el, 'mag', function () {
        el.style.setProperty('--tx', clamp(x, -12, 12).toFixed(1) + 'px');
        el.style.setProperty('--ty', clamp(y, -10, 10).toFixed(1) + 'px');
      });
    });
    el.addEventListener('pointerleave', function () {
      onFrame(el, 'mag', function () {
        el.style.setProperty('--tx', '0px');
        el.style.setProperty('--ty', '0px');
      });
    });
  }

  function wireHeroEffects() {
    var hero = $('.hero');
    if (hero && finePointer && !reduceMotion) bindSpotlight(hero);
    if (finePointer && !reduceMotion) {
      $$('[data-tilt]').forEach(bindTilt);
      $$('.btn--primary').forEach(bindMagnet);
    }
  }

  /* hero before/after scenes: voicemail vs JTS */
  function wireHeroScenes() {
    var pain = $('#hv-pain'), jts = $('#hv-jts');
    if (!pain || !jts) return;
    var pRing = $('#hv-p-ring'), pVm = $('#hv-p-vm');
    var jRing = $('#hv-j-ring'), jTxt = $('#hv-j-txt');
    function show(el) { if (el) el.classList.add('hv-show'); }
    function hide(el) { if (el) el.classList.remove('hv-show'); }
    function reset() {
      [pRing, pVm, jRing, jTxt].forEach(hide);
      pain.classList.remove('hv-reacted');
      jts.classList.remove('hv-reacted');
    }
    if (reduceMotion) {
      show(pVm); show(jTxt);
      pain.classList.add('hv-reacted');
      jts.classList.add('hv-reacted');
      return;
    }
    var seq = [
      [0, function () { reset(); show(pRing); show(jRing); }],
      [1500, function () { hide(pRing); hide(jRing); }],
      [2100, function () { show(pVm); pain.classList.add('hv-reacted'); }],
      [2400, function () { show(jTxt); }],
      [3200, function () { jts.classList.add('hv-reacted'); }]
    ];
    function run() {
      seq.forEach(function (s) { win.setTimeout(s[1], s[0]); });
      win.setTimeout(run, 5600);
    }
    run();
  }

  /* ---------- 6. reveal on scroll + stagger ---------- */
  function wireReveal() {
    var els = $$('.reveal, .stagger');
    $$('.stagger').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty('--i', String(i));
      });
    });
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in win)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 7. stat count-up ---------- */
  function animateNumber(from, to, setter, decimals, duration) {
    decimals = decimals || 0;
    duration = duration || 600;
    var start = win.performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var val = from + (to - from) * eased;
      setter(decimals === 0 ? val : +val.toFixed(decimals));
      if (t < 1) win.requestAnimationFrame(tick);
      else setter(decimals === 0 ? to : +to.toFixed(decimals));
    }
    win.requestAnimationFrame(tick);
  }

  function wireStats() {
    var nums = $$('.stat-num[data-target]');
    if (!nums.length) return;
    if (reduceMotion || !('IntersectionObserver' in win)) return; // final text is already in the HTML
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = +el.getAttribute('data-target');
        var suffix = el.getAttribute('data-suffix') || '';
        el.textContent = '0' + suffix;
        animateNumber(0, target, function (val) { el.textContent = Math.round(val) + suffix; });
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 8. rotating industry word (problem headline) ---------- */
  function wireRotator() {
    var el = $('#problem-industry');
    if (!el || reduceMotion) return;
    var words = ['HVAC contractors', 'Plumbers', 'Electricians', 'Roofers', 'Landscapers', 'Contractors'];
    var idx = 0;
    win.setInterval(function () {
      idx = (idx + 1) % words.length;
      el.classList.add('rot-out');
      win.setTimeout(function () {
        el.textContent = words[idx];
        el.classList.remove('rot-out');
        el.classList.add('rot-in');
        win.requestAnimationFrame(function () {
          win.requestAnimationFrame(function () { el.classList.remove('rot-in'); });
        });
      }, 340);
    }, 2400);
  }

  /* ---------- 9. ROI calculator (missed-call revenue) ---------- */
  function wireCalculator() {
    var callsRange = $('#calc-calls');
    if (!callsRange) return;
    var jobRange = $('#calc-job'), closeRange = $('#calc-close');
    var callsNum = $('#calc-calls-num'), jobNum = $('#calc-job-num'), closeNum = $('#calc-close-num');
    var outLoss = $('#out-loss'), outRecover = $('#out-recover'), outNet = $('#out-net'), outMult = $('#out-mult');
    var reset = $('#calc-reset');
    if (!jobRange || !closeRange || !callsNum || !jobNum || !closeNum || !outLoss || !outRecover || !outNet || !outMult) return;

    var JTS_ANNUAL = 397 * 12;   // Growth plan, $397/mo
    var TOOL_ANNUAL = 0;
    var DEFAULTS = { calls: 60, job: 425, close: 30 }; // industry average (HVAC)
    var lastValues = { lossYr: 0, recYr: 0, netYr: 0, mult: 0 };

    function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

    function calcValues() {
      var calls = +callsRange.value;
      var job = +jobRange.value;
      var close = +closeRange.value / 100;
      var lossYr = calls * 12 * close * job;
      var recYr = lossYr * 0.35;
      var netYr = recYr - JTS_ANNUAL - TOOL_ANNUAL;
      var mult = recYr > 0 ? recYr / (JTS_ANNUAL + TOOL_ANNUAL) : 0;
      return { lossYr: lossYr, recYr: recYr, netYr: netYr, mult: mult };
    }

    function recalc(skipAnimate) {
      var v = calcValues();
      if (skipAnimate) {
        outLoss.textContent = '-$' + fmt(v.lossYr) + '/yr';
        outRecover.textContent = '+$' + fmt(v.recYr) + '/yr';
        outNet.textContent = '$' + fmt(Math.max(0, v.netYr)) + '/yr net';
        outMult.textContent = v.mult.toFixed(1) + '×';
      } else {
        animateNumber(lastValues.lossYr, v.lossYr, function (val) { outLoss.textContent = '-$' + fmt(val) + '/yr'; });
        animateNumber(lastValues.recYr, v.recYr, function (val) { outRecover.textContent = '+$' + fmt(val) + '/yr'; });
        animateNumber(lastValues.netYr, Math.max(0, v.netYr), function (val) { outNet.textContent = '$' + fmt(val) + '/yr net'; });
        animateNumber(lastValues.mult, v.mult, function (val) { outMult.textContent = val.toFixed(1) + '×'; }, 2);
      }
      lastValues = v;
    }

    function setCalc(calls, job, close) {
      callsRange.value = calls; callsNum.value = calls;
      jobRange.value = job; jobNum.value = job;
      closeRange.value = close; closeNum.value = close;
      recalc(true);
    }

    function syncRange(range, num) {
      range.addEventListener('input', function () { num.value = range.value; recalc(); });
      num.addEventListener('input', function () {
        var v = +num.value || 0;
        v = Math.max(+num.min, Math.min(+num.max, v));
        range.value = v;
        recalc();
      });
    }
    syncRange(callsRange, callsNum);
    syncRange(jobRange, jobNum);
    syncRange(closeRange, closeNum);

    if (reset) {
      reset.addEventListener('click', function () {
        setCalc(DEFAULTS.calls, DEFAULTS.job, DEFAULTS.close);
      });
    }
    setCalc(DEFAULTS.calls, DEFAULTS.job, DEFAULTS.close);
  }

  /* ---------- 10. phone demo (missed-call page) ---------- */
  function wirePhoneDemo() {
    var callScreen = $('#call-screen');
    var replay = $('#demo-replay');
    if (!callScreen) return;
    var missedBanner = $('#missed-banner');
    var messagesScreen = $('#messages-screen');
    var messagesBody = $('#messages-body');
    var ownerNotif1 = $('#owner-notif-1');
    var ownerNotif2 = $('#owner-notif-2');
    var ownerPhone = $('#owner-phone');
    var stepsEls = $$('.demo-step');
    if (!missedBanner || !messagesScreen || !messagesBody || !ownerNotif1 || !ownerNotif2 || !ownerPhone) return;

    // Example business used in the demo (fictional).
    var DEMO = {
      biz: 'Apex HVAC',
      avatar: 'A',
      custMsg: "Hey, my AC just died and it's 95° in here. Can someone come today?",
      ownerAlert: 'AC repair, urgent. Sarah M. (555) 0142',
      ownerTitle: 'New lead — booked!'
    };
    var demoState = { hasPlayed: false, playing: false, timeouts: [] };

    function setText(id, text) { var el = $('#' + id); if (el) el.textContent = text; }
    setText('biz-name-call', DEMO.biz);
    setText('biz-name-missed', DEMO.biz + ' · just now');
    setText('biz-name-msgs', DEMO.biz);
    var avatarEl = $('.call-avatar');
    if (avatarEl) avatarEl.textContent = DEMO.avatar;
    setText('notif-body-2', DEMO.ownerAlert + ' — Today 2pm');
    setText('notif-title-2', DEMO.ownerTitle);

    function setStep(n) {
      stepsEls.forEach(function (s) { s.classList.toggle('active', +s.getAttribute('data-step') === n); });
    }
    function clearDemo() {
      demoState.timeouts.forEach(function (t) { clearTimeout(t); });
      demoState.timeouts = [];
      demoState.playing = false;
      callScreen.classList.remove('show', 'ringing');
      missedBanner.classList.remove('show');
      messagesScreen.classList.remove('show');
      messagesBody.innerHTML = '';
      ownerNotif1.classList.remove('show');
      ownerNotif2.classList.remove('show');
      ownerPhone.classList.remove('phone--lit');
      setStep(1);
    }
    function schedule(fn, t) {
      demoState.timeouts.push(win.setTimeout(fn, t));
    }
    function scrollBubbles() { messagesBody.scrollTop = messagesBody.scrollHeight; }
    function addBubble(html, type, cls) {
      var b = doc.createElement('div');
      b.className = 'bubble bubble--' + type + ' ' + (cls || '');
      b.innerHTML = html;
      messagesBody.appendChild(b);
      win.requestAnimationFrame(function () { b.classList.add('show'); scrollBubbles(); });
      return b;
    }
    function addBookingCard() {
      var card = doc.createElement('div');
      card.className = 'booking-card';
      card.innerHTML =
        '<div class="booking-title">Pick a time</div>' +
        '<div class="slot-row">' +
        '<div class="slot" id="slot-1"><small>TODAY</small>2:00 PM</div>' +
        '<div class="slot" id="slot-2"><small>TODAY</small>4:00 PM</div>' +
        '<div class="slot" id="slot-3"><small>TOMORROW</small>9:00 AM</div>' +
        '</div>';
      messagesBody.appendChild(card);
      win.requestAnimationFrame(function () { card.classList.add('show'); scrollBubbles(); });
    }
    function showTyping() {
      var t = doc.createElement('div');
      t.className = 'typing';
      t.innerHTML = '<span></span><span></span><span></span>';
      messagesBody.appendChild(t);
      win.requestAnimationFrame(function () { t.classList.add('show'); scrollBubbles(); });
    }

    function playDemo() {
      if (demoState.playing) return;
      clearDemo();
      demoState.playing = true;
      demoState.hasPlayed = true;

      schedule(function () { callScreen.classList.add('show', 'ringing'); setStep(1); }, 0);
      schedule(function () { callScreen.classList.remove('ringing', 'show'); }, 1800);
      schedule(function () { missedBanner.classList.add('show'); }, 2100);
      schedule(function () { ownerPhone.classList.add('phone--lit'); ownerNotif1.classList.add('show'); }, 2500);
      schedule(function () { missedBanner.classList.remove('show'); }, 3300);
      schedule(function () { messagesScreen.classList.add('show'); setStep(2); }, 3700);
      schedule(function () {
        var time = doc.createElement('div');
        time.className = 'bubble bubble--time show';
        time.textContent = 'Auto-reply · ~30s after missed call';
        messagesBody.appendChild(time);
        addBubble('Hi! Sorry we missed you. Reply with:<br><br>1 — Book online<br>2 — Get a callback<br>3 — Ask a question', 'in');
      }, 4500);
      schedule(function () { setStep(3); showTyping(); }, 6200);
      schedule(function () {
        var typing = messagesBody.querySelector('.typing');
        if (typing) typing.remove();
        addBubble(DEMO.custMsg, 'out');
      }, 7600);
      schedule(function () { addBookingCard(); }, 9200);
      schedule(function () { var slot = $('#slot-1'); if (slot) slot.classList.add('selected'); }, 10600);
      schedule(function () {
        setStep(4);
        addBubble("Booked for Today, 2:00 PM. We'll see you then.", 'in');
      }, 11600);
      schedule(function () { ownerNotif2.classList.add('show'); }, 12500);
      schedule(function () { demoState.playing = false; }, 16000);
    }
    function restartDemo() {
      clearDemo();
      schedule(playDemo, 200);
    }

    if (replay) replay.addEventListener('click', restartDemo);

    var section = $('#how');
    if (section && 'IntersectionObserver' in win && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !demoState.hasPlayed) playDemo();
        });
      }, { threshold: 0.35 });
      io.observe(section);
    }
  }

  /* ---------- 11. pinned scroll story (desktop) / stacked list (mobile, reduced motion) ---------- */
  function wireStory() {
    var story = $('#story');
    if (!story) return;
    var stage = $('.story-sticky', story);
    var items = $$('[data-from]', story);
    var steps = $$('[data-n]', story);
    var total = steps.length || 5;
    var mqPin = null;
    try { mqPin = win.matchMedia('(min-width: 881px) and (prefers-reduced-motion: no-preference)'); } catch (e) { mqPin = null; }
    var current = -1;
    var pinned = false;

    function update(n) {
      if (n === current) return;
      current = n;
      items.forEach(function (el) { el.classList.toggle('is-on', +el.getAttribute('data-from') <= n); });
      steps.forEach(function (el) { el.classList.toggle('is-active', +el.getAttribute('data-n') === n); });
      story.setAttribute('data-step', String(n));
    }

    function setPinned(on) {
      pinned = on;
      story.classList.toggle('story--pinned', on);
      current = -1;
      if (on) {
        storyFrame();
      } else {
        update(total);
      }
    }

    // The stage sticks just below the main nav (nav height + 16px, the same
    // value as the CSS top offset). It starts sticking when its natural top
    // reaches that line and stops when its bottom reaches the bottom of the
    // story's content box.
    function stickLine() {
      var nav = $('nav.top');
      return (nav ? nav.offsetHeight : 72) + 16;
    }
    function storyFrame() {
      if (!pinned || !stage) return;
      var r = story.getBoundingClientRect();
      var cs = win.getComputedStyle(story);
      var padTop = parseFloat(cs.paddingTop) || 0;
      var padBottom = parseFloat(cs.paddingBottom) || 0;
      var travel = story.offsetHeight - padTop - padBottom - stage.offsetHeight;
      var naturalTop = r.top + padTop; // the stage is the first child, so it sits at the padding edge
      var p = travel > 0 ? (stickLine() - naturalTop) / travel : 1;
      p = clamp(p, 0, 0.999);
      update(Math.min(total, Math.floor(p * total) + 1));
    }

    setPinned(!!(mqPin && mqPin.matches));
    if (mqPin && mqPin.addEventListener) {
      mqPin.addEventListener('change', function (m) { setPinned(m.matches); });
    }
    addScrollTask(storyFrame);
  }

  /* ---------- 12. billing toggle (missed-call plans) ---------- */
  function wireBilling() {
    var group = $('[data-billing-group]');
    if (!group) return;
    var buttons = $$('[data-billing]', group);
    var amounts = $$('[data-price]');
    var note = $('[data-billing-note]');
    var notes = {
      m: 'Month-to-month. Cancel anytime.',
      6: 'Prepaid every 6 months.',
      12: 'Prepaid every 12 months. Save up to $1,080 a year.'
    };

    function show(key) {
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-billing') === key ? 'true' : 'false');
      });
      amounts.forEach(function (el) {
        var to = +el.getAttribute('data-' + key);
        if (!to) return;
        var from = +(el.getAttribute('data-shown') || el.textContent.replace(/[^0-9.]/g, '')) || to;
        el.setAttribute('data-shown', String(to));
        animateNumber(from, to, function (val) { el.textContent = String(Math.round(val)); }, 0, 420);
      });
      if (note) note.textContent = notes[key] || '';
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-billing')); });
    });
  }

  /* ---------- 13. section spy for in-page sub-navs (custom builds) ---------- */
  function wireSpy() {
    var links = $$('a[data-spy]');
    if (!links.length || !('IntersectionObserver' in win)) return;
    var byId = {};
    links.forEach(function (a) {
      var id = (a.getAttribute('href') || '').split('#')[1];
      if (id) { (byId[id] = byId[id] || []).push(a); }
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        (byId[e.target.id] || []).forEach(function (a) { a.classList.add('is-active'); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(byId).forEach(function (id) {
      var sec = doc.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  /* ---------- boot ---------- */
  function init() {
    wireBooking();
    wireTheme();
    wireNav();
    wireProgress();
    wireNavScrolled();
    wireHeadline();
    wireHeroEffects();
    wireHeroScenes();
    wireReveal();
    wireStats();
    wireRotator();
    wireCalculator();
    wirePhoneDemo();
    wireStory();
    wireBilling();
    wireSpy();
    win.addEventListener('scroll', onScrollOrResize, { passive: true });
    win.addEventListener('resize', onScrollOrResize);
    onScrollOrResize();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
