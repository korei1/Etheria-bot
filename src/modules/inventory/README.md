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

Le service n'est pas encore appelé par une interaction Discord. La collecte scénarisée déjà présente dans la première quête reste inchangée. La migration `0017_resource_collection_events.sql` doit être revue puis exécutée avant l'utilisation du service ; elle n'a pas été exécutée sur Supabase.


## Raccordement au futur moteur du monde

Le module `world/resource-collection-contract.ts` définit maintenant le contrat entre le monde et l'inventaire :

- `WorldResourceCollectionResolver` doit retrouver la position courante du personnage depuis les données serveur, sans recevoir de coordonnées fournies par Discord.
- `resolveAndLockAvailableSource` doit identifier une source réellement disponible et la verrouiller dans la transaction.
- Le résolveur fournit le code d'objet et la quantité déterminés par les règles canoniques du monde.
- `collectWorldResource` crédite le sac, consomme la source et valide le journal dans une transaction PostgreSQL unique.
- En cas de sac plein, de source indisponible ou d'échec pendant la consommation, toute l'opération est annulée.
- Une interaction répétée est reconnue avant de consulter à nouveau le monde, même si la source a été épuisée depuis.

Aucun résolveur concret, emplacement, biome, ressource, outil, quantité, difficulté, durée ou rythme de renouvellement n'est fourni par ce contrat. Ces données et règles restent à définir dans les systèmes géographique et écologique. Aucune interaction Discord de collecte n'est encore exposée.
