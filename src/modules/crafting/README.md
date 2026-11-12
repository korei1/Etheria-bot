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

## État du catalogue

Le registre CRAFTING_RECIPES est volontairement vide.

Les activités suivantes ont été retenues comme pistes de développement du camp, mais leurs recettes ne sont pas encore définies :
- couchage d'herbe ;
- corde tissée de niveau 1 ;
- barrière en bois fragile de niveau 1 ;
- activités de pêche et de chasse d'animaux sans conscience ;
- tannage des peaux ;
- équipements de niveau 2.

Aucun ingrédient, matériau, quantité, outil, durée, poste de travail ou condition de déblocage n'est ajouté par cette fondation.

## État de l'exécution

Le moteur `craftItem` est implémenté, mais aucune recette n'est encore enregistrée dans le catalogue. Il ne peut donc pas encore être appelé pour fabriquer un objet concret.

La migration `0016_crafting_events.sql` doit être examinée puis exécutée sur Supabase avant toute utilisation du moteur. Elle crée le journal idempotent des fabrications. Elle n'a pas été exécutée sur la base distante.

L'expérience n'est créditée que si une recette déclare explicitement une récompense. Le moteur n'invente aucun gain et ne modifie pas le niveau : les seuils de passage de niveau ne sont pas encore définis.
