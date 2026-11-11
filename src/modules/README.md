# Modules Etheria

Chaque domaine du jeu possède son propre dossier. Un module ne doit pas accéder directement aux détails internes d'un autre module : les échanges passent par des services ou des interfaces clairement définis.

## Domaines prévus

- `accounts/` : comptes, profils et identité des joueurs.
- `companions/` : compagnons, espèces, raretés, besoins et relations.
- `inventory/` : objets, réserves et équipements.
- `economy/` : Teas, prix, boutiques et transactions.
- `world/` : continents, pays, villes, lieux, climat et calendrier.
- `exploration/` : déplacements, découvertes et rencontres.
- `quests/` : quêtes, objectifs et récompenses.
- `guilds/` : guildes, alliances et territoires.
- `npcs/` : personnages non-joueurs et mémoire du monde.
- `progression/` : niveaux, compétences, statistiques et réussites.

## Règles d'architecture

1. La logique du jeu reste indépendante de Discord autant que possible.
2. Discord est une interface : les commandes et boutons appellent les services des modules.
3. Les données persistantes seront centralisées dans une base de données commune.
4. Le futur site et l'application mobile utiliseront la même API et les mêmes données.
5. Aucun module ne doit créer sa propre monnaie, son propre inventaire ou un stockage parallèle des profils.
6. Les règles communes (identifiants, dates, erreurs et journaux) seront définies dans le cœur technique.

Les dossiers sont des emplacements préparés. Les mécaniques de jeu seront implémentées progressivement après validation du modèle de données et de la base de données.
