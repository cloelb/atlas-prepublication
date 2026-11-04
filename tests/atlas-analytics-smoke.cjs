const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const js = fs.readFileSync('assets/atlas-analytics.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert(html.includes('<script src="assets/atlas-analytics.js"></script>'), 'La mesure facultative doit être chargée.');
assert(html.includes('noindex,nofollow'), 'Le site reste en prépublication.');
assert(!/service_role|sb_secret_/.test(js), 'Aucune clé secrète dans le navigateur.');

const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
const requests = [];
const events = {};
const client = {
  from(table) {
    assert.equal(table, 'atlas_retention_events');
    return { insert(payload) {
      requests.push(payload);
      return Promise.resolve({error:null});
    } };
  }
};
const root = {
  innerHTML:'',
  querySelector(selector) {
    if (selector === '.atlas-week-intro') return {
      insertAdjacentHTML(_where, markup) { root.innerHTML += markup; }
    };
    if (selector === '#atlas-analytics-consent')
      return root.innerHTML.includes('id="atlas-analytics-consent"') ? {} : null;
    return null;
  },
  addEventListener(name, callback) { events[name] = callback; }
};
let index = 0;
const ctx = {
  state:{missions:[],checkins:[]},
  cloud:client,
  root,
  route:()=> 'semaine',
  render() { root.innerHTML=''; },
  persist(next) { ctx.state=next; ctx.render(); },
  document:{head:{appendChild(){}},createElement(){return {textContent:''};}},
  window:{
    localStorage,
    crypto:{randomUUID() {
      index++;
      return '12345678-1234-4123-8123-'+String(index).padStart(12,'0');
    }},
    location:{search:'?utm_source=instagram',hash:'#/semaine'}
  },
  URLSearchParams, Promise, Date, console
};
vm.runInNewContext(js,ctx,{filename:'atlas-analytics.js'});
assert(root.innerHTML.includes('Oui, participer'), 'Le consentement explicite doit être proposé.');
assert.equal(requests.length,0, 'Aucun événement avant consentement, même avec UTM Instagram.');
function select(action) {
  events.click({
    target:{closest(selector) {
      return selector==='[data-atlas-analytics]' ? {dataset:{atlasAnalytics:action}} : null;
    }},
    preventDefault(){},stopImmediatePropagation(){}
  });
}
select('disable');
assert.equal(requests.length,0,'Le refus interdit tout événement.');
assert(root.innerHTML.includes('Mesure désactivée'), 'Le refus reste visible.');
select('enable');
assert.equal(requests.filter(x=>x.event_type==='campaign_visit').length,1,'Visite Instagram consentie.');
assert.equal(requests.filter(x=>x.event_type==='visit').length,1,'Visite consentie.');
assert(!requests.some(x=>x.title||x.body||x.email||x.notes),'Aucune donnée privée ne part.');
const mission = {id:'mission-privee',title:'Une mission qui reste privée',
  createdAt:'2026-11-04T12:00:00Z',steps:[{id:'step-privee',doneAt:null}]};
ctx.persist({missions:[mission],checkins:[]});
const first = requests.filter(x=>x.event_type==='first_mission');
assert.equal(first.length,1,'La cohorte commence avec la première mission.');
assert.equal(first[0].first_mission_on,'2026-11-04');
assert(!JSON.stringify(requests).includes(mission.title),'Aucun titre de mission ne doit sortir.');
ctx.persist({missions:[{...mission,steps:[{id:'step-privee',doneAt:'2026-11-04T13:00:00Z'}]}],checkins:[]});
assert.equal(requests.filter(x=>x.event_type==='step_completed').length,1);
ctx.persist({missions:[mission],checkins:[{id:'bilan-prive',kind:'weekly',accomplished:'Une phrase strictement privée'}]});
assert.equal(requests.filter(x=>x.event_type==='weekly_review').length,1);
assert(!JSON.stringify(requests).includes('Une phrase strictement privée'));
ctx.render();
assert.equal(requests.filter(x=>x.event_type==='visit').length,1,'Une visite maximum par jour et navigateur.');
select('disable');
const before = requests.length;
ctx.persist({missions:[mission],checkins:[]});
assert.equal(requests.length,before,'Plus aucune mesure après désactivation.');
assert.equal(localStorage.getItem('atlas-analytics-visitor-v1'),null,'Identifiant local retiré.');
assert.equal(ctx.window.ATLAS_ANALYTICS.retentionWindow('2026-11-04','2026-11-11'),true);
assert.equal(ctx.window.ATLAS_ANALYTICS.retentionWindow('2026-11-04','2026-11-17'),true);
assert.equal(ctx.window.ATLAS_ANALYTICS.retentionWindow('2026-11-04','2026-11-18'),false);
assert.equal(ctx.window.ATLAS_ANALYTICS.retentionWindow('2026-11-04','2026-11-10'),false);
console.log('Statistiques ATLAS : consentement, refus, confidentialité, cohorte mission, J+7, Instagram et révocation OK.');
