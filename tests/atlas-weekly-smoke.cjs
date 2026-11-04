const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('assets/atlas-weekly.js', 'utf8');
const listeners = {root:{}, dialogs:{}};
const root = {
  innerHTML:'',
  addEventListener(type, fn) { (listeners.root[type] ||= []).push(fn); },
  querySelector() { return null; }
};
const dialogs = {
  innerHTML:'',
  addEventListener(type, fn) { (listeners.dialogs[type] ||= []).push(fn); }
};
let path = 'semaine', warnings = [], previousMissions = 0, previousRenders = 0, sequence = 0;
const state = {schema:6, cap:'', missions:[], actions:[], notes:[], checkins:[], history:[]};
const ctx = {
  root, dialogs, document:{createElement(){return {textContent:''};},head:{appendChild(){}}},
  window:{}, state, session:null, structuredClone,
  route:()=>path,
  render(){previousRenders++;},
  pageFrame(_page, html){root.innerHTML=html;},
  newMission(){previousMissions++;}, newStep(){}, newNote(){},
  settings(){}, notify(msg){warnings.push(msg);}, closeModal(){dialogs.innerHTML='';},
  modal(_title,_kicker,content){dialogs.innerHTML=content;},
  cloudStatus:()=> 'Sauvegarde locale',
  h:v=>String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
  attr:v=>String(v||''),
  progress:m=>({done:m.steps.filter(s=>s.doneAt).length,total:m.steps.length,
    percent:m.steps.length?Math.round(m.steps.filter(s=>s.doneAt).length/m.steps.length*100):0}),
  nextStep:m=>m.steps.find(s=>!s.doneAt),
  createMission(s, data) {
    const copy=structuredClone(s);
    const mission={id:'m'+(++sequence),title:data.title,mode:data.mode,territory:data.territory,
      steps:data.steps.map((title)=>({id:'s'+(++sequence),title,doneAt:null})),completedAt:null};
    copy.missions.unshift(mission);return {state:copy,mission};
  },
  setStep(s,mid,sid,done) {
    const copy=structuredClone(s), m=copy.missions.find(m=>m.id===mid);
    m.steps.find(st=>st.id===sid).doneAt=done?'2026-11-04T11:00:00Z':null;
    return copy;
  },
  addCheckin(s,data) {
    const copy=structuredClone(s);
    copy.checkins.unshift({id:'c'+(++sequence),missionId:data.missionId,date:'2026-11-04T12:00:00Z',
      nextAction:data.nextAction,difficulty:data.difficulty,feeling:data.feeling});
    return copy;
  },
  iso:()=> '2026-11-04T12:00:00Z',
  persist(next){ctx.state=next;ctx.render();},
  navigate(next){path=next;ctx.render();},
  console
};
vm.runInNewContext(script, ctx, {filename:'atlas-weekly.js'});
assert(root.innerHTML.includes('Un pas après l’autre'), 'La page Ma semaine doit être accessible.');
assert(root.innerHTML.includes('Essai sur cet appareil'), 'Le mode invité doit être annoncé.');
assert(root.innerHTML.includes('première Mission'), 'Un visiteur doit pouvoir commencer.');
assert.equal(ctx.window.ATLAS_WEEKLY.mondayKey(new Date('2026-11-04T12:00:00Z')), '2026-11-02');

function click(fields) {
  const el={dataset:fields};
  const e={target:{closest(selector){return selector==='[data-atlas-week]'?el:null;}},
    preventDefault(){},stopImmediatePropagation(){}};
  listeners.root.click[0](e);
}
function submit(id, fields, dataset={}) {
  const form={id,dataset,elements:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{value:v}]))};
  listeners.dialogs.submit[0]({target:form,preventDefault(){},stopImmediatePropagation(){}});
}
click({atlasWeek:'quick'});
assert(dialogs.innerHTML.includes('atlas-week-quick-form'), 'Le formulaire de création rapide doit s’ouvrir.');
assert(!dialogs.innerHTML.includes('name="territory"'), 'Le Territoire ne doit pas être obligatoire au départ.');
submit('atlas-week-quick-form',{title:'Apprendre trois recettes',step:'Choisir ma première recette'});
assert.equal(ctx.state.missions.length,1,'La Mission est conservée.');
assert.equal(ctx.state.missions[0].steps.length,1,'Le premier petit pas est conservé.');
assert.equal(ctx.state.weeklyFocus.missionId,ctx.state.missions[0].id,'La Mission est choisie pour cette semaine.');
assert(root.innerHTML.includes('Apprendre trois recettes'),'La Mission apparaît dans Ma semaine.');

const mission=ctx.state.missions[0],step=mission.steps[0];
click({atlasWeek:'complete',mid:mission.id,sid:step.id});
assert(ctx.state.missions[0].steps[0].doneAt,'La validation est enregistrée.');
click({atlasWeek:'review',mid:mission.id});
assert(dialogs.innerHTML.includes('Qu’ai-je accompli ?'),'Le bilan doit contenir trois questions.');
assert(dialogs.innerHTML.includes('Qu’ai-je appris ?'));
assert(dialogs.innerHTML.includes('Quel sera mon prochain pas ?'));
submit('atlas-week-review-form',{accomplished:'J’ai testé une recette',learned:'J’ai appris à doser',next:'Cuisiner jeudi'},{mid:mission.id});
assert.equal(ctx.state.checkins.length,1,'Le bilan doit être conservé.');
assert.equal(ctx.state.checkins[0].kind,'weekly');
assert.equal(ctx.state.checkins[0].accomplished,'J’ai testé une recette');
assert.equal(ctx.state.checkins[0].learned,'J’ai appris à doser');
assert(root.innerHTML.includes('Bilan de cette semaine conservé'),'Le bilan doit être visible.');

click({atlasWeek:'review',mid:mission.id});
submit('atlas-week-review-form',{accomplished:'J’ai testé deux recettes',learned:'Je progresse',next:'Continuer'},{mid:mission.id});
assert.equal(ctx.state.checkins.length,1,'Modifier un bilan ne crée pas de doublon.');
assert.equal(ctx.state.checkins[0].accomplished,'J’ai testé deux recettes');
assert.equal(previousMissions,0,'Le parcours classique ne doit pas être modifié à son insu.');
console.log('Ma semaine : essai invité, mission rapide, progression, bilan et mise à jour validés.');
