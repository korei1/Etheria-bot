# Plan de reprise et revue des migrations PostgreSQL

Dernière revue du dépôt : 15 novembre 2026. Cette revue porte sur les migrations `0001` à `0035` du dépôt `korei1/Etheria-bot` et sur l'état distant Supabase constaté séparément.

## 1. Situation de départ

Le projet Supabase Etheria possède déjà le socle SQL de `0001_initial_core.sql` : `accounts`, `account_identities`, `player_profiles`, `currencies`, `wallets` et `currency_transactions`. La ligne de monnaie `TEAS` existe. Les autres tables métier ne sont pas présentes dans l'état distant précédemment inspecté.

Le registre distant des migrations est vide. Il ne faut donc ni assimiler la base à une base vierge, ni rejouer `0001` sans procédure de reprise explicite.

Le script npm `db:check` exécute uniquement un test de connexion PostgreSQL via `SELECT 1`. Il ne vérifie pas le schéma et n'applique aucune migration. Aucun exécuteur de migrations n'est déclaré dans les scripts npm examinés.

## 2. Contenu des migrations par domaine

| Migrations | Domaine | Principaux objets |
|---|---|---|
| `0001` | Socle | comptes, identités, profils, monnaies, portefeuilles, transactions |
| `0002–0009` | Personnages et arrivée en jeu | personnages, brouillons, pays, avatars, zones de départ, rencontres PNJ, progression de quête |
| `0010–0019` | Exploration et survie | scènes d'exploration, sacs, inventaire, besoins, abri, feu, camp, fabrication, collecte, lots traçables et contrôles de cohérence |
| `0020–0023` | Compagnons | individus, besoins et événements, traits, variantes naturelles, régions, catalogue d'espèces et formes |
| `0024–0029` | Monde et déplacements | continents, caractéristiques géographiques, territoires administratifs, localités, découvertes, dialogues PNJ, placements, itinéraires et événements de voyage |
| `0030–0035` | Vie locale et simulation | activités/services/commerces/événements locaux, stocks, horloge, fuseaux, horaires de PNJ, libellés d'activités et trajets planifiés des PNJ |

## 3. Données créées par les migrations

Les migrations ne sont pas uniquement des créations de tables. Plusieurs insèrent des données initiales :

- `0004` crée le référentiel de 28 pays, dont quatre entrées secrètes d'Umbrelune sans nom public.
- `0009`, `0010` et `0012` initialisent des états de quête, d'exploration et de besoins pour les personnages déjà actifs au moment de leur exécution.
- `0023` insère les régions et un catalogue éditorial d'espèces et de formes. Les espèces sont marquées indisponibles par défaut.
- `0024` crée les sept continents et rattache les pays à leur continent.
- `0025` crée les capitales déjà présentes dans le catalogue pays, sans inventer de villes secondaires.
- `0032` crée l'unique ligne initiale de l'horloge mondiale, en pause.

Ces insertions doivent être contrôlées après migration. Elles ne doivent pas être rejouées indépendamment sans vérifier les clés et les contraintes existantes.

## 4. Points à corriger ou à traiter avant mise en service

### 4.1 Économie : ancien couplage SCNX encore présent dans le code

La décision d'architecture confirmée est que l'économie appartient à Etheria et que PostgreSQL est la source de vérité. Pourtant :

- le commentaire de `0001` et celui de `0020` présentent encore SCNX comme détenteur des Teas ;
- `src/modules/accounts/account-service.ts` indique encore que les Teas restent dans SCNX et qu'aucun portefeuille PostgreSQL ne doit être créé ;
- `src/modules/economy/sweet-tea-economy-client.ts` contient toujours le client du webhook SCNX ;
- le service économique PostgreSQL n'est pas encore implémenté.

**Action requise :** traiter cette divergence dans une évolution de code dédiée. Ne pas supprimer le client historique avant d'avoir remplacé ses usages et vérifié tous les appels. Ne pas synchroniser ni importer automatiquement un solde SCNX.

### 4.2 Compagnons : règles métier non garanties par le schéma

La migration `0020` stocke l'espèce, la rareté, l'élément et le mode d'acquisition dans `companion_instances`. La migration `0023` crée un catalogue d'espèces avec un élément fixe, mais ne crée pas de clé étrangère entre `companion_instances.species_key` et `companion_species_catalog.species_key`.

La règle de jeu confirmée est la suivante : seuls les compagnons issus d'espèces achetables dans la boutique Discord permettent au joueur de choisir leur élément ; pour les autres espèces, l'élément est imposé par l'espèce. Le schéma actuel ne porte pas à lui seul un indicateur explicite de disponibilité dans cette boutique et ne garantit pas cette règle.

**Action requise :** prévoir une validation métier transactionnelle de l'espèce, de son mode d'acquisition et de son élément. Ajouter ensuite une contrainte de référence et un moyen explicite de distinguer les espèces proposées dans la boutique Discord, après conception de cette donnée. Les règles de reproduction liées à la rareté doivent aussi être contrôlées dans le service de reproduction ; elles ne sont pas définies par ces migrations.

### 4.3 Contenu public et gouvernance du monde

Les migrations `0030` et `0031` fournissent un catalogue éditorial pour les activités, services, commerces et événements, ainsi que les stocks de commerces. Elles ne définissent pas à elles seules le système d'autorité des institutions.

