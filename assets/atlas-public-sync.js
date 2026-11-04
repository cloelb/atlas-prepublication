/* ATLAS — Passage choisi du privé au public.
   Une publication copie seulement les champs explicitement partagés.
   Les originaux, notes et photos privées ne sont jamais supprimés. */
(function () {
  'use strict';
  var api = window.ATLAS_V12;
  if (!api) return;
  var sharedBooks = [], linkedStories = [], booksLoaded = false;
  var busy = false, queued = false, booted = false, currentBook = null;
  var lastBookRefresh = 0;
  var mapTerritory = {autonomie:'Autonomie',corps:'Corps',esprit:'Esprit',savoir:'Savoir-faire'};
  function db() { return api.client && api.client(); }
  function founder() { return Boolean(api.isAdmin && api.isAdmin()); }
  function privateState() { try { return typeof state !== 'undefined' ? state : null; } catch (_) { return null; } }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];
  }); }
  function clean(v, n) { return String(v == null ? '' : v).trim().slice(0,n); }
  function safeCover(v) { return typeof v === 'string' && v.length <= 450000 &&
    /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(v) ? v : ''; }
  function pct(b) { if (b.status === 'finished') return 100;
    var total = Number(b.pages_total)||0;
    return total ? Math.max(0,Math.min(100,Math.round((Number(b.current_page)||0)*100/total))) : null;
  }
  function bookRow(b, position) {
    var orig = (privateState() && privateState().bookmarks || []).find(function(x){return x.id === b.id;});
    var status = b.status || 'to-read';
    var num = Math.max(0,Number(orig && orig.currentPage)||0);
    var total = Math.max(0,Number(orig && orig.pagesTotal)||0);
    return {
      source_id:clean(b.id,100), site_slug:'cloe', title:clean(b.title,180),
      author:clean(b.author,120), status:status,
      pages_total:total, current_page:total?Math.min(num,total):num,
      cover_data:safeCover(b.cover)||null,
      opinion:clean(b.note,2800),
      position:Math.min(1000,Math.max(0,position||0)), is_published:true,
      updated_at:new Date().toISOString()
    };
  }
  function storyId(id) { return 'personal-' + String(id||''); }
  function storyFromPersonal(m, original) {
    var old = original || {};
    var oldSteps = Array.isArray(old.steps) ? old.steps : [];
    var done = Boolean(m.completedAt);
    return {
      id:storyId(m.id),site_slug:'cloe',
      title:clean(m.title,160),
      territory:mapTerritory[m.territory]||'Esprit',
      description:clean(m.why,1800),
      status:done?'terminee':'en_cours',
      position:Number.isInteger(old.position)?old.position:0,
      steps:(m.steps||[]).slice(0,40).map(function(s) {
        var previous=oldSteps.find(function(p){return p.id===s.id;});
        return {id:String(s.id),title:clean(s.title,250),doneAt:s.doneAt||null,
          note:previous && previous.note || ''};
      }),
      // Les souvenirs du Carnet ne sont PAS copiés automatiquement.
      memories:Array.isArray(old.memories)?old.memories:[],
      is_published:true,
      completed_at:done?(m.completedAt||old.completed_at||new Date().toISOString()):null,
      updated_at:new Date().toISOString()
    };
  }
  function siteVisible() {
    var publicRoot=document.querySelector('.public-v12');
    return Boolean(publicRoot);
  }
  async function readBooks() {
    var client=db();
    if (!client) return;
    var res=await client.from('atlas_public_books').select('*').eq('site_slug','cloe').order('position',{ascending:true}).limit(50);
    if (res.error) { console.warn('ATLAS livres publics',res.error); return; }
    sharedBooks=res.data||[];
    booksLoaded=true;
    lastBookRefresh=Date.now();
    drawBooks();
    enhancePersonal();
  }
  async function readLinkedStories() {
    if (!founder() || !db()) return;
    var res=await db().from('atlas_public_mission_stories').select('*').eq('site_slug','cloe').like('id','personal-%').limit(80);
    if (!res.error) { linkedStories=res.data||[]; enhancePersonal(); }
  }
  function coverMarkup(b, alt) {
    var image=safeCover(b.cover_data);
    return image ? '<img src="'+image+'" loading="lazy" alt="'+esc(alt||('Couverture de '+b.title))+'">' :
      '<div class="atlas-v31-book-placeholder" aria-hidden="true"><span>✦</span><small>ATLAS</small></div>';
  }
  function manualBooks() {
    var content=api.preview && api.preview() ? api.getDraft() : api.getContent();
    if (!content || !Array.isArray(content.publicBooks)) return [];
    return content.publicBooks.filter(function(b){return b && b.title;}).map(function(b,i) {
      return {source_id:'manual-'+(b.id||i),title:b.title,author:b.author||'',
        opinion:b.note||'',pages_total:0,current_page:0,status:'',cover_data:null,is_published:true};
    });
  }
  function visibleBooks() {
    var active=sharedBooks.filter(function(b){return b.is_published;});
    var keys=active.map(function(b){return clean(b.title,180).toLowerCase()+'|'+clean(b.author,120).toLowerCase();});
    var manual=manualBooks().filter(function(b){
      return keys.indexOf(clean(b.title,180).toLowerCase()+'|'+clean(b.author,120).toLowerCase())<0;
    });
    return active.concat(manual).slice(0,24);
  }
  function bookCard(b) {
    var percentage=pct(b);
    var status=b.status==='finished'?'Terminé':b.status==='reading'?'En cours':b.status==='to-read'?'À découvrir':'Lecture partagée';
    return '<button type="button" class="atlas-v31-book" data-atlas-public-book="'+esc(b.source_id)+'" aria-label="Découvrir '+esc(b.title)+'">' +
      '<span class="atlas-v31-book-cover">'+coverMarkup(b)+'</span><span class="atlas-v31-book-info">'+
      '<span class="eyebrow">'+esc(status)+'</span><strong>'+esc(b.title)+'</strong><small>'+esc(b.author)+'</small>'+
      (percentage!==null?'<span class="atlas-v31-meter"><span style="width:'+percentage+'%"></span></span><small>'+percentage+' % lu'+(b.pages_total?' · '+Number(b.current_page||0)+' / '+Number(b.pages_total)+' pages':'')+'</small>':'<small>Découvrir mon avis et ma lecture</small>')+
      '<span class="atlas-v31-book-action">Ouvrir le livre →</span></span></button>';
  }
  function drawBooks() {
    if (!siteVisible()) return;
    var rows=visibleBooks();
    var target=document.querySelector('#public-lectures');
    var dynamic=document.getElementById('atlas-v31-library');
    if (!rows.length) {
      if(dynamic) dynamic.remove();
      return;
    }
    if (!target) {
      target=document.createElement('section');
      target.className='public-chapter atlas-published-books';
      target.id='atlas-v31-library';
      var anchor=document.querySelector('#public-carnets')||document.querySelector('#public-missions');
      if(anchor) anchor.insertAdjacentElement('afterend',target);
    }
    // Évite une boucle infinie de rendu avec le MutationObserver.
    var signature=JSON.stringify(rows.map(function(b){
      return [b.source_id,b.title,b.author,b.status,b.pages_total,b.current_page,b.opinion,
        b.cover_data&&b.cover_data.length,b.updated_at];
    }));
    if(target.dataset.atlasV31Signature===signature)return;
    target.dataset.atlasV31Signature=signature;
    // Ne montrer qu'une seule version de la bibliothèque, en gardant
    // les ouvrages ajoutés manuellement dans l'Atelier.
    var loop=rows.length>2;
    target.classList.add('atlas-v31-library');
    target.innerHTML='<span class="chapter-kicker">III · Ma bibliothèque ouverte</span><div class="atlas-v31-section-head">'+
      '<div><h2>Les livres qui m’accompagnent.</h2><p>Ce que je lis, ce que j’en pense, et le chemin parcouru entre les pages.</p></div>'+
      '<div class="atlas-v31-slider-legend" aria-hidden="true">✦ Les lectures défilent ✦</div></div>'+
      '<div class="atlas-v31-book-window" aria-label="Livres de Cloé"><div class="atlas-v31-book-track'+(loop?' is-moving':'')+'">'+
      rows.map(bookCard).join('')+(loop?rows.map(bookCard).join(''):'')+'</div></div>';
  }
  function showBook(id) {
    var b=visibleBooks().find(function(x){return x.source_id===id;});
    if (!b) return;
    currentBook=id;
    var percentage=pct(b);
    var status=b.status==='finished'?'Lecture terminée':b.status==='reading'?'Lecture en cours':b.status==='to-read'?'À découvrir':'Livre partagé';
    var content='<div class="atlas-v31-book-detail">'+coverMarkup(b)+
      '<div><div class="eyebrow">Bibliothèque · '+esc(status)+'</div><h2 id="atlas-v31-book-title">'+esc(b.title)+'</h2>'+
      '<p class="atlas-v31-author">'+esc(b.author)+'</p>'+
      (percentage!==null?'<div class="atlas-v31-meter"><span style="width:'+percentage+'%"></span></div><p>'+percentage+' % de lecture'+(b.pages_total?' · '+Number(b.current_page||0)+' / '+Number(b.pages_total)+' pages':'')+'</p>':'')+
      '<h3>Mon avis sur ce livre</h3><div class="atlas-v31-opinion">'+
      (b.opinion?esc(b.opinion):'Je partagerai ici ce que cette lecture m’inspire.')+
      '</div></div></div>';
    var shade=document.createElement('div');
    shade.id='atlas-v31-book-overlay';
    shade.innerHTML='<div class="atlas-v31-shade" data-atlas-close-book></div>'+
      '<section role="dialog" aria-modal="true" aria-labelledby="atlas-v31-book-title" class="atlas-v31-book-dialog">'+
      '<button type="button" class="atlas-v31-close" data-atlas-close-book aria-label="Fermer">×</button>'+content+'</section>';
    document.body.appendChild(shade);
    shade.querySelector('.atlas-v31-close').focus();
  }
  function closeBook() {var pop=document.getElementById('atlas-v31-book-overlay');if(pop)pop.remove();currentBook=null;}
  function personalMission() {
    if (!founder() || typeof route!=='function' || route().indexOf('mission/')!==0) return;
    var person=privateState();
    var id=route().slice(8);
    var m=person && (person.missions||[]).find(function(x){return x.id===id;});
    var where=document.querySelector('.mission-hero-copy');
    if(!m||!where||where.querySelector('.atlas-v31-share-mission'))return;
    var linked=linkedStories.find(function(x){return x.id===storyId(m.id);});
    var published=linked&&linked.is_published;
    var area=document.createElement('div');
    area.className='atlas-v31-share-mission';
    area.innerHTML='<p class="muted text-sm">Ton chemin reste personnel. Tu peux choisir de montrer son titre, ses étapes et sa progression sur l’Atlas de Cloé, sans publier ton Carnet privé.</p>'+
      '<button class="btn outline" type="button" data-atlas-share-mission="'+esc(m.id)+'">'+
      (published?'Retirer cette Mission du public':'✦ Partager cette Mission sur mon Atlas public')+'</button>'+
      '<span class="atlas-v31-share-status">'+(published?' ● Visible par tous':' ○ Privée')+'</span>';
    where.appendChild(area);
  }
  function personalBook() {
    if(!founder())return;
    var form=document.querySelector('#book-progress-form');
    if(!form || document.getElementById('atlas-v31-book-publisher'))return;
    var person=privateState();
    var b=person && (person.bookmarks||[]).find(function(x){return x.id===form.dataset.book;});
    if(!b)return;
    var linked=sharedBooks.find(function(x){return x.source_id===b.id;});
    var published=linked&&linked.is_published;
    var panel=document.createElement('section');
    panel.id='atlas-v31-book-publisher';
    panel.innerHTML='<div class="eyebrow">✦ Mon avis et mon partage</div>'+
      '<p class="muted text-sm">Ton livre reste dans ta bibliothèque personnelle, même si tu le publies. Tu choisis précisément ce que les autres voient.</p>'+
      '<label for="atlas-v31-personal-opinion">Mon avis sur ce livre</label>'+
      '<textarea id="atlas-v31-personal-opinion" maxlength="2800" rows="5" placeholder="Ce que j’ai aimé, appris, ressenti…">'+esc(b.note||'')+'</textarea>'+
      '<div class="actions"><button type="button" class="btn outline" data-atlas-save-opinion="'+esc(b.id)+'">Conserver mon avis</button>'+
      '<button type="button" class="btn" data-atlas-share-book="'+esc(b.id)+'">'+
      (published?'Retirer du public':'Partager ce livre publiquement')+'</button></div>'+
      '<p class="muted text-sm" id="atlas-v31-book-feedback" role="status">'+
      (published?'Ce livre est visible avec sa couverture, ton avis et ta progression.':'Ce livre est privé pour le moment.')+'</p>';
    form.insertAdjacentElement('afterend',panel);
  }
  function personalEditor() {
    var target=document.getElementById('atlas-journey-editor');
    if (!founder()||!target||target.querySelector('.atlas-v31-links'))return;
    var section=document.createElement('div');
    section.className='atlas-v31-links';
    section.innerHTML='<h3>Une seule bibliothèque, deux regards</h3>'+
      '<p>Pour publier une lecture, ouvre <strong>Ma Bibliothèque</strong>, sélectionne son livre et utilise « Partager ce livre publiquement ». Sa progression se mettra ensuite à jour sans quitter ton Atlas personnel.</p>'+
      '<a class="btn outline" href="#/bibliotheque">Ouvrir ma Bibliothèque →</a>';
    target.appendChild(section);
  }
  function drawGuide() {
    if(!siteVisible())return;
    var first=document.querySelector('.v16-public-intro');
    if(!first||document.getElementById('atlas-v31-public-guide'))return;
    var guide=document.createElement('nav');
    guide.id='atlas-v31-public-guide';
    guide.setAttribute('aria-label','Explorer les chapitres de l’Atlas de Cloé');
    guide.innerHTML='<div class="atlas-v31-guide-top"><span class="eyebrow">L’Atlas de Cloé · Un chemin vivant</span><span class="atlas-v31-guide-star" aria-hidden="true">✦</span></div>'+
      '<p>Entre dans mes missions, feuillette ma bibliothèque et découvre mes réflexions.</p>'+
      '<div class="atlas-v31-guide-actions"><button type="button" data-atlas-jump="public-missions">Mes missions <span>↗</span></button>'+
      '<button type="button" data-atlas-jump="atlas-v31-library">Ma bibliothèque <span>↗</span></button>'+
      '<button type="button" data-atlas-jump="public-carnets">Mes réflexions <span>↗</span></button></div>';
    first.insertAdjacentElement('afterend',guide);
  }
  function enhancePersonal() {personalMission();personalBook();personalEditor();}
  function enhance() { drawBooks();drawGuide();enhancePersonal(); }
  function printFeedback(id,txt) {var el=document.getElementById(id);if(el)el.textContent=txt;}
  function refreshMissionPanel(id) {
    var panel=document.querySelector('.atlas-v31-share-mission');if(panel)panel.remove();
    personalMission();
  }
  async function toggleMission(id) {
    if(!founder()||!db())return;
    var person=privateState(),m=person&&(person.missions||[]).find(function(x){return x.id===id;});
    if(!m)return;
    var prior=linkedStories.find(function(x){return x.id===storyId(id);});
    var data=prior && prior.is_published ? {is_published:false,updated_at:new Date().toISOString()} : storyFromPersonal(m,prior);
    var r=prior ? await db().from('atlas_public_mission_stories').update(data).eq('id',storyId(id)) :
      await db().from('atlas_public_mission_stories').insert(data);
    if(r.error){window.alert('Partage impossible : '+r.error.message);return;}
    await readLinkedStories();
    refreshMissionPanel(id);
    window.dispatchEvent(new Event('atlas-shared-updated'));
  }
  function saveOpinion(id) {
    var person=privateState(),b=person&&(person.bookmarks||[]).find(function(x){return x.id===id;});
    var field=document.getElementById('atlas-v31-personal-opinion');
    if(!b||!field||typeof persist!=='function')return false;
    var next=structuredClone(person);
    var entry=next.bookmarks.find(function(x){return x.id===id;});
    entry.note=clean(field.value,2800);
    persist(next);  // L'original reste dans bookmarks ; aucune suppression ni déplacement.
    printFeedback('atlas-v31-book-feedback','Avis conservé dans ta bibliothèque personnelle.');
    return true;
  }
  async function toggleBook(id) {
    if(!founder()||!db())return;
    if(!saveOpinion(id))return;
    var person=privateState(),b=person&&(person.bookmarks||[]).find(function(x){return x.id===id;});
    if(!b)return;
    var prior=sharedBooks.find(function(x){return x.source_id===id;});
    var data=prior&&prior.is_published?{is_published:false,updated_at:new Date().toISOString()}:
      bookRow(b,Math.max(0,(person.bookmarks||[]).findIndex(function(x){return x.id===id;})));
    var res=prior ? await db().from('atlas_public_books').update(data).eq('source_id',id) :
      await db().from('atlas_public_books').insert(data);
    if(res.error){printFeedback('atlas-v31-book-feedback','Publication impossible : '+res.error.message);return;}
    await readBooks();
    var panel=document.getElementById('atlas-v31-book-publisher');if(panel)panel.remove();
    personalBook();
  }
  async function synchronizeLinked() {
    if (busy||!founder()||!db()) { if(busy)queued=true;return; }
    var person=privateState();
    if(!person)return;
    busy=true;
    try {
      // Recharger les choix de visibilité du serveur avant de synchroniser.
      var results=await Promise.all([
        db().from('atlas_public_mission_stories').select('*').eq('site_slug','cloe').like('id','personal-%').limit(80),
        db().from('atlas_public_books').select('*').eq('site_slug','cloe').limit(50)
      ]);
      if(results[0].error||results[1].error)throw results[0].error||results[1].error;
      linkedStories=results[0].data||[];
      sharedBooks=results[1].data||[];
      var tasks=[];
      linkedStories.filter(function(r){return r.is_published;}).forEach(function(original){
        var id=original.id.slice('personal-'.length);
        var mission=(person.missions||[]).find(function(m){return m.id===id;});
        if(!mission)return; // Une suppression privée n'efface pas l'archive publique.
        tasks.push(db().from('atlas_public_mission_stories').update(storyFromPersonal(mission,original)).eq('id',original.id));
      });
      sharedBooks.filter(function(r){return r.is_published;}).forEach(function(original){
        var idx=(person.bookmarks||[]).findIndex(function(b){return b.id===original.source_id;});
        if(idx<0)return;
        tasks.push(db().from('atlas_public_books').update(bookRow(person.bookmarks[idx],idx)).eq('source_id',original.source_id));
      });
      var writes=await Promise.all(tasks);
      var error=writes.find(function(w){return w.error;});
      if(error)throw error.error;
      window.dispatchEvent(new Event('atlas-shared-updated'));
      enhancePersonal();
    }catch(e){console.warn('ATLAS synchronisation de partage',e);}
    finally {busy=false;if(queued){queued=false;setTimeout(synchronizeLinked,250);}}
  }
  // La sauvegarde personnelle reste prioritaire et ne dépend pas du partage.
  // Un changement de progression déclenche uniquement une copie des éléments déjà publiés.
  if(typeof persist==='function'){
    var originalPersist=persist;
    persist=function(next){
      var result=originalPersist(next);
      if(founder() && result!==false) setTimeout(synchronizeLinked,400);
      return result;
    };
  }
  document.addEventListener('click',function(e){
    var button=e.target.closest('[data-atlas-public-book]');
    if(button){e.preventDefault();showBook(button.dataset.atlasPublicBook);return;}
    var close=e.target.closest('[data-atlas-close-book]');
    if(close){e.preventDefault();closeBook();return;}
    var jump=e.target.closest('[data-atlas-jump]');
    if(jump){e.preventDefault();var target=document.getElementById(jump.dataset.atlasJump);
      if(!target && jump.dataset.atlasJump==='atlas-v31-library')target=document.getElementById('public-lectures');
      if(target)target.scrollIntoView({behavior:'smooth',block:'start'});return;}
    var m=e.target.closest('[data-atlas-share-mission]');
    if(m){e.preventDefault();m.disabled=true;void toggleMission(m.dataset.atlasShareMission).finally(function(){m.disabled=false;});return;}
    var save=e.target.closest('[data-atlas-save-opinion]');
    if(save){e.preventDefault();saveOpinion(save.dataset.atlasSaveOpinion);return;}
    var b=e.target.closest('[data-atlas-share-book]');
    if(b){e.preventDefault();b.disabled=true;void toggleBook(b.dataset.atlasShareBook).finally(function(){b.disabled=false;});return;}
  },true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&currentBook)closeBook();});
  window.addEventListener('atlas-shared-updated',function(){void readBooks();});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&siteVisible()&&Date.now()-lastBookRefresh>30000)void readBooks();});
  var changesQueued=false;
  new MutationObserver(function(){
    if(changesQueued)return;changesQueued=true;
    requestAnimationFrame(function(){changesQueued=false;enhance();});
  }).observe(document.body,{subtree:true,childList:true});
  var css=document.createElement('style');
  css.textContent=[
    '#atlas-v31-public-guide{margin:0 0 40px;padding:24px 30px;border:1px solid #d8c6a6;border-radius:22px;background:linear-gradient(105deg,#f4ecd9,#fff9eb);box-shadow:0 10px 30px #3228170d}',
    '.atlas-v31-guide-top,.atlas-v31-guide-actions,.atlas-v31-section-head{display:flex;align-items:center;justify-content:space-between;gap:18px}',
    '#atlas-v31-public-guide p{font-size:1.04rem;margin:8px 0 18px}.atlas-v31-guide-star{font-size:2rem;color:#93734c}',
    '.atlas-v31-guide-actions{flex-wrap:wrap;justify-content:flex-start}.atlas-v31-guide-actions button{border:1px solid #b8a784;background:transparent;border-radius:999px;padding:12px 18px;font:inherit;color:#314336;cursor:pointer;transition:transform .2s,background .2s}.atlas-v31-guide-actions button:hover{background:#e5dcc4;transform:translateY(-3px)}',
    '.atlas-v31-guide-actions button span{margin-left:12px}.atlas-v31-library{overflow:hidden}.atlas-v31-section-head{align-items:flex-end;margin:10px 0 25px}.atlas-v31-section-head p{line-height:1.6;max-width:570px}.atlas-v31-slider-legend{font-family:var(--serif);font-size:1.25rem;color:#7a6a50}',
    '.atlas-v31-book-window{overflow:hidden;padding:12px 2px 28px;mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}.atlas-v31-book-track{display:flex;gap:22px;width:max-content}.atlas-v31-book-track.is-moving{animation:atlas-v31-marquee 38s linear infinite}.atlas-v31-book-window:hover .atlas-v31-book-track,.atlas-v31-book-window:focus-within .atlas-v31-book-track{animation-play-state:paused}',
    '.atlas-v31-book{display:flex;flex-direction:column;text-align:left;white-space:normal;width:214px;flex:0 0 214px;padding:12px;background:#fffbf2;border:1px solid #d8c7b0;border-radius:19px;box-shadow:0 5px 22px #2f28140d;cursor:pointer;color:inherit;transition:transform .25s,box-shadow .25s}.atlas-v31-book:hover{transform:translateY(-7px);box-shadow:0 14px 35px #2f281422}',
    '.atlas-v31-book-cover{height:225px;width:100%;display:block;overflow:hidden;border-radius:10px;background:#e9ddc6}.atlas-v31-book-cover>img{height:100%;width:100%;object-fit:contain;background:#eee3d1}',
    '.atlas-v31-book-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;width:100%;height:100%;background:linear-gradient(140deg,#355341,#1d352d);color:#f1deac;box-shadow:inset 10px 0 16px #0002}.atlas-v31-book-placeholder span{font-size:4rem}.atlas-v31-book-placeholder small{letter-spacing:.25em}',
    '.atlas-v31-book-info{display:flex;flex-direction:column;gap:8px;padding:14px 4px 5px}.atlas-v31-book-info strong{font-family:var(--serif);font-size:1.45rem;line-height:1.1;min-height:2.1em}.atlas-v31-book-info small{color:#736a60}.atlas-v31-book-action{margin-top:4px;font-weight:600;text-decoration:underline;text-underline-offset:3px}',
    '.atlas-v31-meter{display:block;height:8px;border-radius:20px;overflow:hidden;background:#ded6c6;margin:7px 0}.atlas-v31-meter>span{display:block;height:100%;background:#5e805f;border-radius:inherit}',
    '#atlas-v31-book-overlay{position:fixed;inset:0;z-index:6000;display:grid;place-items:center;padding:16px}.atlas-v31-shade{position:absolute;inset:0;background:#19281fc9}.atlas-v31-book-dialog{position:relative;width:min(850px,100%);max-height:90vh;overflow:auto;border-radius:22px;padding:clamp(24px,5vw,48px);background:#fff7e9;box-shadow:0 20px 60px #0004;color:#2b4337}.atlas-v31-close{position:absolute;right:18px;top:12px;font:inherit;font-size:2rem;border:0;background:none;cursor:pointer}',
    '.atlas-v31-book-detail{display:grid;grid-template-columns:210px 1fr;gap:32px;align-items:start}.atlas-v31-book-detail>img,.atlas-v31-book-detail>.atlas-v31-book-placeholder{width:210px;max-height:320px;object-fit:contain;border-radius:13px;box-shadow:8px 10px 23px #0002}.atlas-v31-book-detail>.atlas-v31-book-placeholder{height:300px}.atlas-v31-book-detail h2{font-family:var(--serif);font-size:clamp(2.2rem,5vw,3.7rem);margin:8px 0 4px;line-height:1.05}.atlas-v31-book-detail h3{font-family:var(--serif);font-size:1.8rem;margin:26px 0 10px}.atlas-v31-author{font-style:italic;color:#756a59}.atlas-v31-opinion{line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.atlas-v31-share-mission{margin:22px 0;padding:20px;border:1px solid #d3bea0;border-radius:16px;background:#f8f0df}.atlas-v31-share-mission .btn{margin:8px 12px 8px 0}.atlas-v31-share-status{font-size:.88rem;color:#496b4f}',
    '#atlas-v31-book-publisher{margin:24px 0 0;padding:20px;border:1px solid #d1bea3;border-radius:16px;background:#f9f1e5}#atlas-v31-book-publisher textarea{width:100%;min-height:110px;margin:10px 0 14px;padding:12px;border:1px solid #bcae95;border-radius:10px;font:inherit;background:#fff}#atlas-v31-book-publisher .actions{display:flex;flex-wrap:wrap;gap:10px}.atlas-v31-links{padding-top:22px;border-top:1px solid #d2c7b7;margin-top:22px}',
    '@keyframes atlas-v31-marquee{to{transform:translateX(calc(-50% - 11px))}}',
    '@media(max-width:650px){#atlas-v31-public-guide{padding:20px}.atlas-v31-slider-legend{display:none}.atlas-v31-book-detail{grid-template-columns:1fr}.atlas-v31-book-detail>img,.atlas-v31-book-detail>.atlas-v31-book-placeholder{width:150px;height:215px}.atlas-v31-book{width:165px;flex-basis:165px}.atlas-v31-book-cover{height:180px}.atlas-v31-guide-actions{gap:9px}.atlas-v31-guide-actions button{padding:10px 13px}}',
    '@media(prefers-reduced-motion:reduce){.atlas-v31-book-track.is-moving{animation:none}.atlas-v31-guide-actions button,.atlas-v31-book{transition:none}}'
  ].join('');
  document.head.appendChild(css);
  var starter=setInterval(function(){
    if(!db())return;
    if(!booted){booted=true;void readBooks();}
    if(founder()&&!booksLoaded)void readBooks();
    if(founder()&&linkedStories.length===0)void readLinkedStories();
  },1200);
  setTimeout(function(){clearInterval(starter);},30000);
  setInterval(function(){if(siteVisible())void readBooks();},45000);
  enhance();
})();