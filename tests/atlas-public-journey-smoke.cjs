const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const js = fs.readFileSync('assets/atlas-public-journey.js','utf8');
assert(html.includes('<script src="assets/atlas-public-journey.js"></script>'),'Extension publique non chargée');
assert(html.includes('client:()=>cloud'),'L’extension doit réutiliser le client Supabase de l’Atlas');
assert(html.includes("body:20000"),'Les textes publics longs doivent être acceptés');
for (const feature of ['atlas_public_mission_stories','atlas_public_article_comments','atlas_public_article_likes','atlas_public_article_like_counts','atlas-journey-archive','atlas-journey-timeline','data-atlas-read','data-atlas-like','atlas-comment-form','data-atlas-moderate','data-atlas-edit-story','host.isAdmin()','is_published']) {
  assert(js.includes(feature),'Fonction Atlas absente : '+feature);
}
assert(js.includes('esc(c.body)'),'Les commentaires doivent être échappés avant affichage');
assert(js.includes('esc(n.body)'),'Les articles doivent être échappés avant affichage');
assert(!/service_role|sb_secret_/.test(js),'Ne jamais exposer une clé secrète');
console.log('Atlas public : missions dynamiques, archives, lecture intégrale, likes, modération et garde-fous OK.');
