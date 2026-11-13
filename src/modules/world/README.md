# Géographie du monde Etheria

## Principes d'architecture

La géographie physique et les structures politiques sont deux domaines distincts :

- les continents, îles, archipels, océans, mers, reliefs, cours d'eau, biomes et habitats décrivent le monde physique ;
- les pays, frontières, territoires administratifs et gouvernements décrivent son organisation politique ;
- un changement de gouvernement ou de frontière ne doit pas réécrire la géographie naturelle ;
- une caractéristique géographique peut être ajoutée, révisée ou retirée sans supprimer les découvertes ou les compagnons déjà obtenus.

## Continents canoniques

Le registre initial comprend exactement sept continents :

- Sylvaria
- Nivéria
- Arcanthia
- Solméria
- Thalasséa
- Ignéria
- Umbrelune, dont les informations restent verrouillées jusqu'à sa découverte.

Les 28 pays déjà présents dans la migration 0004 sont rattachés à leur continent par une clé stable. La migration 0024 ne renomme ni ne remplace ces pays.

## Fondation technique

- `geography.ts` contient les types, le registre en mémoire, les validations et le filtre de visibilité.
- `world_continents` persiste les sept continents et leur visibilité.
- `world_geographic_features` est le registre extensible des caractéristiques physiques.
- La hiérarchie des caractéristiques utilise des identifiants stables et refuse les parents absents, les doublons et les cycles.
- Les lieux concrets, coordonnées, tracés, biomes et habitats ne sont pas préremplis sans validation éditoriale.
- Aucune extension PostGIS ni aucun format cartographique propriétaire n'est imposé à ce stade.
- Les tables sont protégées par RLS et destinées au backend de confiance.

## Territoires et localités

- `territories.ts` définit les territoires administratifs et les localités sans inventer de nouvelles entrées canoniques.
- La migration 0025 crée les tables de territoires et de localités et reprend les 24 capitales publiques depuis `countries.capital_name`.
- Les quatre pays secrets d'Umbrelune ne reçoivent aucune capitale ni localité publique.
- Les hiérarchies, rattachements au pays, capitales et règles de visibilité sont validés avant publication.
- Les villes secondaires, villages, hameaux, subdivisions et implantations isolées attendent une validation éditoriale.

## Découverte et carte personnelle

- `discovery.ts` enregistre les découvertes par compte joueur, avec méthode, date et identifiant d'événement. Les zones de départ révélées après la première rencontre PNJ disposent du type `spawn_zone`.
- Les événements sont idempotents ; un même événement ne peut pas créer plusieurs découvertes.
- Les prérequis sont vérifiés avant d'autoriser une découverte.
- Les brouillons ne sont jamais découvrables.
- Les découvertes sont conservées même si une fiche géographique est ensuite retirée du catalogue.
- Les clés découvertes alimentent les filtres de visibilité des continents, pays, localités, caractéristiques et itinéraires.
- La progression cartographique est calculée séparément pour chaque compte.
- Ce module définit les règles métier en mémoire ; aucune persistance SQL ni commande Discord n'est encore branchée.


## Persistance des découvertes

