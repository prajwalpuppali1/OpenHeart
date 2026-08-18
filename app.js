/* OpenHeart — 13-question cardiac risk check.
   Scoring per OpenHeart technical spec v1.0 (additive, max 25):
   0–8 lower · 9–16 moderate · 17–25 higher.
   Scoring runs entirely in this tab. The only thing ever sent anywhere is
   the optional ZIP, which goes to our clinic-lookup Worker (see /worker). */

(function () {
  'use strict';

  // Deployed clinic-lookup Worker URL, e.g. 'https://openheart-clinics.YOURNAME.workers.dev'.
  // Leave '' to disable inline results (the HRSA search button still works).
  var CLINIC_API = 'https://openheart-clinics.openheart.workers.dev';

  var QUESTIONS = [
    { cat: 'About you', q: 'How old are you?',
      opts: [['Under 30', 0], ['30–44', 1], ['45–59', 2], ['60 or older', 3]] },
    { cat: 'About you', q: 'What was your sex at birth?',
      help: 'Risk patterns differ by biological sex. Answer however you’re comfortable.',
      opts: [['Male', 1], ['Female', 0], ['Prefer not to say', 1]] },
    { cat: 'Your health history', q: 'Has a parent, brother, or sister had heart disease before age 65?',
      opts: [['Yes', 2], ['Not sure', 1], ['No', 0]] },
    { cat: 'Your health history', q: 'Has a doctor or nurse ever said you have high blood pressure?',
      opts: [['Yes, diagnosed', 2], ['Borderline, or I think so', 1], ['No', 0]] },
    { cat: 'Your health history', q: 'Have you ever been told you have high cholesterol?',
      opts: [['Yes, diagnosed', 2], ['Borderline, or not sure', 1], ['No', 0]] },
    { cat: 'Your health history', q: 'Do you smoke or use tobacco?',
      help: 'Cigarettes, vapes, chew: they all count.',
      opts: [['Yes, currently', 2], ['I quit', 1], ['Never', 0]] },
    { cat: 'Your health history', q: 'Do you have diabetes or pre-diabetes?',
      opts: [['Yes, diabetes (Type 1 or 2)', 2], ['Pre-diabetes', 1], ['No', 0]] },
    { cat: 'Your habits', q: 'How much do you move in a normal week?',
      help: '150 minutes is about 20 minutes a day, and walking counts.',
      opts: [['Active: 150 minutes or more', 0], ['Somewhat active', 1], ['Mostly sitting', 2]] },
    { cat: 'Your habits', q: 'Which is closest to how you eat most days?',
      opts: [['Mostly fresh or home-cooked', 0], ['A real mix', 1], ['Mostly fast food or packaged', 2]] },
    { cat: 'Your habits', q: 'How would you describe your weight?',
      opts: [['Around a healthy range', 0], ['Somewhat overweight', 1], ['Well above a healthy range', 2]] },
    { cat: 'Right now', q: 'Have you had any of these lately, or right now?', multi: true,
      help: 'Check any that apply.',
      opts: [['Chest pain, pressure, or tightness', 3], ['Short of breath at rest or with light activity', 2], ['Dizzy or lightheaded often', 1], ['None of these', 0]] },
    { cat: 'Your care', q: 'When did you last see a doctor for a check-up?',
      opts: [['Within the last year', 0], ['1–3 years ago', 1], ['More than 3 years ago', 2], ['Never', 2]] },
    { cat: 'Find care near you', type: 'zip', q: 'What’s your ZIP code?',
      help: 'Used once to find free and low-cost clinics near you. Never stored.' }
  ];

  var CHEST_PAIN_INDEX = 10;

  var HRSA = 'https://findahealthcenter.hrsa.gov/';
  var CHECK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ARROW_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var LINKS = {
    hrsa:    { href: HRSA, label: 'Find a community health center', sub: 'Free and sliding-scale care near you, no insurance needed' },
    aha:     { href: 'https://www.heart.org/en/healthy-living', label: 'American Heart Association', sub: 'Trusted heart-healthy living guides' },
    teladoc: { href: 'https://www.teladochealth.com', label: 'Teladoc', sub: 'Telehealth visits from any phone' },
    mdlive:  { href: 'https://www.mdlive.com', label: 'MDLIVE', sub: 'Telehealth for urgent and primary care' },
    needy:   { href: 'https://www.needymeds.org', label: 'NeedyMeds', sub: 'Help paying for medications' },
    samhsa:  { href: 'tel:+18006624357', label: 'SAMHSA helpline: 1-800-662-4357', sub: 'Free, confidential support, 24/7' }
  };

  var TIERS = {
    low: {
      name: 'Lower risk',
      cls: 'low',
      msg: 'Your answers suggest a lower risk of heart disease right now, and that’s worth protecting. Hearts stay strong through small, steady, daily habits, not big dramatic changes. Keep going.',
      steps: [
        'Keep moving. About 20 minutes a day is enough to matter, and walking counts.',
        'Eat fresh where you can; ease off packaged and fried food.',
        'Get a free blood-pressure check once a year. Many pharmacies and clinics do it at no cost.',
        'Come back and re-check if your health or symptoms change.'
      ],
      links: ['aha', 'hrsa'],
      next: { hash: '#/education', label: 'Keep what you have', sub: 'Short, plain-language reads on protecting your heart' }
    },
    mod: {
      name: 'Moderate risk',
      cls: 'mod',
      msg: 'Your answers show some real risk factors. Here’s the honest good news: caught early, almost every one of them can be managed, and the first step is a simple, inexpensive visit, not a hospital.',
      steps: [
        'Book a basic heart check (blood pressure, cholesterol, blood sugar) at a community health center. They charge based on income, often $0.',
        'If getting there is hard, a telehealth visit works from any phone.',
        'Bring your score and ask: “What should I work on first?”',
        'If you ever feel chest pain or real shortness of breath, treat it as urgent. Don’t wait.'
      ],
      links: ['hrsa', 'teladoc', 'mdlive', 'aha'],
      next: { hash: '#/access', label: 'Here’s where to go next', sub: 'Clinics that will see you, insured or not' }
    },
    high: {
      name: 'Higher risk',
      cls: 'high',
      msg: 'Your answers point to several serious risk factors. This isn’t a diagnosis, but it is a strong reason to see a clinician soon, ideally within the next couple of weeks. No insurance and no money are not barriers: community health centers must see you, and charge by what you can afford, including nothing.',
      steps: [
        'Find a community health center below and ask for a heart-health check: blood pressure, cholesterol, and blood sugar.',
        'Say it plainly: “I scored high on a heart-risk check and I’d like to be seen soon.” Aim for the next two weeks.',
        'If medication becomes part of your plan, NeedyMeds can help cover the cost.',
        'If this feels heavy, the SAMHSA helpline is free, confidential, and open 24/7.'
      ],
      links: ['hrsa', 'needy', 'samhsa'],
      next: { hash: '#/access', label: 'Here’s where to go next', sub: 'Clinics that will see you, insured or not' }
    }
  };

  // Each '#/name' route is a <section id="view-name">; show() reveals one of them.
  var views = {};
  ['home', 'about', 'prevention', 'education', 'access', 'recovery', 'involved', 'quiz', 'results']
    .forEach(function (n) { views[n] = document.getElementById('view-' + n); });

  var qcard = document.getElementById('qcard');
  var qcount = document.getElementById('qcount');
  var qbar = document.getElementById('qbar');
  var qfill = document.getElementById('qfill');
  var resbody = document.getElementById('resbody');

  var state = { i: 0, picks: new Array(12).fill(null), zip: '' };

  function show(name) {
    Object.keys(views).forEach(function (k) {
      views[k].classList.toggle('hidden', k !== name);
    });
    window.scrollTo(0, 0);
  }

  function startQuiz() {
    state = { i: 0, picks: new Array(12).fill(null), zip: '' };
    show('quiz');
    render();
  }

  /* Routing. '#/name' picks a view. A bare '#anchor' is an in-page scroll
     target, so it must not steal the view from whatever is already showing. */
  function route() {
    var h = window.location.hash;
    if (h.charAt(1) !== '/') {
      if (views.home.classList.contains('hidden')) {
        show('home');
        var el = h.length > 1 && document.getElementById(h.slice(1));
        if (el) el.scrollIntoView();
      }
      return;
    }
    var name = h.slice(2);
    if (name === 'check') { startQuiz(); return; }
    show(views[name] && name !== 'results' ? name : 'home');
  }

  function go(hash) {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  }

  function quizInProgress() {
    return !views.quiz.classList.contains('hidden') && state.picks.some(function (p) { return p !== null; });
  }

  // back === true when the user went backwards, so the card enters from the
  // side it left toward (enter and exit share one path).
  function render(back) {
    var i = state.i;
    var q = QUESTIONS[i];
    qcount.textContent = (i + 1) + ' of ' + QUESTIONS.length;
    qbar.setAttribute('aria-valuenow', String(i + 1));
    qfill.style.transform = 'scaleX(' + ((i + 1) / QUESTIONS.length) + ')';

    var html = '<p class="q-cat">' + q.cat + '</p>';

    if (q.type === 'zip') {
      html +=
        '<h2 class="q-title" id="qtitle" tabindex="-1">' + q.q + '</h2>' +
        (q.help ? '<p class="q-help">' + q.help + '</p>' : '') +
        '<div class="zip-row">' +
          '<input class="zip-input" id="zipin" inputmode="numeric" maxlength="5" placeholder="•••••" aria-label="5-digit ZIP code">' +
          '<button type="submit" class="btn btn-primary btn-lg">See my results</button>' +
        '</div>' +
        '<p class="zip-err" id="ziperr">Please enter a 5-digit ZIP code, or skip below.</p>' +
        '<div class="q-nav">' +
          '<button type="button" class="back-link" id="qback">← Back</button>' +
          '<button type="button" class="skip-link" id="zipskip">Skip and see results without clinics</button>' +
        '</div>';
      qcard.innerHTML = html;

      var zipin = document.getElementById('zipin');
      zipin.value = state.zip;
      document.getElementById('zipskip').addEventListener('click', function () {
        state.zip = '';
        finish();
      });
    } else if (q.multi) {
      html +=
        '<h2 class="q-title" id="qtitle" tabindex="-1">' + q.q + '</h2>' +
        (q.help ? '<p class="q-help">' + q.help + '</p>' : '') +
        '<fieldset class="opts" aria-labelledby="qtitle">';
      var sel = (state.picks[i] && state.picks[i].idxs) || [];
      var noneIdx = -1;
      q.opts.forEach(function (opt, oi) {
        if (opt[1] === 0) noneIdx = oi;
        var checked = sel.indexOf(oi) !== -1 ? ' checked' : '';
        html +=
          '<div class="opt">' +
            '<input type="checkbox" id="o' + oi + '" value="' + oi + '"' + checked + '>' +
            '<label for="o' + oi + '"><span class="checkbox" aria-hidden="true"></span>' + opt[0] + '</label>' +
          '</div>';
      });
      html += '</fieldset>' +
        '<div class="q-nav">' +
          (i > 0 ? '<button type="button" class="back-link" id="qback">← Back</button>' : '<span></span>') +
          '<button type="button" class="btn btn-primary" id="qnext">Continue</button>' +
        '</div>';
      qcard.innerHTML = html;

      var boxes = qcard.querySelectorAll('input[type=checkbox]');
      Array.prototype.forEach.call(boxes, function (bx) {
        bx.addEventListener('change', function () {
          var oi = parseInt(bx.value, 10);
          if (bx.checked && oi === noneIdx) {
            Array.prototype.forEach.call(boxes, function (o) { if (o !== bx) o.checked = false; });
          } else if (bx.checked && noneIdx !== -1) {
            boxes[noneIdx].checked = false;
          }
        });
      });

      document.getElementById('qnext').addEventListener('click', function () {
        var idxs = [], maxPts = 0;
        Array.prototype.forEach.call(boxes, function (bx) {
          if (bx.checked) {
            var oi = parseInt(bx.value, 10);
            idxs.push(oi);
            if (q.opts[oi][1] > maxPts) maxPts = q.opts[oi][1];
          }
        });
        state.picks[i] = { idxs: idxs, pts: maxPts };
        advance();
      });
    } else {
      html +=
        '<h2 class="q-title" id="qtitle" tabindex="-1">' + q.q + '</h2>' +
        (q.help ? '<p class="q-help">' + q.help + '</p>' : '') +
        '<fieldset class="opts" aria-labelledby="qtitle">';
      q.opts.forEach(function (opt, oi) {
        var checked = state.picks[i] && state.picks[i].idx === oi ? ' checked' : '';
        html +=
          '<div class="opt">' +
            '<input type="radio" name="q' + i + '" id="o' + oi + '" value="' + oi + '"' + checked + '>' +
            '<label for="o' + oi + '"><span class="radio" aria-hidden="true"></span>' + opt[0] + '</label>' +
          '</div>';
      });
      html += '</fieldset>' +
        '<div class="q-nav">' +
          (i > 0 ? '<button type="button" class="back-link" id="qback">← Back</button>' : '<span></span>') +
        '</div>';
      qcard.innerHTML = html;

      var advancing = false;
      var choose = function (inp) {
        var oi = parseInt(inp.value, 10);
        state.picks[i] = { idx: oi, pts: q.opts[oi][1] };
        if (advancing) return;
        advancing = true;
        window.setTimeout(function () {
          if (state.i === i) advance();
        }, 300);
      };
      var inputs = qcard.querySelectorAll('input[type=radio]');
      Array.prototype.forEach.call(inputs, function (inp) {
        inp.addEventListener('change', function () { choose(inp); });
        inp.addEventListener('click', function () { choose(inp); });
      });
    }

    var backBtn = document.getElementById('qback');
    if (backBtn) backBtn.addEventListener('click', function () { state.i--; render(true); });

    qcard.classList.remove('enter', 'enter-back');
    void qcard.offsetWidth;
    qcard.classList.add(back ? 'enter-back' : 'enter');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function advance() {
    if (state.i < QUESTIONS.length - 1) {
      state.i++;
      render();
    }
  }

  qcard.addEventListener('submit', function (e) {
    e.preventDefault();
    var zipin = document.getElementById('zipin');
    if (!zipin) return;
    var v = zipin.value.trim();
    if (/^\d{5}$/.test(v)) {
      state.zip = v;
      finish();
    } else {
      document.getElementById('ziperr').classList.add('show');
      zipin.focus();
    }
  });

  function score() {
    return state.picks.reduce(function (sum, p) { return sum + (p ? p.pts : 0); }, 0);
  }

  function finish() {
    var s = score();
    var tierKey = s <= 8 ? 'low' : s <= 16 ? 'mod' : 'high';
    var t = TIERS[tierKey];
    var cp = state.picks[CHEST_PAIN_INDEX];
    var chestPain = !!(cp && ((cp.idxs && cp.idxs.indexOf(0) !== -1) || cp.pts === 3));
    var deg = (s / 25 * 180 - 90).toFixed(1);

    var html = '';

    if (chestPain) {
      html +=
        '<div class="urgent" role="alert">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/></svg>' +
          '<div><strong>You said you’re having chest pain right now.</strong>' +
          '<p>Don’t wait on a website. <a href="tel:911">Call 911</a> or have someone take you to the nearest emergency room. ERs must treat you in an emergency, insured or not.</p></div>' +
        '</div>';
    }

    html +=
      '<div class="score-wrap">' +
        '<svg class="gauge t-' + t.cls + '" viewBox="0 0 200 118" role="img" aria-label="Risk score ' + s + ' out of 25, ' + t.name.toLowerCase() + '">' +
          '<path class="gz gz-track" d="M20 100 A80 80 0 0 1 180 100" pathLength="25"/>' +
          '<path class="gz gz-low" d="M20 100 A80 80 0 0 1 180 100" pathLength="25" style="stroke-dasharray:7.85 25"/>' +
          '<path class="gz gz-mod" d="M20 100 A80 80 0 0 1 180 100" pathLength="25" style="stroke-dasharray:7.7 25;stroke-dashoffset:-8.15"/>' +
          '<path class="gz gz-high" d="M20 100 A80 80 0 0 1 180 100" pathLength="25" style="stroke-dasharray:8.85 25;stroke-dashoffset:-16.15"/>' +
          '<g class="needle" id="needle"><line x1="100" y1="100" x2="100" y2="34" stroke="#f3f6f9" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="5.5" fill="#f3f6f9"/></g>' +
        '</svg>' +
        '<div>' +
          '<p class="score-eyebrow">Your result</p>' +
          '<div class="score-line"><span class="pts">' + s + '</span> <span class="of">/ 25</span></div>' +
          '<div class="tier-name t-' + t.cls + '-text">' + t.name + '</div>' +
        '</div>' +
      '</div>';

    html += '<div class="tier-card t-' + t.cls + '">' + t.msg + '</div>';

    // A result must never dead-end: every tier routes onward to a page.
    html +=
      '<a class="next-step" href="' + t.next.hash + '">' +
        '<span>' +
          '<span class="next-eyebrow">Where to go from here</span>' +
          '<span class="next-label">' + t.next.label + '</span>' +
          '<span class="next-sub">' + t.next.sub + '</span>' +
        '</span>' + ARROW_SVG +
      '</a>';

    html += '<h2 class="res-h">Do this next</h2><ul class="checklist">';
    t.steps.forEach(function (stp) {
      html += '<li>' + CHECK_SVG + '<span>' + stp + '</span></li>';
    });
    html += '</ul>';

    html +=
      '<div class="clinic-card">' +
        '<h2>Free care near you</h2>' +
        '<p>Community health centers are funded to serve everyone, insured or not. They charge based on what you can afford, often nothing.</p>' +
        '<div class="clinic-list" id="cliniclist"></div>' +
        '<a class="btn btn-primary" href="' + HRSA + '" target="_blank" rel="noopener">' + (state.zip ? 'See all clinics near ' + state.zip : 'Find clinics near you') + '</a>' +
      '</div>';

    html += '<h2 class="res-h">Helpful places</h2><div class="res-links">';
    t.links.forEach(function (key) {
      var L = LINKS[key];
      var ext = L.href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '';
      html +=
        '<a class="res-link" href="' + L.href + '"' + ext + '>' +
          '<span>' + L.label + '<span class="sub">' + L.sub + '</span></span>' + ARROW_SVG +
        '</a>';
    });
    html += '</div>';

    html +=
      '<div class="restart-row">' +
        '<button class="btn btn-ghost" id="res-restart">Start over</button>' +
        '<button class="btn btn-ghost" id="res-home">Back to home</button>' +
      '</div>';

    html +=
      '<div class="disclaimer">This risk check uses common factors but can miss things only a clinician can catch. If something feels wrong, trust your body and seek care. In an emergency, call 911.</div>';

    resbody.innerHTML = html;
    show('results');

    document.getElementById('res-restart').addEventListener('click', function () { go('#/check'); });
    document.getElementById('res-home').addEventListener('click', function () { go('#/'); });

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        document.getElementById('needle').style.setProperty('--r', deg + 'deg');
      });
    });

    loadClinics(state.zip, 'cliniclist');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadClinics(zip, boxId) {
    var box = document.getElementById(boxId);
    var api = (typeof window.OPENHEART_API === 'string' && window.OPENHEART_API) || CLINIC_API;
    if (!box || !zip || !api) return;

    box.innerHTML = '<p class="clinic-status">Finding clinics near ' + zip + '&hellip;</p>';
    var done = false;
    var fail = function () {
      if (done) return;
      done = true;
      box.innerHTML = '<p class="clinic-status">Couldn&rsquo;t load clinics right now. Use the search button below.</p>';
    };
    var timer = window.setTimeout(fail, 8000);

    fetch(api + '?zip=' + encodeURIComponent(zip))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        var list = (d && d.clinics) || [];
        if (!list.length) {
          box.innerHTML = '<p class="clinic-status">No centers found for that ZIP. Try the full search below.</p>';
          return;
        }
        box.innerHTML = list.map(function (c) {
          var raw = String(c.phone || '');
          var extMatch = raw.match(/[xX,;]\s*(\d+)\s*$/);
          var mainNum = extMatch ? raw.slice(0, extMatch.index).trim() : raw;
          var tel = mainNum.replace(/\D/g, '');
          var place = [c.city, c.state].filter(Boolean).join(', ');
          var meta = [c.address, place].filter(Boolean).join(' · ') + (c.miles ? ' · ' + c.miles + ' mi' : '');
          return '<div class="clinic-item"><div class="clinic-info"><div class="clinic-nm">' + esc(c.name) + '</div>' +
            '<div class="clinic-meta">' + esc(meta) + '</div></div>' +
            (tel ? '<a class="clinic-tel" href="tel:+1' + tel + '">' + esc(mainNum) +
              (extMatch ? '<span class="clinic-ext">ext ' + esc(extMatch[1]) + '</span>' : '') +
            '</a>' : '') +
            '</div>';
        }).join('');
      })
      .catch(function () { window.clearTimeout(timer); fail(); });
  }

  /* ---------- content pages (everything editable lives in content.js) ---------- */

  var CONTENT = window.OH_CONTENT || {};

  function paras(arr) {
    return arr.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  }

  // Education library. An entry with no body yet is listed as coming soon
  // rather than opening onto an empty page.
  function renderResources() {
    var box = document.getElementById('reslib');
    if (!box) return;
    var list = CONTENT.resources || [];
    box.innerHTML = list.map(function (r) {
      if (r.draft || !(r.body && r.body.length)) {
        return '<div class="res-item is-draft">' +
          '<span class="rm-status is-soon">Coming soon</span>' +
          '<h3>' + esc(r.title) + '</h3>' +
          '<p class="res-s">' + esc(r.summary) + '</p>' +
          '</div>';
      }
      return '<details class="res-item">' +
        '<summary><span class="res-sum">' +
          '<span class="res-t">' + esc(r.title) + '</span>' +
          '<span class="res-s">' + esc(r.summary) + '</span>' +
        '</span></summary>' +
        '<div class="res-body">' + paras(r.body) + '</div>' +
        (r.es
          ? '<details class="res-es"><summary>Leer en espa&ntilde;ol</summary>' +
              '<div class="res-body"><h3>' + esc(r.es.title) + '</h3>' + paras(r.es.body) + '</div>' +
            '</details>'
          : '') +
        '</details>';
    }).join('');
  }

  // Referral partners. Unconfirmed fields say so instead of inventing a value.
  function renderPartners() {
    var box = document.getElementById('partners');
    if (!box) return;
    var list = CONTENT.clinics || [];
    if (!list.length) {
      box.innerHTML = '<p class="clinic-status">Partner clinics are being confirmed. Use the ZIP search above in the meantime.</p>';
      return;
    }
    box.innerHTML = list.map(function (c) {
      var facts = [['Where', c.where], ['Phone', c.phone], ['Hours', c.hours],
                   ['Cost', c.cost], ['What to expect', c.expect]]
        .map(function (f) {
          var val = '<em class="tbc">being confirmed</em>';
          if (f[1] && f[0] === 'Phone') val = '<a href="tel:+1' + f[1].replace(/\D/g, '') + '">' + esc(f[1]) + '</a>';
          else if (f[1]) val = esc(f[1]);
          return '<dt>' + f[0] + '</dt><dd>' + val + '</dd>';
        }).join('');
      return '<div class="partner">' +
        (c.anchor ? '<span class="rm-status is-live">Anchor partner</span>' : '') +
        '<h3>' + esc(c.name) + '</h3>' +
        (c.what ? '<p>' + esc(c.what) + '</p>' : '') +
        '<dl class="partner-facts">' + facts + '</dl>' +
        (c.site ? '<a class="res-link" href="' + esc(c.site) + '" target="_blank" rel="noopener"><span>Visit their website</span>' + ARROW_SVG + '</a>' : '') +
        (c.draft ? '<p class="draft-note">We are still confirming these details with the clinic. Please call ahead before you travel.</p>' : '') +
        '</div>';
    }).join('');
  }

  var accessForm = document.getElementById('accessform');
  if (accessForm) {
    accessForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('accesszip').value.trim();
      var err = document.getElementById('accesserr');
      if (/^\d{5}$/.test(v)) {
        err.classList.remove('show');
        loadClinics(v, 'accesslist');
      } else {
        err.classList.add('show');
      }
    });
  }

  /* ---------- home: scroll-scrubbed heart turntable ----------
     A 48-frame render of a 3D heart, scrubbed across a fixed 640px of travel.
     Frame count and step count are deliberately independent: the frames want
     to be as smooth as the budget allows, while the three steps beside them
     light in quarters, the fourth quarter being the release where nothing is
     highlighted. Disabled on narrow screens and under reduced-motion, where
     the sticky stage would hijack the page and the sequence is dead weight. */
  (function () {
    var FRAME_COUNT = 72;
    var SEGMENTS = 4;            // 3 steps + 1 release quarter
    var FRAME_PATH = 'img/heart/f%.webp';

    var scrolly = document.querySelector('.nh-scrolly');
    var wrap = scrolly && scrolly.querySelector('.nh-frames');
    var beats = scrolly && Array.prototype.slice.call(scrolly.querySelectorAll('.nh-beats li'));
    if (!scrolly || !wrap) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var narrow = window.matchMedia('(max-width: 880px)');

    var frames = Array.prototype.slice.call(wrap.querySelectorAll('img'));
    var loaded = false;

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    /* Preload every frame, then swap the static placeholder for the sequence.
       Gate on the load event, NOT on decode(): decode() never settles for a
       detached image in a backgrounded tab, which would leave the heart
       permanently missing for anyone who opens the page in a background tab.
       The timeout is a second guard so one dead frame cannot block the swap. */
    function loadSequence() {
      if (loaded || reduced.matches || narrow.matches) return;
      loaded = true;

      var pending = FRAME_COUNT;
      var swapped = false;
      var incoming = [];

      function swap() {
        if (swapped) return;
        swapped = true;
        var stat = wrap.querySelector('img');
        for (var n = 0; n < incoming.length; n++) wrap.appendChild(incoming[n]);
        frames = incoming;
        if (stat) stat.remove();
        current = -1;
        onScroll();
        /* Warm the decoder once the frames are attached. Not awaited: decode()
           never settles for a detached image in a background tab, so this is a
           best-effort smoothing pass, never a gate on showing the heart. */
        for (var d = 0; d < frames.length; d++) {
          if (frames[d].decode) frames[d].decode().catch(function () {});
        }
      }
      function settle() { if (--pending <= 0) swap(); }

      for (var n = 0; n < FRAME_COUNT; n++) {
        var img = new Image();
        img.alt = '';
        img.decoding = 'async';
        img.addEventListener('load', settle);
        img.addEventListener('error', settle);
        img.src = FRAME_PATH.replace('%', pad(n));
        incoming.push(img);
      }
      window.setTimeout(swap, 8000);
    }

    /* Phones get the scrub too, just without the heart: the steps still
       highlight and magnify as the section passes. Shorter travel there, since
       there is no 72-frame turn to spend it on. Reduced-motion opts out of the
       sticky stage entirely and reads as a plain stacked list. */
    function setHeight() {
      scrolly.style.height = reduced.matches ? ''
        : narrow.matches ? 'calc(100svh + 420px)'
        : 'calc(100vh + 640px)';
    }

    var current = -1, queued = false;
    function paint() {
      queued = false;
      var travel = scrolly.offsetHeight - window.innerHeight;
      if (travel <= 0) return;
      var p = Math.min(1, Math.max(0, -scrolly.getBoundingClientRect().top / travel));

      var i = Math.min(frames.length - 1, Math.floor(p * frames.length));
      if (i !== current) {
        if (current > -1 && frames[current]) frames[current].classList.remove('on');
        frames[i].classList.add('on');
        current = i;
      }
      // past the last step the section is releasing: b runs off the end of the
      // list, nothing matches, and every step drops back to unhighlighted
      var b = Math.floor(p * SEGMENTS);
      for (var n = 0; n < beats.length; n++) beats[n].classList.toggle('on', n === b);
    }
    function onScroll() { if (!queued) { queued = true; requestAnimationFrame(paint); } }

    setHeight();
    loadSequence();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { setHeight(); loadSequence(); onScroll(); });
    if (reduced.addEventListener) reduced.addEventListener('change', setHeight);
    paint();
  }());

  /* ---------- boot ---------- */

  Array.prototype.forEach.call(document.querySelectorAll('[data-start]'), function (btn) {
    btn.addEventListener('click', function () { go('#/check'); });
  });

  // Leaving mid-quiz throws the answers away, so confirm first and put the
  // hash back if they decline (the revert fires hashchange again: ignore it).
  var lastHash = window.location.hash;
  var reverting = false;
  window.addEventListener('hashchange', function () {
    if (reverting) { reverting = false; return; }
    if (quizInProgress() && !window.confirm('Leave your heart check? Your answers will be cleared.')) {
      reverting = true;
      window.location.hash = lastHash;
      return;
    }
    lastHash = window.location.hash;
    route();
  });

  renderResources();
  renderPartners();
  route();
})();
