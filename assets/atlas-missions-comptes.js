/* ATLAS — édition des missions et accueil sécurisé des nouveaux comptes.
   Extension non destructive : les Atlas existants conservent leurs identifiants,
   étapes validées, souvenirs et sauvegardes. */
(function () {
  'use strict';

  var awaitingAction = null;
  var protectedPages = new Set(['start','atlas','aujourdhui','missions','rythme','carnet','bibliotheque']);
  var guardedActions = new Set(['new-mission','new-mission-in-territory','new-step','edit-cap','new-action','new-note','new-book','essay-draft','checkin','recover','archive-action','complete-step','undo-step','confirm-action']);

  function needsAccount(path) {
    return protectedPages.has(path) || path.indexOf('mission/') === 0 || path.indexOf('essai/') === 0;
  }
  function requestAccount(nextAction, mode) {
    if (session) return false;
    awaitingAction = nextAction || awaitingAction;
    if (!cloud) {
      notify('La connexion est momentanément indisponible. Réessaie avant de commencer ton Atlas.');
      return true;
    }
    auth(mode || 'signup');
    return true;
  }
  function accountScreen() {
    var hasGuest = hasAtlasContent(loadLocal());
    root.innerHTML = header('atlas') +
      '<main id="main" class="page"><section class="wrap atlas-v29-gate">' +
      '<div class="eyebrow">Mon Atlas · espace personnel</div>' +
      '<h1>Ton histoire mérite d’être conservée.</h1>' +
      '<p class="lead">Crée ton compte ou connecte-toi avant d’écrire ton Cap, de tracer une Mission ou de commencer ton Carnet. Tu pourras ensuite retrouver ton Atlas sur tes appareils.</p>' +
      '<div class="actions"><button class="btn" data-atlas-account="signup">Créer mon compte et commencer →</button>' +
      '<button class="btn outline" data-atlas-account="signin">J’ai déjà un compte</button></div>' +
      '<p class="muted text-sm">L’Atlas de Cloé reste librement consultable, sans inscription.</p>' +
      (hasGuest ? '<p class="notice">Tu as déjà des données enregistrées sans compte sur cet appareil. Elles sont conservées : une fois connecté, ouvre « Mon compte » pour choisir « Récupérer mes souvenirs de cet appareil ».</p>' : '') +
      '<a class="link" href="#/public">Découvrir l’Atlas public de Cloé →</a>' +
      '</section></main>' + footer();
  }
  function inviteOnHome() {
    var hero = root.querySelector('.hero');
    if (!hero || root.querySelector('.atlas-v29-invite')) return;
    hero.insertAdjacentHTML('afterend',
      '<section class="atlas-v29-invite wrap" aria-label="Créer son Atlas personnel">' +
      '<div><span class="eyebrow">Ton Atlas personnel</span><h2>Construis ton chemin. Garde tes traces.</h2>' +
      '<p>Pour ne rien perdre, crée ton compte avant de définir ton Cap, lancer tes Missions ou écrire dans ton Carnet.</p></div>' +
      '<div class="atlas-v29-invite-actions"><button class="btn" data-atlas-account="signup">Créer mon Atlas →</button>' +
      '<button class="btn outline" data-atlas-account="signin">Me connecter</button></div></section>');
  }

  function missionById(mid) { return state.missions.find(function(m) { return m.id === mid; }); }
  function missionControls(mid) {
    var m = missionById(mid);
    if (!m || root.querySelector('.atlas-v29-manager')) return;
    var rows = m.steps.map(function(st, i) {
      return '<li class="atlas-v29-step"><div class="atlas-v29-step-title">' +
        '<strong>' + (i + 1) + '. ' + h(st.title) + '</strong>' +
        (st.doneAt ? '<small>✦ Étape accomplie · progression conservée</small>' : '<small>Étape à accomplir</small>') +
        '</div><div class="atlas-v29-step-actions">' +
        '<button class="btn slim outline" data-atlas-mission="insert" data-mid="' + attr(mid) + '" data-position="' + i + '">+ Avant</button>' +
        '<button class="btn slim outline" data-atlas-mission="edit-step" data-mid="' + attr(mid) + '" data-sid="' + attr(st.id) + '">Modifier</button>' +
        '<button class="btn slim transparent" data-atlas-mission="up" data-mid="' + attr(mid) + '" data-sid="' + attr(st.id) + '" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Monter cette étape">↑</button>' +
        '<button class="btn slim transparent" data-atlas-mission="down" data-mid="' + attr(mid) + '" data-sid="' + attr(st.id) + '" ' + (i === m.steps.length - 1 ? 'disabled' : '') + ' aria-label="Descendre cette étape">↓</button>' +
        '<button class="btn slim transparent atlas-v29-danger" data-atlas-mission="remove-step" data-mid="' + attr(mid) + '" data-sid="' + attr(st.id) + '">Supprimer</button>' +
        '</div></li>';
    }).join('');
    var html = '<section class="folio atlas-v29-manager" aria-label="Organiser ma Mission">' +
      '<div class="section-heading"><div><span class="eyebrow">Modifier mon chemin</span><h2>Organiser ma Mission</h2>' +
      '<p class="muted">Modifie tes étapes et leur ordre sans effacer celles que tu as déjà accomplies.</p></div>' +
      '<div class="atlas-v29-manager-buttons"><button class="btn outline" data-atlas-mission="edit-mission" data-mid="' + attr(mid) + '">✎ Modifier la Mission</button>' +
      '<button class="btn transparent atlas-v29-danger" data-atlas-mission="remove-mission" data-mid="' + attr(mid) + '">Supprimer la Mission</button></div></div>' +
      '<ol class="atlas-v29-steps">' + rows + '</ol>' +
      '<button class="btn" data-atlas-mission="insert" data-mid="' + attr(mid) + '" data-position="' + m.steps.length + '">+ Ajouter une étape à l’endroit de mon choix</button></section>';
    var target = root.querySelector('.folio-footer');
    if (target) target.insertAdjacentHTML('afterend', html);
  }

  var oldRender = render;
  render = function() {
    var path = route();
    if (!session && needsAccount(path)) { accountScreen(); return; }
    oldRender();
    if (path === '' || path === '/') inviteOnHome();
    if (path.indexOf('mission/') === 0 && route() === path) missionControls(path.slice(8));
  };

  var oldAuth = auth;
  auth = function(mode) {
    oldAuth(mode || 'signup');
    var form = dialogs.querySelector('#auth-form');
    if (!form) return;
    var signup = (mode || 'signup') !== 'signin';
    form.insertAdjacentHTML('afterend',
      '<div class="atlas-v29-auth-switch"><span>' +
      (signup ? 'Tu as déjà un compte ?' : 'Tu découvres ATLAS ?') + '</span> ' +
      '<button type="button" class="link" data-atlas-account="' +
      (signup ? 'signin' : 'signup') + '">' +
      (signup ? 'Se connecter' : 'Créer mon compte') + '</button></div>' +
      '<p class="muted text-sm">Connecte-toi avant de commencer : tes créations resteront associées à ton compte. Elles ne seront jamais publiées automatiquement.</p>');
  };

  var oldAfterAuth = afterAuth;
  afterAuth = async function() {
    await oldAfterAuth();
    if (!session || cloudConflict) return;
    var action = awaitingAction;
    awaitingAction = null;
    if (!action) return;
    if (action.type === 'open-atlas') navigate('atlas');
    else if (action.type === 'new-mission') newMission();
    else if (action.type === 'new-book') newBook();
    else if (action.type === 'new-note') newNote(action.mid || '');
    else if (action.type === 'edit-cap') editCap();
    else if (action.type === 'new-action') newAction(action.horizon || 'day');
    else if (action.type === 'essay-draft') essayDraft();
  };

  var oldNewStep = newStep;
  newStep = function(mid) {
    var m = missionById(mid);
    if (!m) return;
    openInsertStep(mid, m.steps.length);
  };
  function openInsertStep(mid, position) {
    var m = missionById(mid);
    if (!m) return;
    var options = '<option value="0">Au tout début</option>' +
      m.steps.map(function(st, i) { return '<option value="' + (i + 1) + '">Après : ' + h(st.title) + '</option>'; }).join('');
    modal('Ajouter un passage.','Mission · ' + m.title,
      '<form id="atlas-v29-insert-form" data-mid="' + attr(mid) + '">' +
      '<div class="form-row"><label>Nouvelle étape</label><input name="title" maxlength="160" required placeholder="Un prochain pas concret"></div>' +
      '<div class="form-row"><label>Où insérer cette étape ?</label><select name="position">' + options + '</select></div>' +
      '<button class="btn" type="submit">Ajouter cette étape</button></form>');
    dialogs.querySelector('[name="position"]').value = String(position);
  }
  function openEditMission(mid) {
    var m = missionById(mid);
    if (!m) return;
    var opts = Object.entries(TERRITORIES).map(function(pair) {
      return '<option value="' + attr(pair[0]) + '"' + (m.territory === pair[0] ? ' selected' : '') + '>' + h(pair[1].name) + '</option>';
    }).join('');
    modal('Modifier ma Mission.','Corriger et faire évoluer mon chemin',
      '<form id="atlas-v29-mission-form" data-mid="' + attr(mid) + '">' +
      '<div class="form-row"><label>Intitulé de la Mission</label><input name="title" maxlength="100" required value="' + attr(m.title) + '"></div>' +
      '<div class="form-row"><label>Territoire</label><select name="territory">' + opts + '</select></div>' +
      '<div class="form-row"><label>Pourquoi cette Mission compte pour moi</label><textarea name="why" maxlength="800">' + h(m.why || '') + '</textarea></div>' +
      '<div class="form-row"><label>Façon d’avancer</label><select name="mode">' +
      '<option value="guided"' + (m.mode === 'guided' ? ' selected' : '') + '>Chemin guidé — étapes dans l’ordre</option>' +
      '<option value="free"' + (m.mode === 'free' ? ' selected' : '') + '>Voie libre — à mon rythme</option>' +
      '</select></div><p class="muted text-sm">Changer le Territoire ou le parcours ne supprime pas les étapes validées.</p>' +
      '<button class="btn" type="submit">Enregistrer les modifications</button></form>', true);
  }
  function openEditStep(mid, sid) {
    var m = missionById(mid), st = m && m.steps.find(function(s) { return s.id === sid; });
    if (!st) return;
    modal('Corriger une étape.','Mission · ' + m.title,
      '<form id="atlas-v29-step-form" data-mid="' + attr(mid) + '" data-sid="' + attr(sid) + '">' +
      '<div class="form-row"><label>Intitulé de cette étape</label><input name="title" maxlength="160" required value="' + attr(st.title) + '"></div>' +
      '<p class="muted text-sm">La date de réalisation est conservée si cette étape est déjà terminée.</p>' +
      '<button class="btn" type="submit">Enregistrer l’intitulé</button></form>');
  }
  function cloneMission(mid) {
    var copy = structuredClone(state);
    var m = copy.missions.find(function(item) { return item.id === mid; });
    if (!m) throw Error('Mission introuvable.');
    if (!Array.isArray(m.steps)) m.steps = [];
    return {copy:copy, mission:m};
  }
  function refreshCompletion(m) {
    m.completedAt = m.steps.length && m.steps.every(function(st) { return Boolean(st.doneAt); }) ?
      (m.completedAt || iso()) : null;
  }
  function saveEdited(copy, message) {
    closeModal();
    persist(copy);
    notify(message);
  }

  root.addEventListener('click', function(e) {
    var account = e.target.closest('[data-atlas-account]');
    if (account) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (session) { navigate('atlas'); return; }
      awaitingAction = {type:'open-atlas'};
      requestAccount(awaitingAction, account.dataset.atlasAccount);
      return;
    }
    var command = e.target.closest('[data-atlas-mission]');
    if (command) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (requestAccount()) return;
      var type = command.dataset.atlasMission, mid = command.dataset.mid, sid = command.dataset.sid;
      var m = missionById(mid);
      if (!m) return notify('Cette Mission est introuvable.');
      try {
        if (type === 'edit-mission') { openEditMission(mid); return; }
        if (type === 'insert') { openInsertStep(mid, Number(command.dataset.position) || 0); return; }
        if (type === 'edit-step') { openEditStep(mid, sid); return; }
        if (type === 'remove-mission') {
          if (!confirm('Supprimer définitivement « ' + m.title + ' » et ses étapes, bilans et traces de progression ? Les notes et objectifs associés seront conservés, mais détachés de cette Mission.')) return;
          var without = structuredClone(state);
          without.missions = without.missions.filter(function(item) { return item.id !== mid; });
          without.checkins = (without.checkins || []).filter(function(item) { return item.missionId !== mid; });
          without.history = (without.history || []).filter(function(item) { return item.missionId !== mid; });
          (without.notes || []).forEach(function(item) { if (item.missionId === mid) item.missionId = null; });
          (without.actions || []).forEach(function(item) { if (item.missionId === mid) item.missionId = null; });
          persist(without); navigate('missions'); notify('Mission supprimée. Les notes et objectifs personnels sont conservés.');
          return;
        }
        var pair = cloneMission(mid), steps = pair.mission.steps, index = steps.findIndex(function(st) { return st.id === sid; });
        if (index < 0) return;
        if (type === 'remove-step') {
          if (!confirm('Supprimer cette étape : « ' + steps[index].title + ' » ? Sa validation sera également supprimée.')) return;
          steps.splice(index, 1); refreshCompletion(pair.mission);
          persist(pair.copy); notify('Étape supprimée.');
        } else if (type === 'up' || type === 'down') {
          var other = index + (type === 'up' ? -1 : 1);
          if (other < 0 || other >= steps.length) return;
          var item = steps[index]; steps[index] = steps[other]; steps[other] = item;
          persist(pair.copy); notify('Ordre des étapes modifié.');
        }
      } catch (err) { notify(err.message || 'Modification impossible.'); }
      return;
    }
    var basic = e.target.closest('[data-action]');
    if (!basic || session || !guardedActions.has(basic.dataset.action)) return;
    e.preventDefault();e.stopImmediatePropagation();
    var type = basic.dataset.action;
    var resume = ['new-mission','new-book','new-note','edit-cap','new-action','essay-draft'].includes(type) ?
      {type:type, mid:basic.dataset.mission, horizon:basic.dataset.horizon} : null;
    requestAccount(resume);
  }, true);

  dialogs.addEventListener('click', function(e) {
    var account = e.target.closest('[data-atlas-account]');
    if (!account) return;
    e.preventDefault();e.stopImmediatePropagation();
    auth(account.dataset.atlasAccount);
  }, true);

  root.addEventListener('submit', function(e) {
    if (session || e.target.id !== 'cap-form') return;
    e.preventDefault();e.stopImmediatePropagation();requestAccount({type:'open-atlas'});
  }, true);

  dialogs.addEventListener('submit', function(e) {
    var form = e.target, id = form.id;
    if (id.indexOf('atlas-v29-') !== 0) {
      if (!session && ['mission-form','step-form','note-form','action-form','book-form','edit-cap-form','checkin-form','essay-draft-form','recover-form'].includes(id)) {
        e.preventDefault();e.stopImmediatePropagation();requestAccount();
      }
      return;
    }
    e.preventDefault();e.stopImmediatePropagation();
    if (requestAccount()) return;
    try {
      var mid = form.dataset.mid, title = String(form.elements.title.value || '').trim();
      var pair = cloneMission(mid), m = pair.mission;
      if (!title || title.length > (id === 'atlas-v29-mission-form' ? 100 : 160)) throw Error('L’intitulé doit être renseigné.');
      if (id === 'atlas-v29-mission-form') {
        var territory = form.elements.territory.value, mode = form.elements.mode.value;
        if (!TERRITORIES[territory] || !['guided','free'].includes(mode)) throw Error('Choisis un territoire et un parcours valides.');
        m.title = title; m.territory = territory; m.mode = mode;
        m.why = String(form.elements.why.value || '').trim().slice(0,800);
        saveEdited(pair.copy,'Mission modifiée. Tes étapes sont conservées.');
      } else if (id === 'atlas-v29-step-form') {
        var step = m.steps.find(function(s) { return s.id === form.dataset.sid; });
        if (!step) throw Error('Étape introuvable.');
        step.title = title;
        saveEdited(pair.copy,'Intitulé modifié. La progression est conservée.');
      } else if (id === 'atlas-v29-insert-form') {
        var position = Number(form.elements.position.value);
        if (!Number.isInteger(position) || position < 0 || position > m.steps.length) throw Error('Position invalide.');
        m.steps.splice(position,0,{id:uuid(), title:title, doneAt:null});
        refreshCompletion(m);
        saveEdited(pair.copy,'Étape ajoutée à la bonne place.');
      }
    } catch(err) { notify(err.message || 'Enregistrement impossible.'); }
  }, true);

  var originalPersist = persist;
  persist = function(nextState) {
    if (!session) { requestAccount(); return false; }
    return originalPersist(nextState);
  };

  var css = document.createElement('style');
  css.textContent =
    '.atlas-v29-gate{max-width:790px;padding:86px 22px 120px;min-height:60vh}.atlas-v29-gate h1{max-width:760px}.atlas-v29-gate .actions{margin:30px 0 18px;display:flex;flex-wrap:wrap;gap:12px}' +
    '.atlas-v29-invite{display:flex;justify-content:space-between;align-items:center;gap:28px;background:#f4eddf;border:1px solid rgba(67,83,60,.18);border-radius:26px;padding:30px 35px;margin-top:25px;margin-bottom:40px}.atlas-v29-invite h2{font-size:clamp(1.7rem,3vw,2.5rem);margin:9px 0}.atlas-v29-invite p{max-width:680px;line-height:1.5}.atlas-v29-invite-actions{display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0}' +
    '.atlas-v29-manager{margin:36px 0;padding:28px;border-radius:25px}.atlas-v29-manager .section-heading{gap:18px;flex-wrap:wrap;margin:0 0 22px}.atlas-v29-manager-buttons,.atlas-v29-step-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.atlas-v29-steps{list-style:none;padding:0;margin:0 0 23px}.atlas-v29-step{padding:15px 0;border-bottom:1px solid rgba(66,78,58,.16);display:flex;gap:18px;justify-content:space-between;align-items:center}.atlas-v29-step-title{min-width:0;flex:1}.atlas-v29-step-title strong{display:block;overflow-wrap:anywhere}.atlas-v29-step-title small{display:block;color:#6b7468;margin-top:4px}.atlas-v29-danger{color:#943f39!important}.atlas-v29-auth-switch{margin:16px 0}' +
    '@media(max-width:750px){.atlas-v29-invite,.atlas-v29-step{flex-direction:column;align-items:flex-start}.atlas-v29-invite{margin:16px 14px 30px;padding:24px}.atlas-v29-manager{padding:19px}.atlas-v29-invite-actions,.atlas-v29-step-actions{width:100%}}';
  document.head.appendChild(css);
  render();
})();