- La migration `0026_world_discoveries.sql` crée `world_discoveries` et `world_discovery_events`.
- Les découvertes sont rattachées à `accounts.id`, jamais à un personnage : elles survivent aux générations successives d'un joueur.
- Une cible n'est enregistrée qu'une fois par compte, type et clé stable. Son premier événement, sa méthode et sa date restent conservés.
- Chaque événement accepté est journalisé, y compris les nouvelles tentatives visant une cible déjà découverte. Le couple compte/identifiant d'événement est idempotent.
- Les identifiants d'événement sont du texte afin d'accepter les identifiants Discord (snowflakes) sans conversion arbitraire.
- Les prérequis sont contrôlés dans la transaction avant une première découverte. Les brouillons sont refusés.
- Les tables n'ont aucune dépendance FK vers le catalogue géographique : retirer une fiche ne détruit donc jamais la progression des joueurs.
- Le repository recharge l'état et les identifiants d'événements afin de reconstruire le contrat `DiscoveryState` existant.
- Les contraintes uniques SQL arbitrent les appels concurrents provenant de plusieurs processus.
- Les deux tables sont protégées par RLS et ne doivent être utilisées que par le backend de confiance.
- Le test PostgreSQL dédié utilise un schéma isolé et couvre l'isolation des comptes, les prérequis, les doublons d'événements, les cibles déjà découvertes et la protection contre la suppression d'un compte possédant un historique.
- `/etheria carte` affiche les quinze découvertes les plus récentes du compte Discord ; `/etheria progression` affiche le total et la répartition par type.
- `npc-encounter-service.ts` est le point d'entrée transactionnel de la première rencontre PNJ : il révèle le pays et la zone de départ seulement à cet instant, puis les inscrit dans la carte du compte. Les rencontres suivantes ne révèlent pas à nouveau le lieu.
- La table des découvertes utilise aussi le type `spawn_zone` pour distinguer le lieu exact d'apparition du pays d'origine.
- Le service de rencontre PNJ est prêt à être appelé par le futur parcours interactif des PNJ ; aucun parcours de dialogue PNJ n'existe encore dans les interactions Discord actuelles.
- La migration 0026 n'a pas été exécutée sur Supabase. Les commandes de consultation nécessitent donc que les migrations du monde soient installées avant leur utilisation.


## Rencontres et dialogues PNJ

- La migration `0027_npc_dialogue_foundation.sql` crée le catalogue éditorial des PNJ, les nœuds et choix de dialogue, les placements par zone d'apparition et les conversations persistantes.
- Aucun PNJ, nom, dialogue ou emplacement n'est préchargé : les contenus doivent être validés avant publication. Cela évite d'inventer des personnages ou de révéler des informations géographiques non approuvées.
- `/etheria rencontrer` liste uniquement les PNJ approuvés, actifs et placés dans la zone de départ du personnage actif.
- Le joueur choisit un PNJ dans un menu, puis un menu de réponses fait progresser la conversation selon les choix enregistrés dans le catalogue.
- À la première conversation avec un PNJ, `recordNpcEncounter` enregistre la rencontre et révèle le pays et la zone exacte d'apparition. Les rencontres avec d'autres PNJ ne révèlent pas à nouveau le lieu.
- Si l'enregistrement du dialogue échoue après la première rencontre, une reprise auprès du même premier PNJ permet de retrouver la révélation sans perdre l'information.
- Les conversations, choix et événements sont persistants et idempotents. Les tables PNJ sont protégées par RLS ; aucun accès client direct n'est prévu.
- Le système actuel place les PNJ dans les zones d'apparition initiales. Les placements dans les autres localités seront ajoutés avec le système de déplacement et de localisation des personnages.
- Le test PostgreSQL `npc-dialogue-postgres.integration.test.ts` couvre le catalogue, la première rencontre, la révélation du lieu, le choix d'une réponse, la fin de conversation et la reprise sans nouvelle révélation.
- La migration 0027 n'a pas été exécutée sur Supabase. Aucun contenu PNJ réel n'est encore configuré, donc la commande indiquera qu'aucun habitant n'est disponible tant que le catalogue n'aura pas reçu ses premières fiches approuvées.

## Déplacements

- `travel-network.ts` décrit les connexions entre localités et caractéristiques géographiques.
- Les modes pris en charge sont terrestre, maritime et aérien ; les types comprennent sentiers, routes, ponts, tunnels, ferries, voies maritimes et routes aériennes.
- Le sens unique ou bidirectionnel est explicite.
- Les itinéraires secrets restent masqués tant que leurs deux extrémités ne sont pas découvertes.
- Les distances et durées restent facultatives et ne doivent être renseignées qu'à partir de données validées.
- Aucun trajet concret n'est prérempli et aucune durée ou distance n'est inventée.

## Hors périmètre

Les frontières politiques historiques, les changements de souveraineté, les régimes, les institutions et les gouvernements restent des domaines séparés. Aucun pays ne reçoit de régime politique ou de dirigeant inventé par ces modèles.

Les migrations 0024 et 0025 sont préparées dans le dépôt mais ne doivent pas être exécutées sur Supabase sans revue et approbation explicites. La migration 0024 rattache les 28 pays existants aux sept continents ; la migration 0025 reprend les capitales publiques déjà enregistrées et crée les tables de territoires et localités.
