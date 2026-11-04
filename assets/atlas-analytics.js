/* ATLAS - mesure J+7 facultative, minimisation des données.
   Aucune donnée ne quitte l'appareil avant un consentement explicite. */
(function () {
  'use strict';
  var consentKey = 'atlas-analytics-consent-v1';
  var visitorKey = 'atlas-analytics-visitor-v1';
  var sent = Object.create(null);

  function stored(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }
  function save(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }
  function forget(key) {
    try { window.localStorage.removeItem(key); } catch (_) {}
  }
  function agreed() { return stored(consentKey) === 'yes'; }
  function backend() { return typeof cloud !== 'undefined' ? cloud : null; }
  function todayUTC() { return new Date().toISOString().slice(0, 10); }
  function source() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (!params.has('utm_source')) {
        var hashQuery = (window.location.hash || '').split('?')[1] || '';
        params = new URLSearchParams(hashQuery);
      }
      return params.get('utm_source') === 'instagram' ? 'instagram' : 'direct';
    } catch (_) { return 'direct'; }
  }
  function visitor() {
    if (!agreed()) return null;
    var id = stored(visitorKey);
    if (id && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) return id;
    if (!window.crypto || !window.crypto.randomUUID) return null;
    id = window.crypto.randomUUID();
    return save(visitorKey, id) ? id : null;
  }
  function earliestMission(s) {
    var dates = ((s && s.missions) || []).map(function (m) {
      return m && m.createdAt ? new Date(m.createdAt) : null;
    }).filter(function (d) { return d && Number.isFinite(d.getTime()); })
      .sort(function (a, b) { return a - b; });
    return dates.length ? dates[0].toISOString().slice(0, 10) : null;
  }
  function retentionWindow(firstDay, visitDay) {
    var first = Date.parse(firstDay + 'T00:00:00Z');
    var visit = Date.parse(visitDay + 'T00:00:00Z');
    if (!Number.isFinite(first) || !Number.isFinite(visit)) return false;
    var days = Math.round((visit - first) / 86400000);
    return days >= 7 && days <= 13;
  }
  function record(type, firstMissionDay) {
    if (!agreed()) return;
    var client = backend(), id = visitor();
    if (!client || !id) return;
    var day = todayUTC();
    var key = id + ':' + type + (type === 'first_mission' ? '' : ':' + day);
    if (sent[key]) return;
    var row = { visitor_id: id, event_type: type, source: type === 'campaign_visit' ? source() : 'direct' };
    if (type === 'first_mission') {
      var date = firstMissionDay;
      var now = Date.parse(day + 'T00:00:00Z'), when = Date.parse(date + 'T00:00:00Z');
      if (!Number.isFinite(when) || when > now || now - when > 365 * 86400000) return;
      row.first_mission_on = date;
    }
    sent[key] = true;
    Promise.resolve(client.from('atlas_retention_events').insert(row)).then(function (result) {
      if (result && result.error && result.error.code !== '23505') {
        delete sent[key];
        console.warn('ATLAS mesure facultative indisponible', result.error.code);
      }
    }).catch(function () { delete sent[key]; });
  }
  function recordFirstIfPresent(s) {
    var first = earliestMission(s);
    if (first) record('first_mission', first);
  }
  function trackPersist(previous, next) {
    if (!agreed()) return;
    if (!(previous.missions || []).length && (next.missions || []).length) recordFirstIfPresent(next);
    var oldDone = Object.create(null);
    (previous.missions || []).forEach(function (m) {
      (m.steps || []).forEach(function (step) { if (step.doneAt) oldDone[step.id] = true; });
    });
    var hasNewStep = (next.missions || []).some(function (m) {
      return (m.steps || []).some(function (step) { return step.doneAt && !oldDone[step.id]; });
    });
    if (hasNewStep) record('step_completed');
    var oldReviews = Object.create(null);
    (previous.checkins || []).forEach(function (c) { if (c.kind === 'weekly') oldReviews[c.id] = true; });
    var hasReview = (next.checkins || []).some(function (c) {
      return c.kind === 'weekly' && !oldReviews[c.id];
    });
    if (hasReview) record('weekly_review');
  }
  function markup() {
    var choice = stored(consentKey);
    var message = choice === 'yes'
      ? '<strong>Mesure facultative activée.</strong> Les visites et retours sont suivis avec un identifiant aléatoire de cet appareil.'
      : choice === 'no'
        ? '<strong>Mesure désactivée.</strong> Ton parcours reste totalement accessible.'
        : '<strong>À toi de choisir.</strong> Autorises-tu une mesure facultative pour comprendre si les personnes reviennent sept jours après leur première Mission ?';
    var buttons = choice === 'yes'
      ? '<button class="btn outline slim" data-atlas-analytics="disable" type="button">Désactiver la mesure</button>'
      : '<button class="btn outline slim" data-atlas-analytics="enable" type="button">Oui, participer</button>' +
        (choice === 'no' ? '' : '<button class="btn transparent slim" data-atlas-analytics="disable" type="button">Non merci</button>');
    return '<section class="atlas-analytics-consent" aria-label="Mesure d’audience facultative" id="atlas-analytics-consent">' +
      '<div><span class="eyebrow">CONFIDENTIALITÉ · TON CHOIX</span><p>' + message + '</p>' +
      '<small>Seulement les dates, quelques actions et la provenance Instagram éventuelle. Jamais les titres, notes, bilans, e-mails ou contenus privés. Refuser ne change rien à ATLAS. La désactivation arrête les nouvelles mesures.</small></div>' +
      '<div class="atlas-analytics-actions">' + buttons + '</div></section>';
  }
  function enhance() {
    // Une visite consentie compte, même si la personne revient sur l'accueil
    // ou l'Atlas public plutôt que directement dans « Ma semaine ».
    if (agreed()) {
      record('visit');
      if (source() === 'instagram') record('campaign_visit');
      recordFirstIfPresent(state);
    }
    if (typeof route !== 'function' || route() !== 'semaine') return;
    var title = root.querySelector('.atlas-week-intro');
    if (!title) return;
    if (!root.querySelector('#atlas-analytics-consent')) title.insertAdjacentHTML('afterend', markup());
  }
  function setChoice(enable) {
    if (!enable) {
      save(consentKey, 'no'); forget(visitorKey); sent = Object.create(null);
    } else if (save(consentKey, 'yes')) {
      visitor();
    }
    if (typeof render === 'function') render();
  }
  if (typeof root !== 'undefined' && root.addEventListener) {
    root.addEventListener('click', function (event) {
      var action = event.target.closest('[data-atlas-analytics]');
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setChoice(action.dataset.atlasAnalytics === 'enable');
    }, true);
  }
  if (typeof render === 'function') {
    var originalRender = render;
    render = function () { originalRender(); enhance(); };
  }
  if (typeof persist === 'function') {
    var originalPersist = persist;
    persist = function (next) {
      var previous = state;
      originalPersist(next);
      trackPersist(previous, state);
    };
  }
  var css = document.createElement('style');
  css.textContent = '.atlas-analytics-consent{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:0 0 26px;padding:18px 22px;border:1px solid #d6c8b4;border-radius:15px;background:#f7f2e8}.atlas-analytics-consent p{margin:7px 0;font-size:.94rem}.atlas-analytics-consent small{display:block;line-height:1.6;color:#605f57;max-width:680px}.atlas-analytics-actions{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}@media(max-width:750px){.atlas-analytics-consent{flex-direction:column;align-items:flex-start}.atlas-analytics-actions{width:100%}.atlas-analytics-actions .btn{flex:1}}';
  document.head.appendChild(css);
  window.ATLAS_ANALYTICS = Object.freeze({ retentionWindow: retentionWindow, source: source, earliestMission: earliestMission });
  enhance();
})();