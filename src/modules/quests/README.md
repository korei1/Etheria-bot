# Module de quêtes

## Quête initiale : Suivre le vent

Chaque personnage confirmé reçoit automatiquement une progression active de la quête « Suivre le vent », initialisée sur le jalon technique `reveil`.

La scène d'ouverture est envoyée après confirmation du personnage. Elle ne révèle ni le pays ni le lieu exact d'apparition.

## Progression événementielle

Le module ne déduit pas les réussites à partir de clics Discord. Les futurs systèmes de survie, artisanat, agriculture, exploration, village et compagnons devront appeler le service de jalons uniquement après avoir validé l'action correspondante.

Le service :
- conserve la progression dans `character_quest_progress` ;
- conserve l'historique dans `character_quest_events` ;
- rend les jalons idempotents ;
- expose la progression active via `getActiveQuestProgress`.

## Intégration PNJ déjà raccordée

La première rencontre PNJ validée appelle `recordNpcEncounter`. Cette fonction :
- enregistre la rencontre ;
- révèle le lieu d'apparition ;
- enregistre le jalon `premiere_rencontre_pnj` ;
- effectue ces opérations dans une seule transaction PostgreSQL.

Le moteur de rencontre réel doit encore être construit. Il sera le seul à pouvoir appeler `recordNpcEncounter` après validation de la scène.

## Étapes restantes

Les jalons des actions intermédiaires de la quête et sa conclusion doivent être raccordés à leurs systèmes respectifs. Le suivi technique ne prétend pas encore gérer ces scènes ni leurs choix interactifs.
