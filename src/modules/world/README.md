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
- `discovery-repository.ts` relie ces règles à la persistance PostgreSQL ; `/etheria carte` et `/etheria progression` exposent la progression au joueur.


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
- Le parcours interactif Discord appelle `npc-dialogue-service.ts` et `npc-encounter-service.ts` pour enregistrer la première rencontre, afficher le dialogue et faire progresser les choix.
- La migration 0026 n'a pas été exécutée sur Supabase. Les commandes de consultation nécessitent donc que les migrations du monde soient installées avant leur utilisation.


## Rencontres et dialogues PNJ

- La migration `0027_npc_dialogue_foundation.sql` crée le catalogue éditorial des PNJ, les nœuds et choix de dialogue, les placements par zone d'apparition et les conversations persistantes.
- La migration `0028_npc_settlement_presence.sql` ajoute la localisation actuelle facultative du personnage et les placements de PNJ dans les localités approuvées.
- Aucun PNJ, nom, dialogue ou emplacement n'est préchargé : les contenus doivent être créés et validés avant publication. Cela évite d'inventer des personnages ou de révéler des informations géographiques non approuvées.
- Les administrateurs disposent de `/etheria-admin zones-depart`, `/etheria-admin localites`, `/etheria-admin pnjs`, `/etheria-admin ajouter-pnj`, `/etheria-admin ajouter-dialogue`, `/etheria-admin ajouter-choix`, `/etheria-admin placer-pnj-localite` et `/etheria-admin approuver-pnj` pour vérifier les lieux, rédiger et publier les dialogues. Le placement initial en zone de départ est facultatif ; un PNJ peut être réservé aux localités. Un PNJ reste en brouillon jusqu'à son approbation.
- `/etheria rencontrer` liste uniquement les PNJ approuvés et actifs placés dans le lieu actuel du personnage : sa zone de départ tant qu'il n'a pas rejoint de localité, puis les localités qu'il a découvertes.
- Le joueur choisit un PNJ dans un menu, puis un menu de réponses fait progresser la conversation selon les choix enregistrés dans le catalogue.
- À la première conversation avec un PNJ, `recordNpcEncounter` enregistre la rencontre et révèle le pays et la zone exacte d'apparition. Les rencontres avec d'autres PNJ ne révèlent pas à nouveau le lieu.
- Si l'enregistrement du dialogue échoue après la première rencontre, une reprise auprès du même premier PNJ permet de retrouver la révélation sans perdre l'information.
- Les conversations, choix et événements sont persistants et idempotents. Les tables PNJ sont protégées par RLS ; aucun accès client direct n'est prévu.
- Les placements dans les localités utilisent `npc_settlement_locations`. Ils ne sont accessibles que si la localité est approuvée et enregistrée dans les découvertes du compte. La colonne `characters.current_settlement_id` prépare le suivi du lieu actuel ; le parcours de déplacement qui la renseignera reste à développer.
- Le test PostgreSQL `npc-dialogue-postgres.integration.test.ts` couvre le catalogue, la première rencontre, la révélation du lieu, le choix d'une réponse, la fin de conversation et la reprise sans nouvelle révélation.
- Les migrations 0027 et 0028 n'ont pas été exécutées sur Supabase. Aucun contenu PNJ réel n'est encore configuré, donc la commande indiquera qu'aucun habitant n'est disponible tant que le catalogue n'aura pas reçu ses premières fiches approuvées.

## Déplacements

- `travel-network.ts` définit le modèle logique des connexions ; `travel-service.ts` gère leur consultation et les déplacements persistants des personnages.
- La migration `0029_world_travel_links.sql` crée le catalogue des itinéraires approuvés et le journal idempotent des voyages.
- Les itinéraires relient une zone de départ à une localité ou deux localités. Les modes pris en charge sont terrestre, maritime et aérien ; les types comprennent sentiers, routes, ponts, tunnels, ferries, voies maritimes et routes aériennes.
- Le sens unique ou bidirectionnel est explicite. Les itinéraires comportant des conditions d'accès non prises en charge ne sont pas proposés.
- `/etheria voyager` affiche les itinéraires accessibles depuis la position actuelle ; le choix d'un itinéraire déplace le personnage et enregistre le voyage dans une transaction unique.
- Une destination verrouillée est présentée comme inconnue avant le voyage. Son nom et sa découverte personnelle ne sont enregistrés qu'à l'arrivée.
- Les itinéraires de visibilité verrouillée ne sont proposés qu'aux comptes qui les ont déjà découverts.
- Les administrateurs utilisent `/etheria-admin ajouter-itineraire` pour créer un brouillon, `/etheria-admin itineraires` pour le consulter et `/etheria-admin approuver-itineraire` pour le publier après vérification des extrémités.
- Les distances et durées restent facultatives et ne sont affichées que lorsqu'elles sont renseignées à partir de données validées.
- Aucun trajet concret n'est prérempli et aucune durée ou distance n'est inventée.

