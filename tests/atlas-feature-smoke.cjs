const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync('assets/atlas-missions-comptes.js','utf8');
let path = 'mission/m1', oldRenders=0, newMissions=0, authPrompts=0, id=0, manager='';
const listeners = {root:{}, dialogs:{}};
const root = {
  innerHTML:'',
  addEventListener(type,fn) {(listeners.root[type] ||= []).push(fn);},
  querySelector(selector) {
    if(selector === '.folio-footer') return {insertAdjacentHTML(_position,html){manager=html;}};
    return null;
  }
};
const dialogs = {
  addEventListener(type,fn) {(listeners.dialogs[type] ||= []).push(fn);},
  querySelector(){return null;}
};
const ctx = {
  state:{missions:[{id:'m1',title:'Mission initiale',territory:'autonomie',mode:'guided',why:'',
    completedAt:null, steps:[
      {id:'s1',title:'Étape une',doneAt:'2026-11-01'},
      {id:'s2',title:'Étape deux',doneAt:null},
      {id:'s3',title:'Étape trois',doneAt:'2026-11-02'}
    ]}],
    notes:[{id:'n1',missionId:'m1',text:'Souvenir conservé'}],
    actions:[{id:'a1',missionId:'m1'}],
    checkins:[{id:'c1',missionId:'m1'}],
    history:[{id:'h1',missionId:'m1'}]
  },
  session:{id:'user-one'}, cloud:{},
  root, dialogs, document:{createElement(){return {textContent:''};},head:{appendChild() {}}},
  TERRITORIES:{autonomie:{name:'Autonomie'},corps:{name:'Corps'},esprit:{name:'Esprit'},savoir:{name:'Savoir-faire'}},
  route:()=>path,
  header:()=>'<header></header>',
  footer:()=>'<footer></footer>',
  h:x=>String(x), attr:x=>String(x),
  hasAtlasContent:s=>!!s.missions.length,loadLocal:()=>({missions:[]}),
  iso:()=>new Date('2026-11-04T10:00:00Z').toISOString(),
  uuid:()=>String(++id),
  render(){oldRenders++;},
  auth(){authPrompts++;},
  afterAuth:async()=>{},
  newStep(){},
  newMission(){newMissions++;},
  newBook(){},newNote(){},editCap(){},newAction(){},essayDraft(){},
  closeModal(){},modal(){},
  persist(next){ctx.state=next;},navigate(next){path=next;ctx.render();},
  notify(){},confirm:()=>true,structuredClone,console
};
vm.runInNewContext(script,ctx,{filename:'atlas-missions-comptes.js'});
assert(manager.includes('Organiser ma Mission'),'L’interface de gestion des missions manque.');
assert(manager.includes('Modifier la Mission'),'Le bouton de modification manque.');

function rootCommand(fields){
  const element = {dataset:fields};
  const e = {target:{closest(selector){return selector==='[data-atlas-mission]'?element:null;}},preventDefault(){},stopImmediatePropagation(){}};
  listeners.root.click[0](e);
}
function formSubmit(id,dataset,fields){
  const form={id,dataset,elements:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{value:v}]))};
  listeners.dialogs.submit[0]({target:form,preventDefault(){},stopImmediatePropagation(){}});
}

rootCommand({atlasMission:'up',mid:'m1',sid:'s3'});
assert.deepEqual(Array.from(ctx.state.missions[0].steps,x=>x.id),['s1','s3','s2']);
assert.equal(ctx.state.missions[0].steps[1].doneAt,'2026-11-02','Déplacer ne doit pas effacer une validation.');

formSubmit('atlas-v29-insert-form',{mid:'m1'},{title:'Nouvelle étape entre deux',position:'1'});
assert.equal(ctx.state.missions[0].steps[1].title,'Nouvelle étape entre deux');
assert.equal(ctx.state.missions[0].steps.length,4);

formSubmit('atlas-v29-mission-form',{mid:'m1'},{title:'Mission modifiée',territory:'corps',mode:'free',why:'Nouveau sens'});
assert.equal(ctx.state.missions[0].territory,'corps');
assert.equal(ctx.state.missions[0].mode,'free');
assert.equal(ctx.state.missions[0].steps[2].doneAt,'2026-11-02');

formSubmit('atlas-v29-step-form',{mid:'m1',sid:'s3'},{title:'Étape renommée'});
assert.equal(ctx.state.missions[0].steps.find(s=>s.id==='s3').title,'Étape renommée');
assert.equal(ctx.state.missions[0].steps.find(s=>s.id==='s3').doneAt,'2026-11-02');

rootCommand({atlasMission:'remove-step',mid:'m1',sid:'s2'});
assert.equal(ctx.state.missions[0].steps.some(s=>s.id==='s2'),false);
rootCommand({atlasMission:'remove-mission',mid:'m1'});
assert.equal(ctx.state.missions.length,0);
assert.equal(ctx.state.notes[0].missionId,null,'Le carnet doit être conservé.');
assert.equal(ctx.state.actions[0].missionId,null,'Les objectifs doivent être conservés.');
assert.equal(ctx.state.checkins.length,0);

ctx.session=null;path='atlas';ctx.render();
assert(root.innerHTML.includes('Crée ton compte'),'La page privée doit demander un compte.');
const create = {dataset:{action:'new-mission'}};
listeners.root.click[0]({target:{closest(s){return s==='[data-action]'?create:null;}},preventDefault(){},stopImmediatePropagation(){}});
assert.equal(newMissions,0,'Impossible de créer une mission sans compte.');
assert(authPrompts>0,'La connexion doit être proposée.');

path='public';const previous=oldRenders;ctx.render();
assert(oldRenders>previous,'Le site public doit rester visitable sans compte.');
console.log('Tests Atlas : édition, ordre, insertion, suppression, isolation du carnet, connexion et accès public validés.');
