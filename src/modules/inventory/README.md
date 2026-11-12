# Inventaire et réception des ressources

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
