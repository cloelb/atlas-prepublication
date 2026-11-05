const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');

assert(html.includes('href="#/semaine?objectifs"'), 'Le lien Objectifs doit pointer vers Ma semaine.');
assert(!html.includes('href="#/aujourdhui"'), 'Ne plus proposer de page Objectifs séparée.');
assert(html.includes('>Objectifs</a><a href="#/missions"'), 'Le menu doit dire Objectifs.');
assert(html.includes("['semaine?objectifs','☼','Objectifs']"), 'La navigation mobile doit viser les cartes colorées.');
assert(!html.includes('>Aujourd’hui</a><a href="#/missions"'), 'Le titre du menu Aujourd’hui doit disparaître.');
assert(html.includes("function todayPage(){"), 'Le contenu de la page doit rester inchangé.');
assert(html.includes('try{await cloudStore.queue;}catch(_){}'),
  'Une ancienne erreur de sauvegarde ne doit pas empêcher le contrôle serveur.');
assert(html.includes("if(cloudConflict && window.__atlas_remote_pending)chooseAtlasVersion();"),
  'La comparaison ne doit s’ouvrir que si deux vraies copies existent.');
assert(html.includes("const conflict=cloudConflict && window.__atlas_remote_pending?"),
  'Ne pas afficher le choix de la version en ligne si aucun fichier distant n’a été récupéré.');
assert(html.includes('data-action="export"'),
  'Conserver l’export de sauvegarde locale.');
assert(html.includes("if(!confirm('La version locale sera remplacée"),
  'Ne jamais remplacer un Atlas sans confirmation.');

function getFn(source, start, end, expose) {
  const begin = source.indexOf(start);
  const finish = source.indexOf(end, begin + start.length);
  assert(begin >= 0 && finish > begin, 'Fonction attendue : ' + start);
  const ctx = {window:{},JSON, Object, Array};
  vm.runInNewContext(source.slice(begin,finish)+'\nthis.result='+expose+';',ctx);
  return ctx.result;
}
const same = getFn(html,'function sameAtlasContent(', 'async function reconcileCloud(', 'sameAtlasContent');
const original = {schema:6,missions:[{id:'m1',title:'Mission privée',steps:[{id:'e1',doneAt:null}]}],checkins:[],updatedAt:'2026-11-04T10:00:00Z'};
const timestampOnly = {checkins:[],missions:[{steps:[{doneAt:null,id:'e1'}],title:'Mission privée',id:'m1'}],updatedAt:'2026-11-04T18:00:00Z',schema:6};
assert.equal(same(original,timestampOnly),true, 'Une différence de date seule ne doit pas provoquer de faux conflit.');
const realDifference = {...timestampOnly,missions:[{...timestampOnly.missions[0],steps:[{id:'e1',doneAt:'2026-11-04T18:20:00Z'}]}]};
assert.equal(same(original,realDifference),false, 'Une étape validée sur un autre appareil est un vrai conflit.');
assert.equal(same(original,{...timestampOnly,checkins:[{id:'private-review'}]}),false,
  'Un nouveau bilan ne doit pas être silencieusement ignoré.');

const first = html.indexOf('function cloudStatus(){');
const last = html.indexOf('// Récupérer une Mission',first);
assert(first>=0&&last>first);
function cloudMessage(conflict,pending,lastError) {
  const context = {
    cloud:{},
    session:{id:'account'},
    cloudStore:{ready:true,lastError:lastError||null,hasRemote:true},
    cloudConflict:conflict,
    window:{__atlas_remote_pending:pending||null}
  };
  vm.runInNewContext(html.slice(first,last)+'\nthis.message=cloudStatus();',context);
  return context.message;
}
assert.match(cloudMessage(true,{missions:[]},null),/Deux versions différentes/);
assert.match(cloudMessage(true,null,null),/Sauvegarde en ligne non confirmée/);
assert.match(cloudMessage(false,null,Error('offline')),/Sauvegarde en ligne non confirmée/);
assert.match(cloudMessage(false,null,null),/dernière sauvegarde cloud confirmée/);
console.log('Navigation Objectifs, alerte de synchronisation et protection des deux versions : OK.');
