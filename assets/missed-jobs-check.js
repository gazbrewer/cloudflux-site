/* Wires the missed-jobs self-check and its founder form. Calculation lives in site.js. */
(function () {
  var cf = window.Cloudflux;
  var check = document.getElementById('self-check');
  var founder = document.getElementById('founder-form');
  if (!cf || !check || !founder) return;

  var tradeSelect = document.getElementById('trade');
  var tradeOtherLabel = document.getElementById('trade-other-label');
  var tradeOther = document.getElementById('trade-other');
  var founderTrade = document.getElementById('founder-trade');
  var missedInput = founder.elements.missed_calls_per_week;
  var useUnanswered = document.getElementById('use-unanswered');
  var status = document.getElementById('status');
  var btn = document.getElementById('submit-btn');
  var tradeDirty = false;
  var missedDirty = false;

  function selectedTrade() {
    if (tradeSelect.value === 'other') return tradeOther.value.trim();
    return tradeSelect.value;
  }

  function syncOther() {
    tradeOtherLabel.hidden = tradeSelect.value !== 'other';
  }

  function syncModeFields() {
    var percent = document.getElementById('mode-percent').checked;
    ['on-job', 'evenings', 'weekends'].forEach(function (id) {
      var el = document.getElementById(id);
      if (percent) {
        el.max = '100';
        if (cf.readNumber(el.value) > 100) el.value = '100';
      } else {
        el.removeAttribute('max');
      }
    });
    document.getElementById('split-hint').textContent = percent
      ? 'Each box is a percentage of the calls you receive in a week. Your own rough split.'
      : 'Each box is a number of calls. Your own rough split.';
  }

  function readInput() {
    return {
      mode: document.getElementById('mode-percent').checked ? 'percent' : 'count',
      callsPerWeek: document.getElementById('calls-week').value,
      onJob: document.getElementById('on-job').value,
      evenings: document.getElementById('evenings').value,
      weekends: document.getElementById('weekends').value,
      jobValue: document.getElementById('job-value').value,
      competitorPercent: document.getElementById('competitor').value,
      realJobPercent: document.getElementById('real-jobs').value
    };
  }

  function render() {
    syncModeFields();
    var est = cf.missedJobsEstimate(readInput());
    document.getElementById('jobs-month').textContent = cf.formatCount(est.jobsPerMonth);
    document.getElementById('lost-month').textContent = cf.formatGbp(est.lostPerMonth);
    document.getElementById('lost-year').textContent = cf.formatGbp(est.lostPerYear);
    document.getElementById('dock-jobs').textContent = cf.formatCount(est.jobsPerMonth);
    document.getElementById('dock-month').textContent = cf.formatGbp(est.lostPerMonth);
    document.getElementById('dock-year').textContent = cf.formatGbp(est.lostPerYear);
    document.getElementById('competitor-out').textContent = Math.round(est.competitorPercent) + '%';
    document.getElementById('real-out').textContent = Math.round(est.realJobPercent) + '%';
    var unanswered = document.getElementById('unanswered-live');
    unanswered.textContent = 'Unanswered per week from your figures: ' + cf.formatCount(est.unansweredPerWeek) + '.';
    var list = document.getElementById('assumptions');
    list.textContent = '';
    cf.assumptionLines(est).forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    });
    if (!missedDirty) missedInput.value = String(est.missedCallsForForm);
    useUnanswered.textContent = 'Use your unanswered total (' + est.missedCallsForForm + ')';
    if (!tradeDirty) founderTrade.value = selectedTrade();
  }

  function onCheckEdit(e) {
    if (e.target && e.target.id === 'trade') tradeDirty = false;
    syncOther();
    render();
  }

  check.addEventListener('input', onCheckEdit);
  check.addEventListener('change', onCheckEdit);
  check.addEventListener('submit', function (e) { e.preventDefault(); });

  founderTrade.addEventListener('input', function () { tradeDirty = true; });
  missedInput.addEventListener('input', function () { missedDirty = true; });
  useUnanswered.addEventListener('click', function () {
    missedDirty = false;
    render();
  });

  tradeOther.addEventListener('input', function () { render(); });

  function clearErrors() {
    founder.querySelectorAll('.err').forEach(function (el) { el.remove(); });
    status.textContent = '';
  }

  function showOutcome(outcome) {
    status.textContent = '';
    var p = document.createElement('p');
    p.className = 'status ' + (outcome.kind === 'ok' ? 'ok' : 'bad');
    p.appendChild(document.createTextNode(outcome.message));
    if (outcome.kind === 'ok' && outcome.placesLeft !== null && outcome.placesLeft !== undefined) {
      var places = document.createElement('span');
      places.className = 'places-left';
      places.textContent = 'Places left: ' + outcome.placesLeft + '.';
      p.appendChild(places);
    }
    status.appendChild(p);
    status.scrollIntoView({behavior: 'smooth', block: 'center'});
  }

  function showFieldRows(rows) {
    (rows || []).forEach(function (row) {
      if (!row.field || !founder.elements[row.field]) return;
      var el = founder.elements[row.field];
      var span = document.createElement('span');
      span.className = 'err';
      span.textContent = row.message;
      (el.closest('label') || el.parentNode).appendChild(span);
    });
  }

  founder.addEventListener('focusin', function () { document.body.classList.add('dock-off'); });
  founder.addEventListener('focusout', function (e) {
    if (!founder.contains(e.relatedTarget)) document.body.classList.remove('dock-off');
  });

  if ('IntersectionObserver' in window) {
    var resultCard = document.getElementById('result');
    var dockWatch = new IntersectionObserver(function (entries) {
      document.body.classList.toggle('result-visible', entries[0].isIntersecting);
    }, { threshold: 0.45 });
    dockWatch.observe(resultCard);
  }

  founder.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    var built = cf.founderApplicationFromFields({
      business_name: founder.elements.business_name.value,
      trade: founder.elements.trade.value,
      town: founder.elements.town.value,
      contact_name: founder.elements.contact_name.value,
      email: founder.elements.email.value,
      phone: founder.elements.phone.value,
      missed_calls_per_week: founder.elements.missed_calls_per_week.value,
      consent: founder.elements.consent.checked === true,
      website: founder.elements.website.value
    });
    if (built.errors.length) {
      showOutcome({kind: 'bad', message: cf.joinFieldErrors(built.errors), placesLeft: null});
      showFieldRows(built.errors);
      return;
    }
    if (String(built.payload.website).trim()) {
      founder.hidden = true;
      showOutcome({kind: 'ok', message: 'Thanks. We have your application and will reply to the business email you gave. If you hear nothing, email hello@cloudflux.uk.', placesLeft: null});
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    cf.postJson(founder.action, built.payload)
      .then(function (result) {
        var outcome = cf.describeFounderResponse(result.status, result.parsed ? result.body : null);
        if (outcome.kind === 'ok') founder.hidden = true;
        showOutcome(outcome);
        if (outcome.fields) showFieldRows(outcome.fields);
      })
      .catch(function () {
        showOutcome({kind: 'bad', message: 'We could not reach our server. Email hello@cloudflux.uk and we will take it from there.', placesLeft: null});
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Claim a founder place';
      });
  });

  syncOther();
  render();
})();
