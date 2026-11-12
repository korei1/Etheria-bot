# Première séquence d'exploration : réveil et vent

## Parcours jouable

Le premier écran après confirmation du personnage propose deux actions Discord :
- Écouter le vent.
- Observer autour de soi.

Écouter le vent fait progresser la scène : le personnage perçoit mieux le souffle et peut en suivre la direction. Observer reste une action libre et ne force pas la progression.

Après avoir perçu le vent, le joueur peut :
- Suivre le vent.
- Continuer à observer.

Suivre le vent conduit au point de vue au bord de la falaise. Le personnage distingue mieux le paysage alentour. Un passage naturel permet de descendre, mais le joueur n'est pas forcé de se précipiter. Il peut examiner le passage ou observer le paysage.

## Persistance

- La scène courante est enregistrée dans `character_exploration_progress`.
- Chaque action Discord est enregistrée dans `character_exploration_events`.
- L'identifiant de l'interaction Discord sert de clé d'idempotence.
- Les jalons « vent perçu » et « point de vue atteint » sont ajoutés à « Suivre le vent » dans la même transaction que l'action d'exploration.
- La progression est initialisée avec la création confirmée du personnage.
- Le lieu géographique d'apparition n'est jamais consulté ou retourné par ce module.

## Limites actuelles

Cette première tranche s'arrête au point de vue au bord de la falaise. La descente, la découverte du sac et la collecte des premières ressources seront raccordées dans les étapes suivantes, avec les règles de terrain et d'inventaire déjà définies.
