# Inventaire et réception des ressources

## Catalogue central des objets

`item-catalog.ts` est la source centrale des identités techniques déjà utilisées dans le parcours initial, le stockage, la collecte et l'artisanat. Chaque objet possède un code stable, un nom d'affichage et une catégorie générale (`resource`, `processed_item`, `crafted_object` ou `discovery`).

Le catalogue ne fixe volontairement ni poids, valeur, empilabilité, durabilité, rareté, capacité, usages, consommation ou présence géographique. Ces règles nécessitent des décisions de conception canoniques distinctes.

Le service de collecte refuse désormais les codes absents du catalogue. Le catalogue des recettes vérifie que chaque ingrédient et chaque résultat y est déclaré. Le stockage du camp lit son autorisation depuis la définition de l'objet ; à ce stade, seul le fragment historique non identifié possède explicitement cette autorisation, conformément à la règle déjà implémentée.


## Modèle commun des objets

`item-model.ts` sépare la définition catalogue du stock détenu :

- `ItemDefinition` décrit le type d'objet : code, nom et catégorie.
- `ItemStack` représente une quantité agrégée d'un même code dans un contenant.
- `ItemContainer` identifie les contenants actuellement implémentés : sac porté ou stockage physique du camp.
- `ItemStackView` réunit la définition, le stock et son contenant pour les interfaces.
- `createItemStack` vérifie l'existence du code et la validité de la quantité ; la limite technique suit le type PostgreSQL `INTEGER` existant.
- `getItemDisplayName` fournit un libellé unique depuis le catalogue.

Le modèle représente le stockage actuel par code + quantité. Il ne crée pas d'identifiant individuel pour chaque unité et ne décrète pas que tous les objets devront être empilables dans les futures règles de gameplay. Les notions de poids, encombrement, durabilité, valeur, rareté, état, équipement et propriétés spécifiques restent non renseignées tant qu'elles ne sont pas définies canoniquement.

La provenance complète d'un objet n'est pas encore stockée de manière uniforme : les journaux de collecte et de fabrication gardent leurs événements propres. Le modèle ne prétend donc pas fournir un historique exhaustif des objets.

## Contrats de propriétés des objets

`item-properties.ts` définit des propriétés facultatives, sans attribuer de valeurs aux objets existants :

- **Physiques** : masse, volume et dimensions, avec unité explicite.
- **Durabilité** : état actuel et maximum, lorsque cette propriété s'applique.
- **Économie** : valeur et code de devise.
- **Empilement** : mode et quantité maximale éventuelle.
- **Équipement** : emplacement et compatibilités éventuelles.
- **État d'une instance** : clés d'état/qualité, durabilité propre et provenance.

Les propriétés communes appartiennent à la définition catalogue ; l'état et la provenance appartiennent à une instance ou à un lot détenu. Les origines prévues dans le contrat couvrent collecte, fabrication, découverte, achat, échange, héritage et don.

**Aucune valeur n'est renseignée pour les 11 objets existants.** Les règles d'empilement déjà utilisées par les tables d'inventaire restent un comportement technique historique, pas une décision canonique sur la taille maximale des piles ni sur l'empilabilité de chaque objet. Le stockage actuel ne conserve pas encore l'état individuel ou la provenance complète de chaque objet.

Les validateurs vérifient la cohérence des propriétés lorsqu'elles seront renseignées. Aucun changement de schéma SQL ni migration Supabase n'est inclus dans cette étape.

### Exposition dans les vues d'inventaire

`createItemStackView` expose désormais les propriétés communes de la définition catalogue lorsqu'elles existent, ainsi qu'un état facultatif validé fourni par le service appelant. Les vues Discord et les futurs services peuvent donc consommer un contrat unique sans recopier les propriétés.

L'état facultatif ne doit être fourni que si le stock représenté est homogène. Le stockage SQL actuel agrège encore les quantités par code d'objet : il ne peut pas conserver de façon fiable des états ou provenances différents pour chaque unité d'une même pile. Aucun état n'est donc persisté automatiquement et aucune provenance n'est inventée lors d'une collecte, fabrication, découverte ou manipulation.

Le modèle de lots est désormais persisté par la migration additive 0018. Les lignes historiques sont reprises comme lots de compatibilité sans provenance connue. Les services raccordés ajoutent, consomment et déplacent ces lots dans la même transaction que les stocks agrégés.

### Domaine des lots traçables

`item-lots.ts` introduit un premier modèle métier pur, indépendant de PostgreSQL :