**Action requise :** les services et contenus publics doivent être créés, approuvés et gérés par les institutions compétentes du monde. Les interfaces joueurs ne doivent pas recevoir de droits d'administration sur ces contenus. Le contrôle doit exister dans le backend, et pas uniquement dans l'interface Discord.

### 4.4 Horloge et fuseaux

La migration `0032` prévoit une horloge mondiale unique et des fuseaux horaires avec décalage UTC en minutes. L'horloge est initialement en pause et aucun fuseau n'est attribué automatiquement. Le champ `seasonal_clock_change` est volontairement limité à `FALSE`.

La règle confirmée est que chaque territoire suit son heure locale et que les horaires d'activités et d'événements s'interprètent dans le fuseau de leur localité.

**Action requise :** attribuer les fuseaux aux localités seulement à partir de données validées. Définir le calendrier et la cadence du temps mondial avant de démarrer l'horloge. Vérifier si le modèle de décalage fixe suffit au canon temporel retenu.

### 4.5 Itinéraires des PNJ

`0035` référence un itinéraire approuvé et des localités d'origine et de destination, mais ne vérifie pas par contrainte SQL que ces deux localités correspondent réellement aux extrémités de l'itinéraire référencé.

**Action requise :** vérifier cette cohérence dans le service transactionnel de planification et de déplacement des PNJ, ou ajouter une contrainte adaptée après revue du modèle d'itinéraire.

### 4.6 Sécurité RLS et privilèges

Les six tables du socle distant ont RLS activé sans politique. Plusieurs migrations ultérieures activent également RLS sans politique client. En revanche, plusieurs tables contenant des données personnelles ou appartenant aux joueurs ne déclarent pas explicitement RLS dans les migrations examinées, notamment les personnages, brouillons, inventaires, besoins, camps, compagnons et leurs états.

**Écart important dans le SQL initial :** `0001_initial_core.sql` ne contient pas de commande `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` pour ses six tables. L'état RLS observé sur Supabase ne provient donc pas de ce fichier. Une base neuve qui exécute uniquement `0001` ne reproduit pas cette protection ; une migration de sécurité dédiée devra activer RLS avant toute exposition de ces tables par l'API.

L'absence de RLS n'implique pas automatiquement que ces tables sont accessibles publiquement : cela dépend aussi des privilèges SQL accordés aux rôles Supabase. Ces privilèges n'ont pas été audités pour les tables qui ne sont pas encore présentes sur le projet distant.

**Action requise :** avant toute exposition via l'API Supabase, auditer les privilèges et activer des politiques RLS adaptées aux tables personnelles. Les joueurs ne doivent pouvoir lire ou modifier que leurs propres données selon les règles du jeu. Les catalogues institutionnels et contenus publics doivent conserver des droits d'administration réservés aux institutions et au backend autorisé. Ne pas ajouter de politiques génériques qui ouvriraient l'écriture aux joueurs.

### 4.7 Index

L'advisor Supabase a signalé l'absence d'index couvrant la clé étrangère `wallets.currency_code`. Ajouter un index adapté lors d'une migration dédiée après validation du plan de requêtes. Les index signalés comme inutilisés sur une base presque vide ne doivent pas être supprimés sur ce seul signal.

## 5. Ordre de reprise proposé

1. Confirmer une sauvegarde restaurable du projet Supabase Etheria.
2. Comparer précisément les objets de `0001` à ceux déjà présents, puis enregistrer le socle existant dans le registre de migrations selon une procédure de baseline documentée. Ne pas exécuter `0001` une seconde fois.
3. Ajouter un exécuteur de migrations avec verrouillage, transactions lorsque possible, checksum des fichiers et journal d'exécution. Le script `db:check` actuel ne remplit pas ce rôle.
4. Tester `0002` à `0035` dans un environnement isolé, dans l'ordre numérique, en vérifiant aussi les données initiales et les contraintes.
5. Corriger les divergences confirmées avant la mise en service : économie indépendante de SCNX, intégrité du catalogue de compagnons, autorisations institutionnelles, fuseaux locaux et cohérence des trajets PNJ.
6. Définir et tester les privilèges SQL et les politiques RLS des tables personnelles et institutionnelles.
7. Exécuter les tests d'intégration PostgreSQL et les tests métier.
8. Après sauvegarde vérifiée et autorisation explicite, appliquer les migrations validées au projet cible, puis contrôler le schéma et les données.

## 6. Statut de cette revue

- Migrations `0001` à `0035` : **revues individuellement au niveau SQL**.
- Dépendances générales : **ordre numérique cohérent à première lecture ; tests isolés nécessaires pour confirmer l'exécution complète**.
- Baseline `0001` : **à enregistrer sans rejouer le SQL**.
- Migrations `0002` à `0035` : **non appliquées sur le projet Supabase inspecté**.
- Exécuteur de migrations : **absent des scripts npm examinés**.
- Divergence SCNX dans le code : **confirmée, correction de code à planifier**.
- Règle élémentaire des compagnons : **à garantir dans la couche métier et à renforcer dans le schéma**.
- Privilèges et RLS des tables de jeu : **audit à compléter avant exposition client**.
- Modifications de code ou de base effectuées pendant cette revue : **aucune**.
