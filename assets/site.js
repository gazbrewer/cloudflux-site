/* Shared helpers for the missed-call calculator, the missed-jobs check, and founder forms. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Cloudflux = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var WEEKS_PER_MONTH = 4.33;
  var FIELD_LABELS = {
    business_name: 'Business name',
    trade: 'Trade',
    town: 'Town',
    contact_name: 'Contact name',
    email: 'Email',
    phone: 'Phone',
    plan: 'Plan',
    missed_calls_per_week: 'Missed calls per week',
    consent: 'Consent',
    website: 'Website'
  };

  function readNumber(value, max) {
    var n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n) || n < 0) n = 0;
    if (max != null && n > max) n = max;
    return n;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function roundPence(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function formatGbp(n) {
    var cents = Math.round(n * 100);
    var digits = cents % 100 === 0 ? 0 : 2;
    return (cents / 100).toLocaleString('en-GB', {style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: 2});
  }

  function formatCount(n) {
    var rounded = round2(n);
    return rounded.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 2});
  }

  function trim(value) {
    return String(value == null ? '' : value).trim();
  }

  function labelFor(field) {
    if (!field) return '';
    return FIELD_LABELS[field] || field;
  }

  /* Yearly figure used by /never-miss-a-job/ : calls × 52 × book rate × job value. */
  function yearlyMissedRevenue(callsPerWeek, jobValue, bookPercent) {
    var calls = readNumber(callsPerWeek);
    var value = readNumber(jobValue);
    var rate = readNumber(bookPercent, 100);
    return calls * 52 * (rate / 100) * value;
  }

  /* Self-check. Every input is the visitor's own figure. Monthly = weekly × 4.33. */
  function missedJobsEstimate(input) {
    input = input || {};
    var mode = input.mode === 'percent' ? 'percent' : 'count';
    var calls = round2(readNumber(input.callsPerWeek));
    var onJob = round2(readNumber(input.onJob, mode === 'percent' ? 100 : null));
    var evenings = round2(readNumber(input.evenings, mode === 'percent' ? 100 : null));
    var weekends = round2(readNumber(input.weekends, mode === 'percent' ? 100 : null));
    var value = roundPence(readNumber(input.jobValue));
    var competitor = round2(readNumber(input.competitorPercent, 100));
    var realJobs = round2(readNumber(input.realJobPercent, 100));
    var percentSum = round2(onJob + evenings + weekends);
    var percentCapped = false;
    var unanswered;
    if (mode === 'percent') {
      var used = percentSum;
      if (used > 100) { used = 100; percentCapped = true; }
      unanswered = round2(calls * used / 100);
    } else {
      unanswered = round2(onJob + evenings + weekends);
    }
    var jobsPerWeek = round2(unanswered * (competitor / 100) * (realJobs / 100));
    var jobsPerMonth = round2(jobsPerWeek * WEEKS_PER_MONTH);
    var lostPerMonth = roundPence(jobsPerMonth * value);
    var lostPerYear = roundPence(lostPerMonth * 12);
    var roundedUnanswered = Math.round(unanswered);
    var formCapped = roundedUnanswered > 200;
    var missedCallsForForm = roundedUnanswered;
    if (missedCallsForForm < 0) missedCallsForForm = 0;
    if (missedCallsForForm > 200) missedCallsForForm = 200;
    return {
      callsPerWeek: calls,
      mode: mode,
      onJob: onJob,
      evenings: evenings,
      weekends: weekends,
      jobValue: value,
      competitorPercent: competitor,
      realJobPercent: realJobs,
      percentSum: percentSum,
      percentUsed: mode === 'percent' ? (percentCapped ? 100 : percentSum) : null,
      percentCapped: percentCapped,
      unansweredPerWeek: unanswered,
      exceedsCalls: mode === 'count' && calls > 0 && unanswered > calls,
      jobsPerWeek: jobsPerWeek,
      jobsPerMonth: jobsPerMonth,
      lostPerMonth: lostPerMonth,
      lostPerYear: lostPerYear,
      missedCallsForForm: missedCallsForForm,
      formCapped: formCapped
    };
  }

  function assumptionLines(est) {
    var lines = [];
    if (est.mode === 'percent') {
      lines.push('Unanswered calls per week = ' + formatCount(est.percentUsed) + '% of the ' + formatCount(est.callsPerWeek) + ' calls you receive = ' + formatCount(est.unansweredPerWeek) + '. That percentage is your split: ' + formatCount(est.onJob) + '% while on a job, ' + formatCount(est.evenings) + '% evenings and ' + formatCount(est.weekends) + '% weekends.');
      if (est.percentCapped) {
        lines.push('Those percentages add up to ' + formatCount(est.percentSum) + '%, so unanswered calls are capped at 100% of the calls you said you receive.');
      }
    } else {
      lines.push('Unanswered calls per week = while on a job + evenings + weekends = ' + formatCount(est.onJob) + ' + ' + formatCount(est.evenings) + ' + ' + formatCount(est.weekends) + ' = ' + formatCount(est.unansweredPerWeek) + '.');
      lines.push('Calls you receive are not part of this sum, because you entered unanswered calls as numbers.');
      if (est.exceedsCalls) {
        lines.push('Your unanswered total is higher than the calls you said you receive. The result uses the unanswered total you entered.');
      }
    }
    lines.push('Missed jobs per week = unanswered calls × the share you said ring a competitor instead × the share you said are real jobs = ' + formatCount(est.unansweredPerWeek) + ' × ' + formatCount(est.competitorPercent) + '% × ' + formatCount(est.realJobPercent) + '% = ' + formatCount(est.jobsPerWeek) + '.');
    lines.push('Missed jobs per month = missed jobs per week × 4.33 = ' + formatCount(est.jobsPerWeek) + ' × 4.33 = ' + formatCount(est.jobsPerMonth) + '. Monthly = weekly × 4.33.');
    lines.push('£ lost per month = missed jobs per month × your average job value = ' + formatCount(est.jobsPerMonth) + ' × ' + formatGbp(est.jobValue) + ' = ' + formatGbp(est.lostPerMonth) + '.');
    lines.push('£ lost per year = £ lost per month × 12 = ' + formatGbp(est.lostPerMonth) + ' × 12 = ' + formatGbp(est.lostPerYear) + '.');
    lines.push('The competitor share and the real-job share are the percentages you set. They start at 50% for you to change. That starting point is not taken from anywhere else.');
    lines.push('Job counts are rounded to two decimal places. Pounds are rounded to the nearest penny.');
    if (est.formCapped) {
      lines.push('The form below asks for a whole number from 0 to 200, so missed calls per week there is capped at 200. The result above uses your full unanswered total.');
    } else if (Math.round(est.unansweredPerWeek) !== est.unansweredPerWeek) {
      lines.push('Missed calls per week on the form is your unanswered total rounded to a whole number (' + est.missedCallsForForm + ').');
    }
    lines.push('All figures are your own estimates.');
    return lines;
  }

  function isUkPhone(value) {
    var compact = String(value || '').replace(/[\s().-]/g, '');
    if (/^0044/.test(compact)) compact = '+44' + compact.slice(4);
    if (/^\+440/.test(compact)) compact = '+44' + compact.slice(4);
    if (/^\+44/.test(compact)) return /^[1-9]\d{8,9}$/.test(compact.slice(3));
    return /^0[1-9]\d{8,9}$/.test(compact);
  }

  function parseMissedCalls(value) {
    var s = trim(value);
    if (!/^\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    if (n < 0 || n > 200) return null;
    return n;
  }

  function addError(rows, field, message) {
    rows.push({field: field, label: labelFor(field), message: message});
  }

  function founderApplicationFromFields(fields) {
    fields = fields || {};
    var missed = parseMissedCalls(fields.missed_calls_per_week);
    var payload = {
      business_name: trim(fields.business_name),
      trade: trim(fields.trade),
      town: trim(fields.town),
      contact_name: trim(fields.contact_name),
      email: trim(fields.email),
      phone: trim(fields.phone),
      plan: 'starter',
      missed_calls_per_week: missed,
      consent: fields.consent === true,
      website: fields.website == null ? '' : String(fields.website)
    };
    var errors = [];
    if (payload.business_name.length < 2 || payload.business_name.length > 80) addError(errors, 'business_name', 'Enter your business name (2 to 80 characters).');
    if (payload.trade.length < 2 || payload.trade.length > 80) addError(errors, 'trade', 'Enter your trade (2 to 80 characters).');
    if (payload.town.length < 2 || payload.town.length > 80) addError(errors, 'town', 'Enter your town (2 to 80 characters).');
    if (payload.contact_name.length < 2 || payload.contact_name.length > 60) addError(errors, 'contact_name', 'Enter a contact name (2 to 60 characters).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 120) addError(errors, 'email', 'Enter an email address.');
    if (!isUkPhone(payload.phone)) addError(errors, 'phone', 'Enter a UK phone number.');
    if (payload.plan !== 'starter') addError(errors, 'plan', 'Plan must be starter.');
    if (missed === null) addError(errors, 'missed_calls_per_week', 'Enter missed calls per week as a whole number from 0 to 200.');
    if (payload.consent !== true) addError(errors, 'consent', 'Tick the box to agree to being contacted about this founder place.');
    return {payload: payload, errors: errors};
  }

  function messageText(val) {
    if (val == null) return '';
    if (Array.isArray(val)) {
      return val.map(messageText).filter(Boolean).join(', ');
    }
    if (typeof val === 'object') return val.message || val.error || '';
    return String(val);
  }

  function fieldErrorRows(fields) {
    var rows = [];
    if (!fields) return rows;
    if (Array.isArray(fields)) {
      fields.forEach(function (item) {
        if (typeof item === 'string') { rows.push({field: '', label: '', message: item}); return; }
        if (!item || typeof item !== 'object') return;
        var field = item.field || item.name || item.key || '';
        rows.push({field: field, label: labelFor(field), message: messageText(item.message || item.error || item.detail || '')});
      });
      return rows;
    }
    if (typeof fields === 'object') {
      Object.keys(fields).forEach(function (field) {
        rows.push({field: field, label: labelFor(field), message: messageText(fields[field])});
      });
    }
    return rows;
  }

  function joinFieldErrors(rows) {
    if (!rows || !rows.length) return 'Please check the form and try again.';
    return rows.map(function (row) {
      return row.label ? row.label + ': ' + row.message : row.message;
    }).join(' ');
  }

  function describeFounderResponse(status, body) {
    body = body && typeof body === 'object' ? body : {};
    if (status === 200) {
      var message = typeof body.message === 'string' && body.message ? body.message : 'Thanks. We have your details.';
      var places = body.places_left;
      var hasPlaces = !(places === undefined || places === null || places === '');
      return {kind: 'ok', message: message, placesLeft: hasPlaces ? places : null, fields: null};
    }
    if (status === 400) {
      var rows = fieldErrorRows(body.fields);
      return {kind: 'bad', message: joinFieldErrors(rows), placesLeft: null, fields: rows};
    }
    if (status === 409 || status === 429) {
      var err = typeof body.error === 'string' && body.error ? body.error : 'We could not send that just now. Email hello@cloudflux.uk and we will take it from there.';
      return {kind: 'bad', message: err, placesLeft: null, fields: null};
    }
    var other = typeof body.error === 'string' && body.error ? body.error : 'We could not send that just now. Email hello@cloudflux.uk and we will take it from there.';
    return {kind: 'bad', message: other, placesLeft: null, fields: null};
  }

  function postJson(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.text().then(function (text) {
        var parsed = false;
        var body = null;
        if (text) {
          try { body = JSON.parse(text); parsed = true; } catch (e) { parsed = false; }
        }
        return {status: r.status, ok: r.ok, body: parsed ? body : null, parsed: parsed};
      });
    });
  }

  return {
    WEEKS_PER_MONTH: WEEKS_PER_MONTH,
    readNumber: readNumber,
    formatGbp: formatGbp,
    formatCount: formatCount,
    yearlyMissedRevenue: yearlyMissedRevenue,
    missedJobsEstimate: missedJobsEstimate,
    assumptionLines: assumptionLines,
    isUkPhone: isUkPhone,
    founderApplicationFromFields: founderApplicationFromFields,
    fieldErrorRows: fieldErrorRows,
    joinFieldErrors: joinFieldErrors,
    describeFounderResponse: describeFounderResponse,
    postJson: postJson
  };
});
