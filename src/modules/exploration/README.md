# Première séquence d'exploration : réveil, falaise et premières ressources

## Parcours jouable

1. **Réveil** : le personnage ouvre les yeux seul dans la nature. Le lieu exact reste inconnu.
2. **Percevoir le vent** : il peut écouter le vent ou observer les alentours.
3. **Suivre le vent** : il atteint un point de vue au bord d'une falaise.
4. **Examiner ou descendre** : le passage naturel peut être examiné avant que le joueur choisisse de descendre.
5. **Découvrir le sac** : au pied de la falaise, le personnage trouve son premier sac tressé de niveau initial, d'une capacité de cinq emplacements.
6. **Découvrir les baies** : des baies locales sont présentes à proximité. Le personnage ne connaît ni leur nom ni leurs propriétés.
7. **Première collecte** : il peut recueillir un échantillon de baies non identifiées. L'échantillon occupe un emplacement du sac.

## Inventaire initial

- Aucun objet n'est possédé au réveil.
- Le sac est découvert dans l'environnement, au pied de la falaise.
- Le sac possède cinq emplacements.
- Le premier échantillon est enregistré sous un code technique neutre, sans attribuer de nom fictif à une espèce végétale.
- Le personnage ne connaît pas les propriétés des baies.
- Le sac et son contenu sont persistants et enregistrés en base.

## Persistance et intégrité

- La scène courante est enregistrée dans `character_exploration_progress`.
- Chaque action Discord est enregistrée dans `character_exploration_events`.
- L'identifiant de l'interaction Discord sert de clé d'idempotence.
- La découverte du sac, son équipement et la validation du jalon de quête ont lieu dans la transaction de descente.
- La collecte de l'échantillon, la mise à jour de l'inventaire et le jalon de quête sont transactionnels.
- Le lieu géographique d'apparition n'est jamais lu ou retourné par ce module.

## Limites actuelles

Le premier échantillon est un objet technique générique en attente du catalogue botanique régional. La collecte répétée, l'identification des espèces, leurs propriétés et les quantités récoltables dépendront du catalogue réel des ressources et du système écologique. Aucune espèce, aucun lieu et aucune propriété botanique ne sont inventés ici.
