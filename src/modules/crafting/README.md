# Artisanat et projets du camp

## Objectif

Cette fondation fournit un contrat commun pour décrire les recettes d'artisanat d'Etheria, quel que soit le futur point d'accès (Discord, site ou application). Les définitions de recettes sont séparées du code qui les exploite.

## Règles de conception

- Une recette possède une clé stable, une liste d'ingrédients avec quantités et un résultat.
- Une recette peut déclarer une fonctionnalité déverrouillée, une compétence/niveau requis, une scène obligatoire et une récompense d'expérience explicite.
- Les quantités doivent être des entiers strictement positifs.
- Un même ingrédient ne doit pas être déclaré plusieurs fois dans une recette.
- Les objets sont référencés par leurs codes techniques, jamais par des noms affichés saisis librement.
- Le registre central est l'unique source de recettes canoniques ; les interfaces ne doivent pas inventer leurs propres recettes.
- Le moteur verrouille le personnage et le sac, vérifie le compte propriétaire, les prérequis et les stocks, puis consomme les ingrédients, ajoute le résultat et crédite éventuellement l'expérience dans une transaction PostgreSQL unique.
- Chaque fabrication est protégée par un UUID d'interaction unique pour éviter les doubles exécutions lors des répétitions Discord.
- Si le résultat est déjà présent dans le sac, sa pile est augmentée ; sinon un emplacement libéré ou libre est utilisé.

## Recettes canoniques du camp

Toutes les recettes ci-dessous sont fabriquées manuellement, sans outil, sans compétence requise, et uniquement depuis la scène `temporary_camp_established`.

| Recette | Ingrédients | Résultat |
| --- | --- | --- |
| Couchage d'herbe N1 | 12 `long_flexible_grass` + 4 `large_resistant_leaves` | 1 `grass_bedding_level_1` |
| Corde tissée N1 | 8 `braiding_plant_fibers` | 1 `woven_rope_level_1` |
| Barrière en bois fragile N1 | 10 `sturdy_wooden_branches` + 3 `woven_rope_level_1` | 1 `fragile_wooden_barrier_level_1` |

### Correspondance des ressources

- `braiding_plant_fibers` est le code déjà utilisé par la première séquence de survie pour les plantes souples collectées.
- `long_flexible_grass` correspond aux herbes longues et souples validées.
- `large_resistant_leaves` correspond aux grandes feuilles résistantes validées.
- `sturdy_wooden_branches` correspond aux branches de bois solides validées.
- Les trois derniers codes d'ingrédients sont des identifiants techniques de catalogue ; leur collecte dans le monde et leur présence initiale dans les inventaires ne sont pas encore implémentées.
- Les codes de résultat sont les identifiants techniques persistés des objets fabriqués.

Les quantités, les effets narratifs et les limites fonctionnelles de ces trois recettes ont été validés dans le canon du projet. Aucun outil, durée, poste de travail, niveau de compétence ou gain d'expérience supplémentaire n'est ajouté.

## Autres activités du camp

Les activités suivantes restent à définir avant toute intégration :
- pêche et chasse d'animaux sans conscience ;
- tannage des peaux ;
- équipements de niveau 2.

Aucun ingrédient, matériau, quantité, outil, durée, poste de travail ou condition de déblocage n'est inventé pour ces activités.

## État de l'exécution

Le moteur `craftItem` est implémenté et les trois premières recettes sont maintenant enregistrées dans le catalogue. Il vérifie le personnage actif, le sac porté, les ressources, la scène requise et l'idempotence, puis effectue la fabrication dans une transaction PostgreSQL unique.

L'interface Discord d'artisanat n'est pas encore raccordée. Les ressources `long_flexible_grass`, `large_resistant_leaves` et `sturdy_wooden_branches` doivent encore être intégrées aux mécanismes de collecte du monde avant que toutes les recettes soient accessibles en jeu. Le service générique de réception dans l'inventaire est préparé, mais aucun emplacement ni mécanisme de récolte n'est encore défini.

La migration `0016_crafting_events.sql` doit être examinée puis exécutée sur Supabase avant toute utilisation du moteur. Elle crée le journal idempotent des fabrications. Elle n'a pas été exécutée sur la base distante.

L'expérience n'est créditée que si une recette déclare explicitement une récompense. Le moteur n'invente aucun gain et ne modifie pas le niveau : les seuils de passage de niveau ne sont pas encore définis.
