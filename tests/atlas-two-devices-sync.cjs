const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Tester la vraie classe de synchronisation du site avec deux clients
// simulant deux téléphones connectés au même compte.
const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('class AtlasCloud {');
const end = html.indexOf('const root=document.querySelector',start);
assert(start>=0 && end>start,'La classe AtlasCloud doit être disponible.');
const sandbox = {
  Promise,Date,JSON,Error,console,
  validState(value) { return JSON.parse(JSON.stringify(value)); }
};
vm.runInNewContext(html.slice(start,end)+'\nthis.AtlasCloud=AtlasCloud;',sandbox);
const AtlasCloud = sandbox.AtlasCloud;

const backend = new Map();
const clone = x => JSON.parse(JSON.stringify(x));
function phone(user) {
  return {
    auth:{
      async getUser(){return {data:{user:{id:user}}};},
      async signInWithPassword(){return {error:null};},
      async signUp(){return {data:{session:null,user:{id:user}},error:null};},
      async signOut(){return {error:null};}
    },
    from(name){
      assert.equal(name,'atlas_v5_state');
      return {select(fields){
        assert.equal(fields,'payload,revision');
        return {eq(field,id){
          assert.equal(field,'user_id');
          assert.equal(id,user,'La sauvegarde ne doit jamais lire un autre compte.');
          return {async maybeSingle(){
            const data=backend.get(id);
            return {data:data?clone(data):null,error:null};
          }};
        }};
      }};
    },
    async rpc(name, input) {
      assert.equal(name,'atlas_v5_save');
      const old=backend.get(user);
      const currentRev=old?old.revision:0;
      if(currentRev!==input.expected_revision)return {data:null,error:null};
      const revision=currentRev+1;
      backend.set(user,{payload:clone(input.new_payload),revision});
      return {data:revision,error:null};
    }
  };
}
async function main(){
  const identity='11111111-1111-4111-8111-111111111111';
  const a = new AtlasCloud(phone(identity));
  const b = new AtlasCloud(phone(identity));
  const c = new AtlasCloud(phone('22222222-2222-4222-8222-222222222222'));
  await Promise.all([a.session(),b.session(),c.session()]);
  assert.equal(await a.load(),null,'Le compte démarre vierge sur le téléphone A.');
  assert.equal(await b.load(),null,'Le compte démarre vierge sur le téléphone B.');
  const mission={schema:6,missions:[{id:'mission-A',title:'Essai personnel',steps:[{id:'etape-A',doneAt:null}]}],checkins:[]};
  await a.save(mission);
  assert.equal(a.rev,1,'La première sauvegarde arrive sur Supabase.');
  await assert.rejects(
    () => b.save({schema:6,missions:[{id:'mission-B'}],checkins:[]}),
    /Conflit de sauvegarde/,
    'Une deuxième version obsolète ne doit pas écraser la première.'
  );
  assert.equal(backend.get(identity).payload.missions[0].id,'mission-A');
  const recovered=await b.load();
  assert.equal(recovered.missions[0].id,'mission-A','Le second appareil récupère la mission.');
  recovered.missions[0].steps[0].doneAt='2026-11-04T11:00:00Z';
  recovered.checkins.push({id:'review-A',kind:'weekly',accomplished:'Test discret'});
  await b.save(recovered);
  assert.equal(b.rev,2);
  const fresh=await a.load();
  assert.equal(fresh.missions[0].steps[0].doneAt,'2026-11-04T11:00:00Z');
  assert.equal(fresh.checkins[0].kind,'weekly','Le bilan est récupéré sur l’autre appareil.');
  assert.equal(await c.load(),null,'Un autre compte ne récupère aucune donnée personnelle.');
  await a.signOut();
  assert.equal(a.user,null,'Le premier téléphone peut se déconnecter.');
  assert.equal(backend.get(identity).revision,2,'La déconnexion ne détruit pas le cloud.');
  console.log('Synchronisation simulée : deux appareils, sauvegarde, conflit, récupération, bilan, isolation et déconnexion OK.');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
