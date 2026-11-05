# ATLAS — mesure facultative J+7 (prépublication)

## Déploiement et protection
La migration Supabase `atlas_retention_j7_optin_events` crée `public.atlas_retention_events` avec RLS active. Les rôles `anon` et `authenticated` ont **uniquement** le droit d'insérer les colonnes autorisées. Ils n'ont aucun droit SELECT, UPDATE ou DELETE. La clé secrète Supabase ne doit jamais être utilisée dans le site.

Le navigateur n'envoie des événements qu'après le clic « Oui, participer » depuis « Ma semaine ». Il génère un identifiant UUID aléatoire local. En cas de refus, aucune donnée statistique n'est envoyée. La désactivation supprime l'identifiant local et interrompt les nouveaux envois ; elle ne supprime pas rétroactivement les événements déjà transmis.

Événements autorisés :
- `campaign_visit` : arrivée avec `utm_source=instagram`, uniquement après consentement.
- `visit` : visite consentie, au plus une fois par jour UTC et navigateur.
- `first_mission` : première Mission du navigateur consentant, avec **date seulement**, sans titre.
- `step_completed` : une étape au moins accomplie ce jour-là, sans identifiant d'étape.
- `weekly_review` : premier bilan hebdomadaire, sans réponse ni contenu.

Les paramètres UTM bruts, pages de carnet, titres de Missions, emails et réponses aux bilans ne sont **jamais** collectés dans cette table.

**Limite :** l'identifiant désigne un navigateur, pas un individu unique. Les personnes passant du mode invité au compte sur deux appareils ne sont donc pas dédupliquées dans ces statistiques. Pour éviter un biais supplémentaire, ne compter que les participants consentants. Les insertions depuis l'API publique peuvent être simulées : ces chiffres sont indicatifs, pas une preuve d'identité.

## Calcul de J+7

Convention retenue : une personne consentante est considérée comme « revenue à J+7 » si une visite est observée entre le **7e et le 13e jour inclus** après sa toute première Mission. Une cohorte n'est affichée qu'une fois J+13 terminé, soit à partir de J+14 (données complètes).

À exécuter **dans l'éditeur SQL Supabase**, jamais dans le navigateur :

```sql
with premiere_mission as (
  select visitor_id, min(first_mission_on) as jour_initial
  from public.atlas_retention_events
  where event_type = 'first_mission'
  group by visitor_id
),
retours as (
  select p.visitor_id
  from premiere_mission p
  where exists (
    select 1 from public.atlas_retention_events e
    where e.visitor_id = p.visitor_id
      and e.event_type = 'visit'
      and e.occurred_on between p.jour_initial + 7 and p.jour_initial + 13
  )
)
select
  p.jour_initial as cohorte,
  count(*) as premieres_missions_consenties,
  count(r.visitor_id) as revenus_j7_j13,
  round(100.0 * count(r.visitor_id) / nullif(count(*), 0), 1) as retour_pourcent
from premiere_mission p
left join retours r on r.visitor_id = p.visitor_id
where p.jour_initial <= (current_date - 14)
group by p.jour_initial
order by p.jour_initial desc;
```

Une absence de ligne ne signifie pas un échec : il faut attendre qu'une cohorte ait terminé son observation.

## Instagram

Lien à placer dans la biographie ou un Reel :
`https://cloelb.github.io/atlas-prepublication/?utm_source=instagram#/semaine`

Le fragment `#/semaine` pointe directement sur « Ma semaine ». Seule l'étiquette `instagram` peut être conservée dans la table de mesures **après consentement**. Aucune donnée n'est transmise à Instagram par la fonction statistique d'ATLAS.

La rubrique publique choisit chaque semaine une mission **déjà publiée explicitement**, dotée d'étapes qui figurent déjà dans la base publique. Les créations personnelles ne sont jamais publiées automatiquement.

## Vérification réelle — à compléter avant la sortie de prépublication

1. iPhone réel, données mobiles : ouvrir le lien Instagram, refuser la mesure, créer une mission rapide, cocher une étape, produire un bilan, actualiser.
2. Compte de test : vérifier inscription et confirmation e-mail, connexion, déconnexion et réinitialisation du mot de passe.
3. Import invité : depuis « Mon compte », choisir **explicitement** la récupération et vérifier qu'aucune autre version n'est écrasée automatiquement.
4. Android réel, données mobiles : se connecter **au même compte de test**, récupérer la sauvegarde, vérifier étape et bilan.
5. Modifier la mission sur Android puis revenir sur iPhone : contrôler la résolution du conflit avant toute fusion (exporter les deux versions).
6. Revenir à J+7 et contrôler que les compteurs SQL correspondent aux événements consentis.
7. Vérifier les liens en biographie et en Reel sur l'application Instagram, recueillir les retours de quelques testeurs.
8. Dans Supabase Auth, activer « Leaked password protection » si l'offre le permet et revérifier Security Advisor.

**Garde-fou :** conserver `noindex,nofollow,noarchive` tant que ces vérifications réelles ne sont pas terminées.

### Effacement / durée de conservation (active depuis le 5 novembre 2026)
Les événements de mesure facultative sont conservés **au maximum 90 jours après leur enregistrement**, puis supprimés automatiquement par Supabase. La migration `atlas_retention_90d_purge` (20261105071000) active le job `atlas-retention-events-90d` : chaque jour à **03 h 15 UTC**, il exécute uniquement :

```sql
delete from public.atlas_retention_events
where created_at < now() - interval '90 days';
```

Aucun autre tableau (missions, carnets, sauvegardes personnelles, comptes) n'est concerné. Cette durée permet de terminer les cohortes J+7 à J+13, tout en réduisant l'historique conservé. Les statistiques des cohortes de plus de 90 jours ne sont plus disponibles sans agrégation préalable.

**Vérification côté Supabase :** dans SQL Editor, exécuter
```sql
select jobname, active, schedule, command
from cron.job where jobname = 'atlas-retention-events-90d';
```
Le résultat attendu est `active = true`, `15 3 * * *` et une suppression limitée à `atlas_retention_events`. Dans Integrations → Cron, l'historique permet de contrôler la première exécution programmée.

La suppression de l'identifiant dans le navigateur arrête la mesure future mais **ne supprime pas immédiatement les événements déjà transmis**. Ces événements sont purgés à l'échéance des 90 jours. Ne pas présenter la révocation du consentement comme une suppression immédiate de l'historique.
