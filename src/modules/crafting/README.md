# Artisanat et projets du camp

## Objectif

Cette fondation fournit un contrat commun pour décrire les recettes d'artisanat d'Etheria, quel que soit le futur point d'accès (Discord, site ou application). Les définitions de recettes sont séparées du code qui les exploite.

## Règles de conception

- Une recette possède une clé stable, une liste d'ingrédients avec quantités et un résultat.
- Une recette peut déclarer une fonctionnalité déverrouillée et une compétence/niveau requis.
- Les quantités doivent être des entiers strictement positifs.
- Un même ingrédient ne doit pas être déclaré plusieurs fois dans une recette.
- Les objets sont référencés par leurs codes techniques, jamais par des noms affichés saisis librement.
- Le registre central est l'unique source de recettes canoniques ; les interfaces ne doivent pas inventer leurs propres recettes.
- La validation structurelle ne remplace pas les contrôles transactionnels d'inventaire, de capacité, de présence au lieu requis et de progression lors de l'exécution.

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

## Intégration ultérieure

Avant de rendre une recette exécutable, il faudra :
1. valider canoniquement ses ingrédients, quantités, résultat et conditions ;
2. relier les codes d'objets au catalogue général et aux emplacements de stockage ;
3. implémenter une exécution transactionnelle qui verrouille le personnage et son inventaire ;
4. vérifier les ingrédients, les compétences, les fonctionnalités déverrouillées et le lieu requis ;
5. consommer les ingrédients et créer le résultat dans une seule transaction ;
6. enregistrer l'action de façon idempotente et accorder la progression selon les règles générales d'Etheria.

Aucune migration SQL n'est nécessaire pour ce contrat de données initial.
