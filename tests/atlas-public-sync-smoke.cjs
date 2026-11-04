const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const journey = fs.readFileSync('assets/atlas-public-journey.js','utf8');
const sync = fs.readFileSync('assets/atlas-public-sync.js','utf8');
assert(html.includes('<script src="assets/atlas-public-journey.js"></script>'),'Le site doit charger les missions publiques');
assert(journey.includes("syncScript.src = 'assets/atlas-public-sync.js'"),'Le module de synchronisation doit être chargé');
for(const token of [
  'atlas-parchment-map','atlas-parchment-stop','atlas-parchment-finale',
  'atlas-journey-article-card','atlas-shared-updated'
]) assert(journey.includes(token),'Parcours ou article absent : '+token);
for(const token of [
  'atlas_public_books','atlas_public_mission_stories','storyFromPersonal',
  'privateState','bookmarks','persist(next)','is_published','safeCover',
  'atlas-v31-book-track','atlas-v31-book-window','atlas-v31-personal-opinion',
  'atlas-v31-public-guide','data-atlas-share-book','data-atlas-share-mission',
  'atlas-v31-book-overlay','prefers-reduced-motion'
]) assert(sync.includes(token),'Partage Atlas absent : '+token);
assert(sync.includes("if (!founder()"),'Les écritures publiques sont réservées à la fondatrice');
assert(sync.includes("memories:Array.isArray(old.memories)?old.memories:[]"),'Les souvenirs privés ne doivent pas être copiés automatiquement');
assert(sync.includes('person.bookmarks'),"Le livre d'origine doit rester dans la bibliothèque privée");
assert(!/bookmarks\s*=\s*bookmarks\.filter/.test(sync),'La publication ne doit pas retirer le livre personnel');
assert(!/service_role|sb_secret_/.test(sync),'Aucune clé serveur ne doit être exposée');

const vm=require('node:vm');
const helperStart=sync.indexOf('  function foldedMissionTitle(');
const helperEnd=sync.indexOf('  function storyFromPersonal(',helperStart);
assert(helperStart>0&&helperEnd>helperStart,'La correspondance des Missions doit être disponible');
const suggest=vm.runInNewContext(sync.slice(helperStart,helperEnd)+'\nsuggestedMissionTarget;');
const publicRows=[
  {id:'bien',title:'Premier Bien Immobilier',territory:'Autonomie',linked_private_id:null},
  {id:'corps',title:'1 an pour apprendre la calisthénie',territory:'Corps',linked_private_id:null},
  {id:'other',title:'Apprendre le piano',territory:'Esprit',linked_private_id:null}
];
assert.equal(suggest({title:'Mon premier bien immo'},publicRows).id,'bien','Le bien immobilier doit se relier à la Mission publique existante');
assert.equal(suggest({title:'Apprendre la Callisthénie en 1 an'},publicRows).id,'corps','La callisthénie doit se relier à la Mission Corps');
assert.equal(suggest({title:'calsithenies'},publicRows).id,'corps','Une faute fréquente de calisthénie ne doit pas créer un doublon');
assert.equal(suggest({title:'Apprendre le piano'},publicRows).id,'other','Le titre exact doit être prioritaire');
assert.equal(suggest({title:'Voyage à Lisbonne'},publicRows),null,'Une Mission sans équivalent ne doit pas être liée arbitrairement');
assert.equal(suggest({title:'Apprendre la Callisthénie en 1 an'},publicRows.map(x=>x.id==='corps'?{...x,linked_private_id:'un-autre-compte'}:x)),null,
  'Ne jamais prendre une Mission déjà reliée à une autre Mission privée');
assert(sync.includes("var response=await db().from('atlas_public_mission_stories').select('*')"),'Relire les liaisons avant de publier');
assert(sync.includes("if(!prior && !target) prior=suggestedMissionTarget(m,linkedStories)"),'Éviter le doublon si la liste n’a pas encore chargé');
const storyStart=sync.indexOf('  function storyFromPersonal(');
const storyEnd=sync.indexOf('  function siteVisible()',storyStart);
const storyFromPersonal=vm.runInNewContext(sync.slice(storyStart,storyEnd)+'\nstoryFromPersonal;',{
  clean:(v,n)=>String(v||'').trim().slice(0,n),storyId:(id)=>'personal-'+id,
  mapTerritory:{autonomie:'Autonomie',corps:'Corps',esprit:'Esprit',savoir:'Savoir-faire'}
});
const published=storyFromPersonal({id:'private-calis',title:'Apprendre la Callisthénie en 1 an',
  territory:'autonomie',why:'',steps:[{id:'s1',title:'Premier entraînement',doneAt:null}]},
  {id:'corps',territory:'Corps',position:1,steps:[],memories:[],status:'en_cours'});
assert.equal(published.id,'corps','Réutiliser la Mission publique au lieu de créer un autre identifiant');
assert.equal(published.territory,'Corps','Préserver le territoire éditorial Corps même si la Mission personnelle est mal classée');
assert.equal(published.steps.length,1,'Les étapes personnelles choisies doivent accompagner la Mission publiée');

console.log('ATLAS : bibliothèque publiée, progression synchronisée, missions sur parchemin et confidentialité vérifiés.');