## Hors périmètre

Les frontières politiques historiques, les changements de souveraineté, les régimes, les institutions et les gouvernements restent des domaines séparés. Aucun pays ne reçoit de régime politique ou de dirigeant inventé par ces modèles.

Les migrations 0024 à 0029 sont préparées dans le dépôt mais ne doivent pas être exécutées sur Supabase sans revue et approbation explicites. La migration 0024 rattache les 28 pays existants aux sept continents ; la migration 0025 reprend les capitales publiques déjà enregistrées et crée les tables de territoires et localités ; la migration 0026 persiste les découvertes ; la migration 0027 ajoute les dialogues PNJ ; la migration 0028 ajoute les placements de PNJ dans les localités et le champ de localisation actuelle du personnage ; la migration 0029 ajoute les itinéraires et le journal des déplacements.


## Vie locale et identités continentales

- `local-life.ts` définit le modèle éditorial des activités, services, commerces et événements rattachés à une localité.
- Chaque contenu porte une clé stable, un statut éditorial, une visibilité, des tags culturels et une justification expliquant son lien avec l'identité du continent.
- La validation vérifie que le continent déclaré correspond à celui de la localité, que les contenus ont une justification culturelle et que les dates d'événements respectent l'année Etheria de 120 jours.
- Les contenus d'Umbrelune ne peuvent pas être publics. La visibilité des localités découvertes reste contrôlée par les mécanismes de progression existants.
- Les identités continentales disponibles dans le registre reprennent les éléments établis : Sylvaria et sa mémoire vivante, Nivéria et ses arts et sa chaleur humaine, Arcanthia et le lien entre science et croyances, Solméria et la justice et l'entraide, Thalasséa et la liberté insulaire, Ignéria et la puissance démontrée par les actes, Umbrelune et ses secrets.
- Les fêtes dont les dates sont établies sont renseignées sans extrapolation : Souvenance du jour 114 au jour 120 ; Ardence les jours 60 et 61 (jours 12 et 13 du cycle III).
- La migration `0030_world_local_life.sql` crée le catalogue persistant `world_local_content`, sans précharger de contenu concret. Les entrées sont liées à une localité et restent en brouillon jusqu'à approbation.
- Le déclencheur SQL interdit également la publication publique d'un contenu situé dans une localité d'Umbrelune.
- Le test `world-local-life.test.ts` couvre les identités et fêtes canoniques, l'ancrage culturel, la cohérence continent/localité, les dates calendaires et la confidentialité d'Umbrelune.
- La migration 0030 est préparée dans le dépôt mais n'a pas été exécutée sur Supabase.


## Simulation quotidienne des localités

- `local-life.ts` porte le catalogue éditorial, les identités culturelles continentales et les filtres de visibilité.
- `local-life-simulation.ts` définit les horaires hebdomadaires, leur validation, l'ouverture à une minute donnée, le calendrier absolu Etheria de 120 jours et les règles déterministes de stock.
- Les horaires utilisent les jours de semaine Etheria 1 à 7 et des minutes locales de 0 à 1440. Aucun fuseau horaire terrestre ni horaire concret n'est présumé.
- Un commerce peut posséder plusieurs articles de stock, chacun avec prix en Teas, quantité, capacité maximale et politique optionnelle de réapprovisionnement. Aucun prix ou article n'est prérempli.
- Le réapprovisionnement est calculé à partir d'un compteur absolu de jours Etheria, ce qui permet de franchir proprement la fin d'une année de 120 jours.
- La consommation de stock refuse les quantités invalides et les ruptures de stock. Les fonctions métier sont pures ; le branchement transactionnel aux achats et au portefeuille partagé Sweet Tea reste une étape séparée.
- La migration `0031_world_local_life_simulation.sql` ajoute les horaires et le stock des commerces, avec contraintes de quantité et garde-fous empêchant un contenu doté de stock de cesser d'être un commerce.
- Les tests unitaires couvrent horaires, calendrier, réapprovisionnement, consommation et validations. Les migrations 0030 et 0031 ne sont pas exécutées sur Supabase.

- Les commandes administratives `/etheria-admin definir-horaires-local`, `stocks-locaux` et `ajouter-stock-local` permettent de configurer les horaires et les articles sans précharger de données fictives. Les horaires sont fournis en JSON structuré puis validés ; les articles sont rattachés uniquement à un contenu de type commerce.
- La liste des stocks affiche le prix, les quantités, la capacité, la politique de réapprovisionnement et la révision. L'ajout d'un stock automatique exige le compteur du dernier jour de réapprovisionnement afin que le calendrier soit déterministe.
