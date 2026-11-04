/* ATLAS — Missions vivantes, lecture des reflexions et echanges moderes.
   Ajout sans modification des donnees privees de l'Atlas. */
(function () {
  'use strict';
  var host = window.ATLAS_V12;
  if (!host) return;
  var stories = [];
  var storiesReady = false;
  var loading = false;
  var lastAdmin = false;
  var currentArticle = null;
  var activeOverlay = null;
  var imagesByTerritory = {};
  var territories = ['Autonomie', 'Corps', 'Esprit', 'Savoir-faire'];

  function client() { return host.client && host.client(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
  }); }
  function plain(v, max) { return String(v || '').trim().slice(0, max); }
  function safeImage(v) { try {
    var url = new URL(v); return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch (_) { return ''; } }
  function stamp(d) { if (!d) return ''; var x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleDateString('fr-FR') : ''; }
  function uid() { return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + String(Math.random()).slice(2); }
  function authRequired() { window.alert('Connecte-toi à ton compte ATLAS avec « Mon compte » pour participer. La lecture reste libre.'); }
  function getNotes() {
    var content = host.preview() ? host.getDraft() : host.getContent();
    return (content && Array.isArray(content.publicNotes) ? content.publicNotes : []).filter(function (n) { return n && n.title && n.body; });
  }
  function getStory(id) { return stories.find(function (m) { return m.id === id; }); }
  function stepsOf(m) { return Array.isArray(m.steps) ? m.steps : []; }
  function memoriesOf(m) { return Array.isArray(m.memories) ? m.memories : []; }
  function percentage(m) { var ss = stepsOf(m); return ss.length ? Math.round(ss.filter(function (s) { return !!s.doneAt; }).length * 100 / ss.length) : 0; }

  async function fetchStories() {
    var db = client();
    if (!db || loading) return;
    loading = true;
    try {
      var res = await db.from('atlas_public_mission_stories').select('*').eq('site_slug', 'cloe').order('position', {ascending:true}).limit(60);
      if (res.error) throw res.error;
      stories = res.data || [];
      storiesReady = true;
      lastAdmin = host.isAdmin();
      resetPanels();
    } catch (e) { console.warn('ATLAS missions publiques', e); }
    finally { loading = false; }
  }
  function resetPanels() {
    var gal = document.querySelector('#public-missions .mission-gallery');
    if (gal) { gal.removeAttribute('data-journey'); }
    var archived = document.querySelector('#atlas-archive');
    if (archived) archived.remove();
    var editor = document.querySelector('#atlas-journey-editor');
    if (editor) editor.remove();
    enhance();
  }
  function storyCard(m) {
    var ss = stepsOf(m), done = ss.filter(function (s) { return !!s.doneAt; }).length;
    var pct = percentage(m), pause = m.status === 'en_pause';
    var picture = imagesByTerritory[m.territory] || '<div class="atlas-journey-image-fallback" aria-hidden="true">✧</div>';
    return '<article class="published-mission atlas-journey-card">' +
      picture + '<div class="atlas-journey-content"><span class="pill">' + esc(m.territory) + ' · ' +
      (pause ? 'En pause' : m.status === 'terminee' ? 'Mission accomplie' : 'En chemin') + '</span>' +
      '<h3>' + esc(m.title) + '</h3><p>' + esc(m.description) + '</p>' +
      '<div class="atlas-journey-track" role="progressbar" aria-label="Progression de la mission" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
      '<p class="muted text-sm">' + (ss.length ? done + ' étape(s) sur ' + ss.length + ' · ' + pct + '%' : 'Les étapes du chemin arrivent bientôt') + '</p>' +
      '<button type="button" class="btn outline atlas-journey-more" data-atlas-open-story="' + esc(m.id) + '">Découvrir le chemin →</button></div></article>';
  }
  function enhanceMissions() {
    var gallery = document.querySelector('#public-missions .mission-gallery');
    if (!gallery || gallery.dataset.journey || !storiesReady) return;
    if (!Object.keys(imagesByTerritory).length) {
      Array.from(gallery.querySelectorAll('article')).forEach(function (card) {
        var pill = card.querySelector('.pill');
        var fig = card.querySelector('figure');
        if (!pill || !fig) return;
        territories.forEach(function (t) { if (pill.textContent.indexOf(t) >= 0 && !imagesByTerritory[t]) imagesByTerritory[t] = fig.outerHTML; });
      });
    }
    var visible = stories.filter(function (m) { return m.is_published || (host.preview() && host.isAdmin()); });
    var current = visible.filter(function (m) { return m.status !== 'terminee'; });
    var past = visible.filter(function (m) { return m.status === 'terminee'; });
    gallery.dataset.journey = '1';
    gallery.innerHTML = current.length ? current.map(storyCard).join('') :
      '<p class="muted">Un nouveau chapitre se prépare. Les missions accomplies restent dans les archives.</p>';
    var section = gallery.closest('section');
    if (section) section.insertAdjacentHTML('beforeend', '<section id="atlas-archive" class="atlas-journey-archive">' +
      '<h3>✦ Mes anciennes missions</h3><p class="muted">Les chemins parcourus restent ici, avec leurs étapes et souvenirs.</p>' +
      (past.length ? '<div class="atlas-journey-archive-grid">' + past.map(storyCard).join('') + '</div>' :
        '<p class="muted text-sm">Mes premières missions accomplies apparaîtront ici.</p>') + '</section>');
  }
  function enhanceNotes() {
    var section = document.querySelector('#public-carnets');
    if (!section || section.dataset.journey) return;
    section.dataset.journey = '1';
    var cards = section.querySelectorAll('.atlas-public-card');
    var notes = getNotes();
    Array.from(cards).forEach(function (card, i) {
      var n = notes[i];
      if (!n) return;
      var excerpt = n.body.replace(/\s+/g, ' ').slice(0, 190);
      card.classList.add('atlas-journey-article-card');
      card.innerHTML = '<div class="eyebrow">' + esc(n.category || 'Réflexion') + '</div>' +
        '<h3>' + esc(n.title) + '</h3><p>' + esc(excerpt) + (n.body.length > 190 ? '…' : '') + '</p>' +
        '<button type="button" class="btn outline" data-atlas-read="' + esc(n.id) + '">Lire la réflexion →</button>';
    });
  }
  function storyDetail(m) {
    var ss = stepsOf(m);
    return '<div class="eyebrow">' + esc(m.territory) + ' · ' + (m.status === 'terminee' ? 'Mission accomplie' : 'Mon chemin en cours') + '</div>' +
      '<h2 id="atlas-journey-title">' + esc(m.title) + '</h2><p class="atlas-journey-prose">' + esc(m.description) + '</p>' +
      '<div class="atlas-journey-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percentage(m) + '"><span style="width:' + percentage(m) + '%"></span></div>' +
      '<h3>Les étapes du chemin</h3>' +
      (ss.length ? '<ol class="atlas-journey-timeline">' + ss.map(function (st, i) {
        return '<li class="' + (st.doneAt ? 'done' : '') + '"><span class="atlas-journey-dot">' + (st.doneAt ? '✓' : i + 1) + '</span><div><strong>' + esc(st.title) +
          '</strong><small>' + (st.doneAt ? 'Étape franchie ' + stamp(st.doneAt) : 'À venir') + '</small>' + (st.note ? '<p>' + esc(st.note) + '</p>' : '') + '</div></li>';
      }).join('') + '</ol>' : '<p class="muted">Le parcours sera dessiné au fur et à mesure.</p>') +
      '<h3>Souvenirs & découvertes</h3>' +
      (memoriesOf(m).length ? memoriesOf(m).map(function (memory) {
        var image = safeImage(memory.imageUrl);
        return '<article class="atlas-journey-memory"><div class="eyebrow">' + esc(memory.date || '') + '</div><p>' + esc(memory.text || '') + '</p>' +
          (image ? '<img src="' + esc(image) + '" alt="Souvenir de la mission" loading="lazy">' : '') + '</article>';
      }).join('') : '<p class="muted">Les souvenirs se construiront au fil de cette aventure.</p>');
  }
  function overlay(html) {
    closeOverlay();
    var div = document.createElement('div');
    div.id = 'atlas-feature-overlay';
    div.innerHTML = '<div class="atlas-feature-shade" data-atlas-close></div><section role="dialog" aria-modal="true" aria-labelledby="atlas-journey-title" class="atlas-feature-dialog">' +
      '<button class="atlas-feature-close" type="button" data-atlas-close aria-label="Fermer">×</button>' + html + '</section>';
    document.body.appendChild(div);
    activeOverlay = div;
    div.querySelector('.atlas-feature-close').focus();
  }
  function closeOverlay() { if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; currentArticle = null; } }

  async function articleDetail(id) {
    var n = getNotes().find(function (x) { return x.id === id; });
    if (!n) return;
    currentArticle = id;
    overlay('<div class="eyebrow">' + esc(n.category || 'Les carnets de l’Esprit') + '</div>' +
      '<h2 id="atlas-journey-title">' + esc(n.title) + '</h2><div class="atlas-journey-article-body">' + esc(n.body) + '</div>' +
      '<hr><section class="atlas-journey-discussion"><h3>Vos regards sur cette réflexion</h3>' +
      '<button class="btn outline" type="button" data-atlas-like="' + esc(n.id) + '">♡ J’aime <span id="atlas-like-counter"></span></button>' +
      '<div id="atlas-article-comments"><p class="muted">Chargement des échanges…</p></div>' +
      '<form id="atlas-comment-form" data-article="' + esc(n.id) + '">' +
      '<label>Ton prénom ou pseudonyme<input name="name" maxlength="60" minlength="2" required autocomplete="nickname"></label>' +
      '<label>Ton avis<textarea name="body" rows="4" minlength="2" maxlength="1500" required placeholder="Un regard, une question, une idée…"></textarea></label>' +
      '<p class="muted text-sm">Un compte est nécessaire pour réagir. Les commentaires sont vérifiés avant d’apparaître publiquement.</p>' +
      '<button class="btn" type="submit">Proposer mon commentaire</button><p id="atlas-comment-feedback" role="status"></p></form></section>');
    currentArticle = id;
    await loadInteractions(id);
  }
  async function loadInteractions(id) {
    var db = client(), container = document.querySelector('#atlas-article-comments');
    if (!db || !container) return;
    var results = await Promise.all([
      db.from('atlas_public_article_comments').select('display_name,body,created_at').eq('article_id', id).eq('status','approved').order('created_at', {ascending:true}).limit(80),
      db.from('atlas_public_article_like_counts').select('like_count').eq('article_id', id).maybeSingle(),
      db.auth.getUser()
    ]);
    if (currentArticle !== id || !document.getElementById('atlas-feature-overlay')) return;
    if (results[0].error) console.warn('ATLAS commentaires', results[0].error);
    var comments = results[0].data || [];
    container.innerHTML = comments.length ? comments.map(function (c) {
      return '<article class="atlas-journey-comment"><strong>' + esc(c.display_name) + '</strong><small> · ' + stamp(c.created_at) + '</small><p>' + esc(c.body) + '</p></article>';
    }).join('') : '<p class="muted">Pas encore de commentaires : ouvre la conversation.</p>';
    var counter = document.getElementById('atlas-like-counter');
    if (counter) counter.textContent = '(' + (results[1].data ? results[1].data.like_count : 0) + ')';
    var user = results[2].data && results[2].data.user;
    if (user) {
      var liked = await db.from('atlas_public_article_likes').select('article_id').eq('article_id',id).eq('user_id',user.id).maybeSingle();
      var button = document.querySelector('[data-atlas-like]');
      if (button && currentArticle === id) button.firstChild.textContent = liked.data ? '♥ J’aime déjà ' : '♡ J’aime ';
    }
  }

  function enhanceEditor() {
    if (!host.isAdmin()) return;
    var target = document.querySelector('.v12-editor-grid > .v12-editor-pane');
    if (!target || document.getElementById('atlas-journey-editor')) return;
    Array.from(target.querySelectorAll('[data-v12-mission]')).forEach(function (field) {
      var pane = field.closest('div.v12-editor-pane');
      if (pane) pane.hidden = true;
    });
    Array.from(target.querySelectorAll('.eyebrow')).forEach(function (label) {
      if (label.textContent.indexOf('IV · Mes trois premières Missions') >= 0) label.textContent = 'IV · Mes missions évolutives';
    });
    var editor = document.createElement('section');
    editor.id = 'atlas-journey-editor';
    editor.className = 'atlas-public-editor';
    var cards = storiesReady ? stories.map(function (m) {
      return '<div class="atlas-journey-editor-row"><div><strong>' + esc(m.title) + '</strong><small>' +
        esc(m.territory) + ' · ' + (m.status === 'terminee' ? 'Archivée' : 'En cours') + ' · ' + (m.is_published ? 'Publique' : 'Brouillon') +
        ' · ' + percentage(m) + '%</small></div><button class="btn outline slim" type="button" data-atlas-edit-story="' + esc(m.id) + '">Modifier le parcours</button></div>';
    }).join('') : '<p class="muted">Chargement des missions…</p>';
    editor.innerHTML = '<p class="muted">Tu peux créer, compléter, mettre en pause ou terminer une Mission. Une Mission accomplie passe automatiquement dans « Mes anciennes missions » sans effacer ses souvenirs.</p>' +
      cards + '<button class="btn" type="button" data-atlas-edit-story="new">+ Nouvelle grande Mission</button>' +
      '<p class="muted text-sm">Chaque sauvegarde publique apparaît directement sur ton Atlas. Décoche « Visible » pour préparer une mission en privé.</p>' +
      '<div id="atlas-journey-moderation"><h3>Commentaires à valider</h3><p class="muted">Chargement…</p></div>';
    var first = target.querySelector('.atlas-public-editor');
    if (first) target.insertBefore(editor, first); else target.appendChild(editor);
    void loadModeration();
  }
  function editorForm(m) {
    var st = m || {id:'mission-' + Date.now(),territory:'Autonomie',title:'',description:'',status:'en_cours',is_published:false,position:stories.length,steps:[],memories:[]};
    var stepLines = stepsOf(st).map(function (s) { return (s.doneAt ? '✓ ' : '') + s.title; }).join('\n');
    var memoryLines = memoriesOf(st).map(function (s) { return [s.date || '',s.text || '',s.imageUrl || ''].join(' | '); }).join('\n');
    overlay('<div class="eyebrow">Mon Atelier · édition publique</div><h2 id="atlas-journey-title">Tracer le chemin de ma Mission</h2>' +
      '<form id="atlas-story-form" data-story="' + esc(st.id) + '">' +
      '<label>Titre<input name="title" maxlength="160" required value="' + esc(st.title) + '"></label>' +
      '<label>Territoire<select name="territory">' + territories.map(function (t) { return '<option value="' + esc(t) + '"' + (t === st.territory ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
      '<label>Pourquoi je fais cette Mission / sa présentation<textarea name="description" maxlength="1800" rows="4">' + esc(st.description) + '</textarea></label>' +
      '<label>État<select name="status"><option value="en_cours"' + (st.status === 'en_cours' ? ' selected' : '') + '>En cours</option>' +
      '<option value="en_pause"' + (st.status === 'en_pause' ? ' selected' : '') + '>En pause</option>' +
      '<option value="terminee"' + (st.status === 'terminee' ? ' selected' : '') + '>Terminée · aller dans les anciennes Missions</option></select></label>' +
      '<label>Ordre d’affichage<input name="position" type="number" min="0" max="1000" value="' + Number(st.position || 0) + '"></label>' +
      '<label>Les étapes (une par ligne)<textarea name="steps" rows="8" placeholder="Préparer le projet&#10;✓ Réaliser ma première étape&#10;Continuer à apprendre">' + esc(stepLines) + '</textarea></label>' +
      '<p class="muted text-sm">Ajoute ✓ devant une étape franchie. Les étapes restent dans l’ordre que tu choisis.</p>' +
      '<label>Souvenirs (date | souvenir | adresse HTTPS d’une photo facultative ; une ligne par souvenir)' +
      '<textarea name="memories" rows="6" placeholder="2026-11-04 | Mon premier essai, ce que j’ai appris | https://...">' + esc(memoryLines) + '</textarea></label>' +
      '<label class="atlas-journey-check"><input name="visible" type="checkbox"' + (st.is_published ? ' checked' : '') + '> Visible par tous</label>' +
      '<button type="submit" class="btn">Enregistrer ma Mission</button> <p role="status" id="atlas-story-feedback"></p></form>');
  }
  function parseSteps(raw, previous) {
    var all = String(raw || '').split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
    if (all.length > 40) throw Error('Maximum 40 étapes par Mission.');
    return all.map(function (line, i) {
      var done = /^✓\s*/.test(line), title = line.replace(/^✓\s*/, '').slice(0, 250);
      var before = previous[i];
      return {id:before && before.title === title ? before.id : uid(),title:title,
        doneAt:done ? (before && before.doneAt || new Date().toISOString()) : null,
        note:before && before.title === title ? plain(before.note, 1500) : ''};
    });
  }
  function parseMemories(raw) {
    var lines = String(raw || '').split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
    if (lines.length > 30) throw Error('Maximum 30 souvenirs par Mission.');
    return lines.map(function (line) {
      var fields = line.split(' | ');
      var date = plain(fields.shift(), 30);
      var text = plain(fields.shift(), 2200);
      var photo = plain(fields.join(' | '), 600);
      if (!text) throw Error('Chaque souvenir doit contenir une date et un texte, séparés par |.');
      if (photo && !safeImage(photo)) throw Error('Les photos doivent utiliser une adresse HTTPS valide.');
      return {id:uid(),date:date,text:text,imageUrl:photo};
    });
  }
  async function saveStory(form) {
    if (!host.isAdmin()) return;
    var db = client(), f = new FormData(form), id = form.dataset.story;
    var previous = getStory(id), title = plain(f.get('title'), 160);
    if (!title) return;
    try {
      var status = f.get('status'), territory = f.get('territory');
      if (!territories.includes(territory) || !['en_cours','en_pause','terminee'].includes(status)) throw Error('Valeur invalide.');
      var row = {id:id,site_slug:'cloe',title:title,territory:territory,description:plain(f.get('description'),1800),
        status:status,position:Math.max(0,Math.min(1000,Number(f.get('position')) || 0)),
        is_published:f.get('visible') === 'on',
        steps:parseSteps(f.get('steps'),previous ? stepsOf(previous) : []),
        memories:parseMemories(f.get('memories')),
        completed_at:status === 'terminee' ? (previous && previous.completed_at || new Date().toISOString()) : null,
        updated_at:new Date().toISOString()};
      var result = await db.from('atlas_public_mission_stories').upsert(row,{onConflict:'id'});
      if (result.error) throw result.error;
      closeOverlay();
      await fetchStories();
    } catch (e) {
      var feedback = document.getElementById('atlas-story-feedback');
      if (feedback) feedback.textContent = 'Enregistrement impossible : ' + e.message;
    }
  }
  async function loadModeration() {
    if (!host.isAdmin()) return;
    var container = document.getElementById('atlas-journey-moderation'), db = client();
    if (!container || !db) return;
    var result = await db.from('atlas_public_article_comments').select('id,article_id,display_name,body,created_at').eq('status','pending').order('created_at',{ascending:true}).limit(100);
    if (!container.isConnected || !host.isAdmin()) return;
    if (result.error) { container.innerHTML = '<p>Impossible de charger les commentaires.</p>'; return; }
    container.innerHTML = '<h3>Commentaires à valider (' + result.data.length + ')</h3>' +
      (result.data.length ? result.data.map(function (c) {
        return '<article class="atlas-journey-comment"><strong>' + esc(c.display_name) + '</strong><small> · ' + stamp(c.created_at) +
          '</small><p>' + esc(c.body) + '</p><div class="actions"><button type="button" class="btn slim" data-atlas-moderate="' + esc(c.id) +
          '" data-status="approved">Approuver</button><button type="button" class="btn slim outline" data-atlas-moderate="' + esc(c.id) +
          '" data-status="rejected">Refuser</button></div></article>';
      }).join('') : '<p class="muted">Aucun commentaire en attente.</p>');
  }
  async function moderate(button) {
    if (!host.isAdmin()) return;
    var status = button.dataset.status;
    if (!['approved','rejected'].includes(status)) return;
    button.disabled = true;
    var res = await client().from('atlas_public_article_comments').update({status:status}).eq('id',button.dataset.atlasModerate);
    if (res.error) window.alert('Modération impossible : ' + res.error.message);
    await loadModeration();
  }
  async function toggleLike(id) {
    var db = client(); if (!db) return;
    var auth = await db.auth.getUser(), user = auth.data && auth.data.user;
    if (!user) { authRequired(); return; }
    var existing = await db.from('atlas_public_article_likes').select('article_id').eq('article_id',id).eq('user_id',user.id).maybeSingle();
    var res = existing.data ? await db.from('atlas_public_article_likes').delete().eq('article_id',id).eq('user_id',user.id) :
      await db.from('atlas_public_article_likes').insert({article_id:id,user_id:user.id});
    if (res.error) { window.alert('Impossible de modifier ton J’aime : ' + res.error.message); return; }
    await loadInteractions(id);
  }
  async function sendComment(form) {
    var db = client(), auth = await db.auth.getUser(), user = auth.data && auth.data.user;
    var feedback = form.querySelector('#atlas-comment-feedback');
    if (!user) { authRequired(); return; }
    var name = plain(form.elements.name.value,60), body = plain(form.elements.body.value,1500);
    if (name.length < 2 || body.length < 2) return;
    var result = await db.from('atlas_public_article_comments').insert({article_id:form.dataset.article,author_id:user.id,display_name:name,body:body,status:'pending'});
    if (result.error) { feedback.textContent = 'Impossible de transmettre ton commentaire : ' + result.error.message; return; }
    form.elements.body.value = '';
    feedback.textContent = 'Merci ! Ton commentaire a été reçu et sera affiché après validation.';
  }
  function enhance() {
    if (host.isAdmin() !== lastAdmin && !loading && client()) { void fetchStories(); return; }
    enhanceMissions();
    enhanceNotes();
    enhanceEditor();
  }
  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-atlas-close]');
    if (close) { e.preventDefault(); closeOverlay(); return; }
    var story = e.target.closest('[data-atlas-open-story]');
    if (story) { e.preventDefault(); var m = getStory(story.dataset.atlasOpenStory); if (m) overlay(storyDetail(m)); return; }
    var read = e.target.closest('[data-atlas-read]');
    if (read) { e.preventDefault(); void articleDetail(read.dataset.atlasRead); return; }
    var edit = e.target.closest('[data-atlas-edit-story]');
    if (edit) { e.preventDefault(); if (host.isAdmin()) editorForm(getStory(edit.dataset.atlasEditStory)); return; }
    var like = e.target.closest('[data-atlas-like]');
    if (like) { e.preventDefault(); void toggleLike(like.dataset.atlasLike); return; }
    var mod = e.target.closest('[data-atlas-moderate]');
    if (mod) { e.preventDefault(); void moderate(mod); }
  }, true);
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'atlas-story-form') { e.preventDefault(); e.stopImmediatePropagation(); void saveStory(e.target); }
    if (e.target.id === 'atlas-comment-form') { e.preventDefault(); e.stopImmediatePropagation(); void sendComment(e.target); }
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && activeOverlay) closeOverlay(); });
  var css = document.createElement('style');
  css.textContent =
    '.atlas-journey-track{height:8px;overflow:hidden;border-radius:12px;background:#ded5c4;margin:19px 0 9px}.atlas-journey-track>span{display:block;height:100%;background:#688569;border-radius:inherit;transition:width .4s}' +
    '.atlas-journey-card{overflow:hidden}.atlas-journey-card figure{margin:0}.atlas-journey-content{padding:20px}.atlas-journey-content h3{margin:12px 0}.atlas-journey-content p{line-height:1.6}.atlas-journey-more{margin-top:12px}' +
    '.atlas-journey-archive{margin:44px 0 25px;padding-top:28px;border-top:1px solid #cfc2ab}.atlas-journey-archive h3{font-family:var(--serif);font-size:2.4rem}.atlas-journey-archive-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:20px}.atlas-journey-image-fallback{height:170px;background:#e4dbc9;display:grid;place-items:center;font-size:3rem}' +
    '.atlas-journey-article-card{cursor:default}.atlas-journey-article-card>p{line-height:1.65}.atlas-journey-article-card .btn{margin-top:15px}' +
    '#atlas-feature-overlay{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:18px}.atlas-feature-shade{position:absolute;inset:0;background:rgba(22,34,27,.7)}' +
    '.atlas-feature-dialog{position:relative;width:min(850px,100%);max-height:90vh;overflow:auto;background:#fcf6ea;color:#293d32;border-radius:22px;padding:clamp(25px,5vw,55px);box-shadow:0 20px 70px #0004}.atlas-feature-dialog h2{font-family:var(--serif);font-size:clamp(2rem,5vw,3.6rem);line-height:1.1;margin:10px 30px 25px 0}.atlas-feature-dialog h3{font-size:1.5rem;margin:27px 0 13px}.atlas-feature-close{position:absolute;right:18px;top:15px;border:0;background:transparent;font-size:2rem;cursor:pointer;color:inherit}' +
    '.atlas-journey-prose,.atlas-journey-article-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.85}.atlas-journey-article-body{font-size:1.08rem}.atlas-journey-timeline{list-style:none;padding:0;margin:18px 0}.atlas-journey-timeline li{display:flex;gap:15px;padding:12px 0;border-bottom:1px solid #e4d9c8}.atlas-journey-timeline strong{display:block}.atlas-journey-timeline small{display:block;color:#776f61;margin-top:3px}.atlas-journey-dot{width:35px;height:35px;border-radius:50%;border:1px solid #b9ae99;display:grid;place-items:center;flex-shrink:0}.atlas-journey-timeline li.done .atlas-journey-dot{background:#5a715b;color:white}.atlas-journey-memory{margin:13px 0;padding:18px;border-radius:13px;background:#f1eadb}.atlas-journey-memory p{white-space:pre-wrap;line-height:1.7}.atlas-journey-memory img{max-width:100%;max-height:450px;border-radius:11px}' +
    '.atlas-feature-dialog label{display:block;font-weight:600;margin:16px 0 8px}.atlas-feature-dialog input:not([type=checkbox]),.atlas-feature-dialog textarea,.atlas-feature-dialog select{display:block;width:100%;border:1px solid #c6bba7;border-radius:8px;background:white;padding:11px;margin-top:8px;font:inherit}.atlas-journey-check{display:flex!important;align-items:center;gap:12px}.atlas-journey-comment{padding:13px 0;border-bottom:1px solid #d7ccbb}.atlas-journey-comment p{white-space:pre-wrap;line-height:1.6}.atlas-journey-editor-row{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #d7ccbb;padding:13px 0}.atlas-journey-editor-row small{display:block;color:#766f65;margin-top:4px}' +
    '@media(max-width:650px){.atlas-feature-dialog{padding:24px 18px}.atlas-journey-editor-row{align-items:flex-start;flex-direction:column}}';
  document.head.appendChild(css);
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () { queued = false; enhance(); });
  }).observe(document.body,{childList:true,subtree:true});
  enhance();
  var polls = 0, starter = setInterval(function () {
    if (client()) { clearInterval(starter); void fetchStories(); }
    else if (++polls > 40) clearInterval(starter);
  },500);
})();
