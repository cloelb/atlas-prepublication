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
console.log('ATLAS : bibliothèque publiée, progression synchronisée, missions sur parchemin et confidentialité vérifiés.');