# Modules Etheria

Chaque domaine du jeu possède son propre dossier. Un module ne doit pas accéder directement aux détails internes d'un autre module : les échanges passent par des services ou des interfaces clairement définis.

## Domaines prévus

- `accounts/` : comptes, profils et identité des joueurs.
- `companions/` : compagnons, espèces, raretés, besoins et relations.
- `inventory/` : objets, réserves et équipements. Le service de réception transactionnelle des ressources collectées est posé ; il attend le futur résolveur du monde.
- `economy/` : Teas, prix, boutiques et transactions.
- `world/` : géographie physique, continents, caractéristiques naturelles, pays, lieux, climat et calendrier. La fondation du registre géographique est ajoutée ; les lieux concrets restent à valider.
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


## Conservation des données et médias

- Les données persistantes sont limitées aux informations utiles au gameplay, à la continuité du monde et à l'audit.
- Les événements répétitifs ou anciens peuvent être regroupés en résumés ; les souvenirs importants des PNJ sont conservés selon des règles de priorité.
- Les historiques volumineux suivent une politique de rétention et d'archivage définie dans `documentation/database/schema-v1.md`. Les transactions économiques traçables ne sont jamais effacées pour gagner de la place.
- Les fichiers médias (illustrations, avatars, sons, etc.) passent par un service de stockage objet distinct. Les modules ne stockent en base que leurs références et métadonnées.
- Les modules utilisent des interfaces internes pour la base de données et le stockage de fichiers : le code métier ne doit pas dépendre directement de Supabase, afin de permettre un changement de fournisseur.
