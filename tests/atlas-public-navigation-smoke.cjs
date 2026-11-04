const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const journey=fs.readFileSync('assets/atlas-public-journey.js','utf8');
const sync=fs.readFileSync('assets/atlas-public-sync.js','utf8');

function extract(source,start,end) {
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,'Fonction manquante : '+start);
  return source.slice(a,b);
}

// Retour sur l'Atlas : reconstruire les cartes même si l'ancien marqueur
// data-journey était resté sur une section statique.
const section={dataset:{journey:'1'},cards:[]};
function card() {
  const classes=[];
  return {
    classes,innerHTML:'',
    classList:{add(x){classes.push(x);}},
    querySelector(selector){return this.innerHTML.includes('data-atlas-read=')?{}:null;}
  };
}
let notes=[{id:'ref-1',title:"C'est ici que tout commence",category:'Réflexion',body:'Bienvenue dans mon Atlas.'}];
const ctx={
  document:{querySelector(selector){return selector==='#public-carnets'?section:null;}},
  getNotes(){return notes;},
  esc(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
};
section.querySelectorAll=()=>section.cards;
vm.runInNewContext(extract(journey,'  function enhanceNotes() {','  function storyDetail(')+'\nthis.enhanceNotes=enhanceNotes;',ctx);
section.cards=[card()];
ctx.enhanceNotes();
assert(section.cards[0].innerHTML.includes('data-atlas-read="ref-1"'),'Le bouton Lire doit être présent après réhydratation');
assert(section.cards[0].classes.includes('atlas-journey-article-card'),'La carte de réflexion doit être interactive');

// Navigation Accueil -> Atlas : de nouveaux éléments HTML doivent être enrichis.
section.cards=[card()];
ctx.enhanceNotes();
assert(section.cards[0].innerHTML.includes('Lire la réflexion'),'La deuxième visite ne doit pas afficher la carte obsolète');

// Si le contenu public arrive après la page, une rubrique vide ne doit pas être considérée comme traitée.
section.cards=[card()];delete section.dataset.journey;notes=[];
ctx.enhanceNotes();
assert(!section.dataset.journey,'Ne jamais bloquer la future réhydratation d’un Carnet sans données');
notes=[{id:'ref-2',title:'Un nouveau chapitre',category:'Réflexion',body:'Test'}];
ctx.enhanceNotes();
assert(section.cards[0].innerHTML.includes('data-atlas-read="ref-2"'),'La réflexion doit s’ouvrir après le chargement différé');

// Vérifier que le passage public -> accueil -> public relance les missions.
let page=null,refreshes=0,enhancements=0;
const reentry={document:{querySelector(){return page;}},lastPublicPage:null,
  enhance(){enhancements++;},fetchStories(){refreshes++;}};
vm.runInNewContext(extract(journey,'  function publicPageReentered() {',"  document.addEventListener('click',")+
  '\nthis.publicPageReentered=publicPageReentered;',reentry);
page={};reentry.publicPageReentered();
assert.equal(refreshes,1,'Une ouverture relit les missions');
reentry.publicPageReentered();
assert.equal(refreshes,1,'Ne pas relire inutilement la même page');
page=null;reentry.publicPageReentered();
page={};reentry.publicPageReentered();
assert.equal(refreshes,2,'Revenir sur l’Atlas réactive les données après navigation');

// Les trois raccourcis du haut doivent viser des chapitres visibles.
const ids=['public-missions','atlas-v31-library','public-carnets'];
const destinations={};
for(const id of ['public-missions','public-lectures','public-carnets']){
  destinations[id]={getBoundingClientRect(){return {top:320};}};
}
let scroll=null,ensures=0;
const jumps={
  document:{getElementById(id){return destinations[id]||null;}},
  siteVisible(){return true;},
  window:{scrollY:120,dispatchEvent(){ensures++;},scrollTo(opts){scroll=opts;}},
  requestAnimationFrame(fn){fn();},Event:class Event{constructor(type){this.type=type;}}
};
vm.runInNewContext(extract(sync,'  function targetChapter(id) {','  function enhancePersonal()')+
  '\nthis.jumpToChapter=jumpToChapter;',jumps);
for(const id of ids){
  scroll=null;jumps.jumpToChapter(id);
  assert(scroll,'Le bouton '+id+' doit déplacer la page');
  assert.equal(scroll.top,350,'Le chapitre doit rester visible sous le bandeau');
}
assert.equal(ensures,3,'Les raccourcis réactivent les chapitres publics');
assert(journey.includes("window.addEventListener('hashchange'"),'La navigation doit être suivie');
assert(journey.includes("window.addEventListener('pageshow'"),'Le retour navigateur doit être suivi');
// Les anciens identifiants V14 cassaient les liens internes au retour sur l'accueil.
const source=fs.readFileSync('index.html','utf8');
assert(!source.includes("c.id='v14-missions'"),'Ne jamais renommer la section Mes Missions');
assert(!source.includes("c.id='v14-carnets'"),'Ne jamais renommer la section Mes réflexions');
assert(source.includes("if(label.includes('missions') && !c.id)c.id='public-missions'"),'Ancre de Mission stable requise');
assert(source.includes("if(label.includes('carnets') && !c.id)c.id='public-carnets'"),'Ancre de réflexion stable requise');
console.log('Navigation Atlas public : retours, boutons, missions et réflexions réactivés OK.');
