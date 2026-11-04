const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const from=html.indexOf('const defaultSite=');
const renderStart=html.indexOf('function showPublic()',from);
const renderEnd=html.indexOf('function editorFields()',renderStart);
assert(from>=0&&renderStart>from&&renderEnd>renderStart,'Les composants éditoriaux manquent.');

const root={innerHTML:''};
const ctx={
  root,session:null,
  window:{ATLAS_CONFIG:{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'publishable'}},
  header:()=>'<header></header>',footer:()=>'<footer></footer>',
  bottomNav:()=>'<nav></nav>',link:(path,text)=>'<a href="#/'+path+'">'+text+'</a>',
  prepareMotion:()=>{},console,localStorage:{setItem(){}}
};
vm.createContext(ctx);
vm.runInContext(html.slice(from,renderEnd),ctx,{filename:'atlas-public-page.js'});

const draft={
 siteTitle:"L'Atlas de Cloé",
 missions:[{id:'bien',title:'Mon projet',description:'Un essai'}],
 blocks:[{id:'missions',visible:true},{id:'carnets',visible:true},{id:'lectures',visible:true},{id:'story',visible:false},{id:'bookclub',visible:false}],
 publicNotes:[{id:'c1',title:'Ma réflexion',category:'Esprit',body:'Texte publié <script>alert(1)</script>',privateToken:'ne-jamais-rendre-public'}],
 publicBooks:[{id:'l1',title:'Un livre',author:'Une autrice',note:'Mon avis choisi'}],
 privateNotes:[{text:'CARNET STRICTEMENT PRIVE'}]
};
vm.runInContext('sitePublished=sanitizeSite('+JSON.stringify(draft)+');showPublic();',ctx);
assert(root.innerHTML.includes('Ma réflexion'),'La page de Carnet sélectionnée manque.');
assert(root.innerHTML.includes('Un livre'),'La rubrique Lectures sélectionnée manque.');
assert(root.innerHTML.includes('Mon avis choisi'),'Le commentaire publié manque.');
assert(root.innerHTML.includes('&lt;script&gt;'),'Les contenus publics doivent être échappés.');
assert(!root.innerHTML.includes('<script>alert(1)</script>'),'Une injection HTML est possible.');
assert(!root.innerHTML.includes('CARNET STRICTEMENT PRIVE'),'Une donnée privée est exposée.');
assert(!root.innerHTML.includes('ne-jamais-rendre-public'),'Un champ non autorisé a été publié.');
assert(root.innerHTML.includes('Créer mon Atlas personnel'),'Le parcours visiteur vers le compte manque.');

vm.runInContext('sitePublished=sanitizeSite({blocks:[{id:"missions",visible:true}],publicNotes:[],publicBooks:[]});showPublic();',ctx);
assert(!root.innerHTML.includes('CARNET STRICTEMENT PRIVE'),'Aucune note privée ne doit apparaître automatiquement.');
assert(!root.innerHTML.includes('Mon histoire</span>'),'Le récit fondateur est masqué tant que non sélectionné.');
assert(!root.innerHTML.includes('Mes lectures</span>'),'Les nouvelles rubriques ne doivent pas être rendues publiques sans validation.');

assert(html.includes('data-atlas-public-import'),'Le choix explicite des publications manque.');
assert(html.includes("confirm('Copier cet élément personnel"),'La confirmation explicite manque.');
assert(html.includes("if(!session||!isAdmin)"),'L’Atelier doit rester protégé.');
assert(html.includes("cloud.rpc('atlas_publish_site'"),'La publication doit passer par le contrôle administrateur Supabase.');
console.log('Publication Atlas : visibilité choisie, Carnets, lectures, échappement HTML, confidentialité et création de compte OK.');