- `ItemLot` possède un identifiant stable, un code objet, une quantité, un contenant et un état/provenance facultatifs.
- `createItemLot` valide l'identité, la quantité, le contenant et l'état.
- `splitItemLot` sépare une quantité en créant un nouvel identifiant fourni par le service appelant ; les deux lots conservent l'état et la provenance connus.
- `moveItemLot` déplace un lot entier sans changer son identité ni son historique.
- `mergeItemLots` refuse volontairement toute fusion tant qu'une règle d'empilement canonique n'existe pas.

La migration additive `0018_traceable_item_lots.sql` crée `character_item_lots` et transforme chaque ligne d'inventaire ou de stockage du camp existante en un lot technique lié à sa ligne source. Les lots historiques n'ont aucune provenance renseignée : elle reste inconnue au lieu d'être inventée.

`item-lot-repository.ts` ajoute une lecture des lots persistés d'un personnage, en restreignant l'accès au compte propriétaire et aux personnages actifs. Cette lecture dépend de l'application préalable de la migration 0018.

La migration additive `0019_enforce_item_lot_totals.sql` ajoute des contraintes différées en fin de transaction : pour chaque emplacement du sac et chaque entrée du stockage du camp, la somme des lots doit être exactement égale à la quantité agrégée, et tous les lots rattachés doivent porter le même code objet que leur contenant. Les contrôles couvrent les créations, modifications, suppressions et déplacements de lots. Ils empêchent qu'une transaction valide un stock désynchronisé. Cette migration n'a pas été exécutée sur Supabase ; elle doit d'abord être testée sur une base de préproduction.

**Raccordement transactionnel actuel :** les services de collecte, de fabrication, de collecte scénarisée initiale, de cuisson, de découverte des fragments et de dépôt/retrait au camp synchronisent désormais les lots dans la transaction de mise à jour du stock. La quantité agrégée reste une vue de compatibilité ; les lots conservent séparément les provenances et peuvent cohabiter sous une même ligne de stock. Le retrait partiel du stockage du camp sépare un lot si nécessaire et conserve son état/provenance. La fusion de lots reste interdite dans le domaine pur tant que les règles d'empilement de gameplay ne sont pas définies.

## Service de réception

`addCollectedResourceToInventory` ajoute au sac actuellement équipé une quantité de ressource déjà validée par un système appelant.

- Vérifie que le personnage est actif et appartient au compte demandeur.
- Verrouille le personnage et le sac pendant l'opération.
- Empile la ressource si son code existe déjà ; sinon utilise un emplacement libre.
- Refuse l'opération si le sac est absent ou plein.
- Enregistre l'interaction dans un journal idempotent : une répétition identique ne crédite pas deux fois la ressource.
- Une même interaction réutilisée pour une autre source, ressource ou quantité est refusée.
- L'ajout et le journal sont écrits dans une transaction PostgreSQL unique.

## Limites volontaires

Ce service est une brique d'inventaire, pas encore un système de récolte du monde. Il ne choisit aucun emplacement, biome, espèce, ressource disponible, quantité récoltable, outil, difficulté, durée, fréquence de renouvellement ou règle écologique. Ces données devront venir du futur résolveur du monde, à partir des règles canoniques d'Etheria.

Le service n'est pas encore appelé par une interaction Discord. La collecte scénarisée déjà présente dans la première quête reste inchangée. Les migrations `0017_resource_collection_events.sql`, `0018_traceable_item_lots.sql` et `0019_enforce_item_lot_totals.sql` doivent être appliquées avant l'utilisation de ces services raccordés ; aucune de ces migrations n'a été exécutée sur Supabase.


## Raccordement au futur moteur du monde

Le module `world/resource-collection-contract.ts` définit maintenant le contrat entre le monde et l'inventaire :

- `WorldResourceCollectionResolver` doit retrouver la position courante du personnage depuis les données serveur, sans recevoir de coordonnées fournies par Discord.
- `resolveAndLockAvailableSource` doit identifier une source réellement disponible et la verrouiller dans la transaction.
- Le résolveur fournit le code d'objet et la quantité déterminés par les règles canoniques du monde.
- `collectWorldResource` crédite le sac, consomme la source et valide le journal dans une transaction PostgreSQL unique.
- En cas de sac plein, de source indisponible ou d'échec pendant la consommation, toute l'opération est annulée.
- Une interaction répétée est reconnue avant de consulter à nouveau le monde, même si la source a été épuisée depuis.

Aucun résolveur concret, emplacement, biome, ressource, outil, quantité, difficulté, durée ou rythme de renouvellement n'est fourni par ce contrat. Ces données et règles restent à définir dans les systèmes géographique et écologique. Aucune interaction Discord de collecte n'est encore exposée.
