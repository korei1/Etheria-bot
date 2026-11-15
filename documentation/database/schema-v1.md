# Modèle de données Etheria - version 1

> Document de conception. Ce fichier décrit la structure cible ; il ne constitue pas encore une migration SQL et ne crée aucune base distante.

## 1. Principes

- PostgreSQL est la cible recommandée pour les données relationnelles et transactionnelles.
- Les données de jeu sont indépendantes de Discord : Discord, le futur site et l'application mobile sont des interfaces du même univers.
- Un compte Etheria possède un identifiant interne stable. Les identifiants des fournisseurs (Discord, futur système de connexion web, etc.) sont stockés séparément.
- Les monnaies, inventaires et possessions sont centralisés. Aucun module ne maintient une copie parallèle.
- Les changements économiques et les objets consommés doivent être enregistrés de façon transactionnelle.
- Les dates techniques sont stockées en UTC ; le calendrier fictif d'Etheria est géré par le module Monde.
- Les décisions encore en discussion restent configurables et ne sont pas transformées en règles définitives par ce document.

## 2. Identité et profils

### `accounts`
Compte central du joueur : `id` (UUID), `created_at`, `status`, `last_seen_at`.

### `account_identities`
Méthodes de connexion liées au compte : `id`, `account_id`, `provider`, `provider_user_id`, `created_at`.
- Contrainte unique : (`provider`, `provider_user_id`).
- Exemple de fournisseur initial : `discord`.
- Un compte peut ultérieurement lier une identité web/mobile sans créer un second joueur.

### `player_profiles`
Données publiques et de jeu : `account_id`, `display_name`, `origin_country_id`, `created_at`, `updated_at`.
- Le pays d'origine est une référence au catalogue des pays.
- Les informations privées d'authentification ne sont jamais stockées dans le profil public.

## 3. Économie et inventaire

### `wallets`
Portefeuille par compte et par monnaie : `id`, `account_id`, `currency_code`, `balance`, `updated_at`.
- Contrainte unique : (`account_id`, `currency_code`).
- La monnaie principale prévue est Teas ; son code interne devra être fixé avant la migration.

### `currency_transactions`
Journal immuable des mouvements : `id`, `wallet_id`, `amount`, `reason_code`, `reference_type`, `reference_id`, `created_at`.
- Un mouvement positif crédite le portefeuille ; un mouvement négatif le débite.
- Toute modification de solde doit être atomique avec l'écriture du journal.
- Les corrections passent par une nouvelle transaction compensatrice, pas par la réécriture de l'historique.

### `item_catalog`
Catalogue des objets : `id`, `code`, `name`, `category`, `rarity`, `metadata`, `is_active`.

### `inventory_stacks`
Objets empilables possédés : `id`, `account_id`, `item_id`, `quantity`, `updated_at`.
- Contrainte unique envisagée : (`account_id`, `item_id`) pour les objets empilables.
- Les objets uniques/équipés nécessiteront une représentation dédiée si leurs caractéristiques individuelles l'exigent.
- Toute consommation ou attribution doit être transactionnelle.

## 4. Compagnons

### `species`
Catalogue des espèces : `id`, `code`, `name`, `category`, `description`, `is_active`.

### `companion_instances`
Chaque compagnon individuel : `id`, `owner_account_id`, `species_id`, `name`, `rarity`, `level`, `experience`, `element`, `potential`, `health_state`, `energy`, `fatigue`, `created_at`.
- Les attributs propres à un individu ne doivent pas être enregistrés dans le catalogue de l'espèce.
- Les variantes naturelles, affinités, capacités et préférences pourront être normalisées dans des tables associées quand leurs règles seront finalisées.
- La règle décidée de quatre compagnons maximum par espèce et par joueur doit être appliquée côté service métier et protégée contre les acquisitions simultanées par transaction/verrouillage.

### `companion_needs`
État évolutif des besoins : `companion_id`, `need_code`, `value`, `updated_at`.

### `companion_events`
Historique utile : `id`, `companion_id`, `event_type`, `payload`, `created_at`.
- Sert à tracer les événements significatifs sans surcharger la ligne principale du compagnon.

## 5. Monde et calendrier

### `continents`, `countries`, `cities`, `locations`
Catalogue hiérarchique des lieux. Chaque entrée possède un identifiant stable et une relation vers son parent.
- La liste finale des pays, villes et frontières doit être validée avant import.
- Les lieux spéciaux et zones d'exploration peuvent utiliser une table `locations` commune avec un type.

### `world_clock`
État du calendrier fictif : identifiant de monde, date/heure Etheria courante, vitesse et paramètres du calendrier.
- Les paramètres envisagés (journée de 8 heures réelles et année de 40 jours réels) restent des paramètres à confirmer et tester.
- Ne pas déduire le temps fictif de l'horloge locale du joueur.

### `world_events`
Événements mondiaux planifiés ou actifs : `id`, `event_type`, `starts_at`, `ends_at`, `location_id`, `payload`, `status`.

## 6. Progression, quêtes et relations

