/* ATLAS — Ma semaine : un parcours simple, sans nouveau système de missions.
   Utilise les missions, étapes, bilans et sauvegardes déjà présents. */
(function () {
  'use strict';

  function mondayKey(now) {
    var d = new Date(now || Date.now());
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function activeMissions() {
    return (state.missions || []).filter(function (m) { return !m.completedAt; });
  }
  function chosenMission() {
    var available = activeMissions();
    var selection = state.weeklyFocus;
    var found = selection && selection.weekKey === mondayKey() &&
      available.find(function (m) { return m.id === selection.missionId; });
    return found || available[0] || null;
  }
  function reviewFor(mission) {
    return (state.checkins || []).find(function (c) {
      return c.missionId === mission.id && c.kind === 'weekly' && c.weekKey === mondayKey();
    }) || null;
  }
  function weekLabel() {
    var beginning = new Date(mondayKey() + 'T12:00:00');
    var end = new Date(beginning);
    end.setDate(end.getDate() + 6);
    var fmt = function (d) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d); };
    return 'Du ' + fmt(beginning) + ' au ' + fmt(end);
  }
  function accountHint() {
    if (session) {
      return '<div class="atlas-week-account"><span>✦ ' + h(cloudStatus()) +
        (hasAtlasContent(loadLocal()) ? '<br><strong>Un essai existe sur cet appareil :</strong> ouvre « Mon compte », puis « Récupérer mes souvenirs de cet appareil ». Rien n’est importé automatiquement.' : '') +
        '</span><button type="button" class="btn outline slim" data-atlas-week="account">Mon compte</button></div>';
    }
    return '<div class="atlas-week-account atlas-week-guest"><span><strong>Essai sur cet appareil.</strong> ' +
      'Tes missions sont privées et conservées ici, mais pas encore synchronisées entre appareils. ' +
      'Elles ne sont jamais publiées automatiquement.</span>' +
      '<button class="btn outline slim" data-atlas-week="account">Créer un compte pour sauvegarder</button></div>';
  }
  function chooseFocus(mission) {
    var all = activeMissions();
    if (all.length < 2) return '';
    return '<div class="atlas-week-select"><label for="atlas-week-focus">Ma mission de cette semaine</label>' +
      '<select id="atlas-week-focus" data-atlas-week-focus>' + all.map(function (m) {
        return '<option value="' + attr(m.id) + '"' + (m.id === mission.id ? ' selected' : '') +
          '>' + h(m.title) + '</option>';
      }).join('') + '</select></div>';
  }
  function missionMarkup(m) {
    var p = progress(m);
    var next = nextStep(m);
    var review = reviewFor(m);
    var last = m.steps.filter(function (s) { return s.doneAt; }).slice(-1)[0];
    return '<section class="atlas-week-mission" aria-label="Mission de la semaine">' +
      '<div class="atlas-week-card-top"><span class="eyebrow">Ma mission de la semaine</span>' +
      '<a href="#/mission/' + encodeURIComponent(m.id) + '" class="link">Voir tout mon chemin →</a></div>' +
      chooseFocus(m) + '<h2>' + h(m.title) + '</h2>' +
      '<div class="atlas-week-progress"><div class="atlas-week-meter" role="progressbar" aria-label="Progression de la mission" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.percent + '"><span style="width:' + p.percent + '%"></span></div>' +
      '<strong>' + p.percent + ' %</strong></div><p class="muted">' + p.done + ' étape' + (p.done > 1 ? 's' : '') +
      ' accomplie' + (p.done > 1 ? 's' : '') + ' sur ' + p.total + '</p>' +
      '<div class="atlas-week-next"><span class="eyebrow">Mon prochain petit pas</span>' +
      (next ? '<h3>' + h(next.title) + '</h3><p>Quand tu l’as accompli, garde une trace de ce moment.</p>' +
        '<button type="button" class="btn" data-atlas-week="complete" data-mid="' + attr(m.id) +
        '" data-sid="' + attr(next.id) + '">✓ J’ai fait ce pas</button>' :
        '<h3>' + (p.total && p.done === p.total ? 'Tous les pas prévus sont accomplis.' :
          'Un premier petit pas, ça suffit pour commencer.') + '</h3>' +
        '<button class="btn" data-atlas-week="add-step" data-mid="' + attr(m.id) + '">+ Choisir mon prochain pas</button>') +
      '</div>' +
      (last ? '<p class="atlas-week-memory">✦ Dernier pas accompli : ' + h(last.title) + '</p>' : '') +
      '<div class="atlas-week-actions"><button class="btn outline" data-atlas-week="note" data-mid="' +
      attr(m.id) + '">Mon journal · Garder une trace</button>' +
      '<button class="btn outline" data-atlas-week="review" data-mid="' + attr(m.id) +
      '">' + (review ? 'Relire ou ajuster mon bilan' : 'Mon bilan · Faire le point') + '</button></div>' +
      (review ? '<p class="atlas-week-reviewed">✦ Bilan de cette semaine conservé dans ton Atlas.</p>' : '') +
      '</section>';
  }
  function emptyMarkup() {
    return '<section class="atlas-week-empty"><span class="eyebrow">Ton premier chapitre</span>' +
      '<h2>Quelle petite chose aimerais-tu commencer ?</h2>' +
      '<p>Une envie, un projet, une curiosité. Donne-lui un nom : tu pourras compléter le reste plus tard.</p>' +
      '<button class="btn" data-atlas-week="quick">Créer ma première Mission →</button>' +
      '<p class="muted text-sm">Aucun Cap à remplir, aucun compte obligatoire pour essayer.</p></section>';
  }
  function weeklyPage() {
    var m = chosenMission();
    var day = new Date().getDay();
    var suggestion = day === 1 ?
      'Lundi · Choisis ce qui compte pour toi cette semaine.' : day === 0 ?
      'Dimanche · Reconnais ce que tu as vécu, même si tu as ralenti.' :
      'Aujourd’hui · Un petit pas ou une trace suffisent pour continuer.';
    pageFrame('semaine', '<div class="wrap app-main atlas-week-page">' +
      '<div class="atlas-week-intro"><span class="eyebrow">MON ATLAS · MA SEMAINE</span>' +
      '<h1>Un pas après l’autre.</h1><p class="lead">' + suggestion + '</p>' +
      '<p class="muted">' + weekLabel() + ' · À ton rythme, sans série à perdre.</p></div>' +
      accountHint() + (m ? missionMarkup(m) : emptyMarkup()) +
      '<section class="atlas-week-ritual" aria-label="Le rituel de ma semaine">' +
      '<h2>Ma semaine, simplement.</h2><div class="atlas-week-ritual-grid">' +
      '<div><span class="eyebrow">Lundi</span><h3>Choisir</h3><p>Une Mission qui compte pour moi.</p></div>' +
      '<div><span class="eyebrow">Au fil des jours</span><h3>Agir & noter</h3><p>Un pas, une idée, une difficulté.</p></div>' +
      '<div><span class="eyebrow">Dimanche</span><h3>Faire le point</h3><p>Ce que j’ai accompli, appris, et la suite.</p></div></div>' +
      '<div class="atlas-week-footer-actions"><button class="btn outline" data-atlas-week="quick">+ Une nouvelle Mission</button>' +
      '<a class="link" href="#/atlas">Explorer la carte de mon Atlas →</a>' +
      '<button type="button" class="link" data-atlas-week="calendar">Rappels facultatifs lundi et dimanche (calendrier) ↗</button></div></section></div>');
  }
  // Le rappel reste un choix explicite : un fichier calendrier, aucun e-mail
  // ni notification envoyée par ATLAS et aucune donnée personnelle partagée.
  function calendarReminders() {
    var now = new Date();
    function next(day, hour) {
      var d = new Date(now);
      d.setHours(hour, 0, 0, 0);
      d.setDate(d.getDate() + (day - d.getDay() + 7) % 7);
      if (d <= now) d.setDate(d.getDate() + 7);
      return d;
    }
    function stamp(d) {
      return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0') + 'T' +
        String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
    }
    function event(day, at, title, description) {
      var end = new Date(at.getTime() + 10 * 60000);
      return ['BEGIN:VEVENT', 'UID:atlas-' + day + '-rituel@atlas-prepublication',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
        'DTSTART:' + stamp(at), 'DTEND:' + stamp(end),
        'RRULE:FREQ=WEEKLY;BYDAY=' + day, 'SUMMARY:' + title,
        'DESCRIPTION:' + description, 'END:VEVENT'].join('\r\n');
    }
    var content = ['BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//ATLAS//Rituels hebdomadaires//FR', 'CALSCALE:GREGORIAN',
      event('MO', next(1, 9), 'ATLAS - Ma mission de la semaine',
        'Choisir une mission et un petit pas. Ouvre ATLAS quand tu le souhaites.'),
      event('SU', next(0, 18), 'ATLAS - Faire le point',
        'Qu ai-je accompli et appris ? Quel sera mon prochain petit pas ?'),
      'END:VCALENDAR'].join('\r\n') + '\r\n';
    var url = URL.createObjectURL(new Blob([content], {type:'text/calendar;charset=utf-8'}));
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'atlas-rappels-facultatifs.ics';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
    notify('Ton calendrier peut importer les rappels si tu le souhaites.');
  }

  function quickMission() {
    modal('Choisir ma prochaine Mission.','Un premier pas suffit',
      '<p>Commence avec un titre. Tu pourras préciser le Territoire, le Cap et tes autres étapes plus tard.</p>' +
      '<form id="atlas-week-quick-form">' +
      '<div class="form-row"><label for="atlas-week-title">Ce que je veux commencer</label>' +
      '<input id="atlas-week-title" name="title" required maxlength="100" autocomplete="off" placeholder="Ex. : Apprendre trois nouvelles recettes"></div>' +
      '<div class="form-row"><label for="atlas-week-step">Mon premier petit pas (facultatif)</label>' +
      '<input id="atlas-week-step" name="step" maxlength="160" placeholder="Ex. : Choisir la première recette"></div>' +
      '<p class="muted text-sm">Cette Mission restera privée. ' +
      (session ? 'Elle utilisera ta sauvegarde ATLAS habituelle.' : 'En mode essai, elle reste sur cet appareil tant que tu ne la récupères pas dans ton compte.') +
      '</p><button class="btn" type="submit">Commencer ma Mission →</button></form>');
  }
  function reviewModal(mid) {
    var m = (state.missions || []).find(function (item) { return item.id === mid; });
    if (!m) return;
    var previous = reviewFor(m) || {};
    modal('Faire le point sur ma semaine.','Bilan sans jugement · ' + m.title,
      '<p>Tu peux écrire une phrase, ou revenir plus tard. Même une semaine sans progrès mérite de la douceur.</p>' +
      '<form id="atlas-week-review-form" data-mid="' + attr(mid) + '">' +
      '<div class="form-row"><label>Qu’ai-je accompli ?</label><textarea name="accomplished" maxlength="700" placeholder="Un geste, une tentative, un moment…">' +
      h(previous.accomplished || '') + '</textarea></div>' +
      '<div class="form-row"><label>Qu’ai-je appris ?</label><textarea name="learned" maxlength="700" placeholder="Une découverte, un obstacle, une idée…">' +
      h(previous.learned || '') + '</textarea></div>' +
      '<div class="form-row"><label>Quel sera mon prochain pas ?</label><input name="next" maxlength="220" placeholder="Un petit pas réalisable" value="' +
      attr(previous.nextAction && previous.nextAction !== 'Je choisirai mon prochain pas plus tard.' ? previous.nextAction : '') +
      '"></div><p class="muted text-sm">Bilan privé, modifiable et conservé dans ta Mission.</p>' +
      '<button class="btn" type="submit">Conserver mon bilan →</button></form>', true);
  }
  function saveReview(form) {
    var mid = form.dataset.mid;
    var m = (state.missions || []).find(function (item) { return item.id === mid; });
    if (!m) throw Error('Mission introuvable.');
    var accomplished = String(form.elements.accomplished.value || '').trim().slice(0, 700);
    var learned = String(form.elements.learned.value || '').trim().slice(0, 700);
    var next = String(form.elements.next.value || '').trim().slice(0, 220);
    if (!accomplished && !learned && !next) throw Error('Écris au moins une pensée pour garder ce bilan.');
    var update = structuredClone(state);
    var key = mondayKey();
    var old = (update.checkins || []).find(function (c) {
      return c.kind === 'weekly' && c.weekKey === key && c.missionId === mid;
    });
    if (!old) {
      update = addCheckin(update, { missionId: mid, feeling: 'en-route', difficulty: learned,
        nextAction: next || 'Je choisirai mon prochain pas plus tard.' });
      old = update.checkins[0];
      old.kind = 'weekly';
      old.weekKey = key;
    }
    old.accomplished = accomplished;
    old.learned = learned;
    old.difficulty = learned;
    old.nextAction = next || 'Je choisirai mon prochain pas plus tard.';
    old.date = iso();
    persist(update);
    closeModal();
    navigate('semaine');
    notify('Ton bilan est conservé. Chaque reprise compte.');
  }

  var previousRender = render;
  render = function () {
    if (route() === 'semaine') { weeklyPage(); return; }
    previousRender();
    if (route() === 'atlas') {
      var app = root.querySelector('.app-main');
      if (app && !app.querySelector('.atlas-week-linkcard')) {
        app.insertAdjacentHTML('afterbegin', '<div class="atlas-week-linkcard"><div>' +
          '<span class="eyebrow">Ton rendez-vous personnel</span><strong>Un pas après l’autre.</strong>' +
          '<p>Retrouve ta Mission de la semaine, tes traces et ton bilan.</p></div>' +
          '<a class="btn" href="#/semaine">Ouvrir Ma semaine →</a></div>');
      }
    }
  };
  var previousNewMission = newMission;
  newMission = function () {
    // Le parcours complet reste disponible depuis la carte des Missions :
    // le nouveau chemin rapide devient le point de départ.
    quickMission();
  };

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-atlas-week]');
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var type = el.dataset.atlasWeek;
    var mid = el.dataset.mid, sid = el.dataset.sid;
    try {
      if (type === 'quick') quickMission();
      else if (type === 'account') settings(session ? 'signin' : 'signup');
      else if (type === 'calendar') calendarReminders();
      else if (type === 'add-step') newStep(mid);
      else if (type === 'note') newNote(mid);
      else if (type === 'review') reviewModal(mid);
      else if (type === 'complete') {
        persist(setStep(state, mid, sid, true));
        notify('Ton petit pas est conservé. ✦');
      }
    } catch (err) { notify(err.message || 'Ce geste n’a pas pu être conservé.'); }
  }, true);

  root.addEventListener('change', function (e) {
    var el = e.target.closest('[data-atlas-week-focus]');
    if (!el) return;
    var m = activeMissions().find(function (item) { return item.id === el.value; });
    if (!m) return;
    var update = structuredClone(state);
    update.weeklyFocus = { weekKey: mondayKey(), missionId: m.id };
    persist(update);
  }, true);

  dialogs.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id !== 'atlas-week-quick-form' && form.id !== 'atlas-week-review-form') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      if (form.id === 'atlas-week-review-form') { saveReview(form); return; }
      var title = String(form.elements.title.value || '').trim();
      var step = String(form.elements.step.value || '').trim();
      var result = createMission(state, { title: title, mode: 'free', territory: 'esprit',
        steps: step ? [step] : [] });
      result.state.weeklyFocus = { weekKey: mondayKey(), missionId: result.mission.id };
      closeModal();
      persist(result.state);
      navigate('semaine');
      notify('Ta Mission est lancée. Chaque petit pas compte.');
    } catch (err) { notify(err.message || 'Impossible de commencer cette Mission.'); }
  }, true);

  var css = document.createElement('style');
  css.textContent = '.atlas-week-page{max-width:1080px;padding-bottom:90px}.atlas-week-intro{padding:28px 0 20px}.atlas-week-intro h1{font-size:clamp(2.7rem,6vw,4.8rem);margin:12px 0}.atlas-week-account{background:#f1e9db;border:1px solid #d6c8b4;border-radius:18px;padding:16px 20px;margin:0 0 26px;display:flex;align-items:center;justify-content:space-between;gap:20px}.atlas-week-account span{font-size:.92rem;line-height:1.5}.atlas-week-account .btn{flex-shrink:0}.atlas-week-mission,.atlas-week-empty{padding:clamp(24px,4vw,48px);border:1px solid #c4b39a;border-radius:25px;background:#fcf6ea;box-shadow:0 12px 32px #392c1b0d}.atlas-week-card-top{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}.atlas-week-mission h2,.atlas-week-empty h2{font-size:clamp(2rem,4vw,3.5rem);margin:18px 0;overflow-wrap:anywhere}.atlas-week-select{display:grid;gap:7px;margin-top:20px;max-width:450px}.atlas-week-select label{font-size:.86rem}.atlas-week-select select{padding:12px;border:1px solid #c4b39a;border-radius:10px;max-width:100%;background:#fffaf2}.atlas-week-progress{display:flex;gap:18px;align-items:center}.atlas-week-meter{height:12px;flex:1;overflow:hidden;background:#e6ddcc;border-radius:99px}.atlas-week-meter span{display:block;height:100%;background:#647e5a;border-radius:99px;transition:width .3s}.atlas-week-next{margin:34px 0 24px;padding:25px;background:#f2e8d7;border-radius:18px}.atlas-week-next h3{font-size:clamp(1.3rem,3vw,2rem);margin:13px 0}.atlas-week-next .btn{margin-top:9px}.atlas-week-actions{display:flex;gap:12px;flex-wrap:wrap}.atlas-week-memory,.atlas-week-reviewed{font-size:.92rem;color:#546c4b}.atlas-week-reviewed{margin-top:17px}.atlas-week-ritual{margin-top:42px}.atlas-week-ritual h2{font-size:clamp(1.6rem,3vw,2.5rem)}.atlas-week-ritual-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.atlas-week-ritual-grid>div{padding:20px;background:#f1e9da;border-radius:16px}.atlas-week-ritual-grid h3{margin:12px 0 5px}.atlas-week-ritual-grid p{margin:0}.atlas-week-footer-actions{margin-top:25px;display:flex;gap:22px;align-items:center;flex-wrap:wrap}.atlas-week-linkcard{margin:0 0 25px;padding:22px;background:#f2e8d7;border-radius:19px;display:flex;justify-content:space-between;align-items:center;gap:20px}.atlas-week-linkcard strong{display:block;font-size:1.35rem;margin:8px 0}.atlas-week-linkcard p{margin:0}.atlas-week-linkcard .btn{flex-shrink:0}@media(max-width:700px){.atlas-week-intro{padding-top:10px}.atlas-week-account,.atlas-week-linkcard{flex-direction:column;align-items:flex-start}.atlas-week-ritual-grid{grid-template-columns:1fr}.atlas-week-account .btn,.atlas-week-linkcard .btn{width:100%;text-align:center}.atlas-week-actions .btn{width:100%}}@media(prefers-reduced-motion:reduce){.atlas-week-meter span{transition:none}}';
  document.head.appendChild(css);
  window.ATLAS_WEEKLY = Object.freeze({ mondayKey: mondayKey });
  render();
})();