### `player_progression`
Niveaux et expérience par domaine : `account_id`, `domain_code`, `level`, `experience`, `updated_at`.
- Le niveau général est calculé selon la règle métier validée, incluant la moyenne des niveaux des compagnons si cette règle est conservée.
- Éviter de stocker plusieurs copies d'une valeur calculable sans raison de performance.

### `quests` et `player_quests`
Catalogue des quêtes et état individuel : progression, statut, dates de début/fin et données spécifiques.

### `player_relationships`
Relations entre joueurs : `id`, `account_id`, `related_account_id`, `relationship_type`, `created_at`.
- Contrainte d'unicité à définir selon le caractère orienté ou réciproque de chaque relation.

## 7. Guildes et PNJ

### `guilds` et `guild_memberships`
Guildes, fondateurs, membres, rôles et dates d'adhésion. Les règles de création et de gouvernance seront implémentées dans le module Guildes.

### `npcs`
Identité et état persistant des PNJ : `id`, `name`, `npc_type`, `home_location_id`, `status`, `created_at`.

### `npc_memories`
Souvenirs ciblés : `id`, `npc_id`, `subject_account_id`, `memory_type`, `summary`, `importance`, `created_at`, `last_recalled_at`.
- La mémoire persistante conserve les faits utiles à la continuité des relations, pas chaque message ou détail de conversation.
- Les souvenirs proches ou répétitifs sont regroupés ; les événements anciens sont périodiquement résumés en souvenirs plus compacts.
- Chaque souvenir possède une importance et une durée de conservation adaptées à son type. Les souvenirs importants pour une relation ou une quête ne sont pas supprimés automatiquement.
- Les données brutes temporaires ne sont conservées que pendant une durée définie, puis supprimées ou agrégées après vérification des besoins du jeu.

## 8. Conservation, archivage et fichiers

### Mémoire et historiques

- Ne pas enregistrer chaque action technique ou chaque message comme un événement permanent. Persister les changements d'état utiles et les événements de jeu significatifs.
- Définir une durée de conservation par catégorie : données opérationnelles, événements temporaires, souvenirs de PNJ, journaux d'audit et transactions économiques.
- Résumer et regrouper les anciens événements narratifs lorsqu'un résumé conserve suffisamment de contexte pour le gameplay.
- Archiver les historiques volumineux dans des tables d'archives PostgreSQL ou dans un stockage objet externe selon leur besoin d'accès. Les archives doivent rester exportables et réimportables.
- Ne jamais supprimer les transactions économiques nécessaires à l'audit. Si le volume le justifie, les partitionner ou les archiver selon une procédure contrôlée, sans casser leur traçabilité.
- Prévoir une tâche de maintenance qui applique les politiques de rétention, avec journalisation et possibilité de restauration. Aucune suppression automatique ne doit être activée avant validation des durées.

### Fichiers et médias

- Les images, illustrations, sons, vidéos et autres fichiers binaires sont stockés dans un stockage objet, jamais directement dans les tables PostgreSQL.
- PostgreSQL ne conserve que les métadonnées nécessaires : identifiant, clé/chemin de stockage, type MIME, taille, propriétaire éventuel, date de création et statut.
- Les services de jeu manipulent une interface de stockage abstraite ; le fournisseur (par exemple Supabase Storage) ne doit pas être imposé dans la logique métier.
- Les fichiers doivent être servis avec des règles d'accès adaptées. Les secrets et URL privées temporaires ne sont jamais enregistrés dans le dépôt Git.

## 9. Sécurité et intégrité

- Ne jamais stocker de token Discord, mot de passe ou secret dans les tables de jeu ou dans Git.
- Les secrets d'exécution seront fournis par variables d'environnement sur l'hébergeur.
- Utiliser des clés étrangères, contraintes, index et transactions.
- Les actions sensibles vérifient côté serveur que le compte demandeur est bien autorisé.
- Les commandes Discord ne sont pas une source d'autorité : le serveur valide toutes les opérations.
- Prévoir sauvegardes, restauration et migrations versionnées avant l'ouverture aux joueurs.
- Les journaux ne doivent pas contenir de secrets ni de données personnelles inutiles.

## 10. Ordre conseillé de mise en œuvre

1. Comptes et identités.
2. Profils, portefeuille et journal des transactions.
3. Catalogue d'objets et inventaire.
4. Catalogue des espèces et compagnons individuels.
5. Monde, lieux et calendrier.
6. Progression et quêtes.
7. Guildes, relations et PNJ.
8. Outils d'administration, sauvegarde et observabilité.

## 11. Points à valider avant la première migration

- Le code interne définitif de la monnaie Teas.
- La liste finale des pays et la structure géographique.
- Les champs exacts des compagnons et le format des variantes/capacités.
- Les règles définitives de progression générale.
- Les durées de conservation par catégorie et les règles de résumé/archivage des souvenirs et historiques.
- Le fournisseur de stockage objet et les règles d'accès aux médias.
- Le système d'authentification commun du futur site et de l'application.

Aucune règle encore provisoire ne doit être figée dans une migration sans validation.
