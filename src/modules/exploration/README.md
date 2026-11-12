# Première séquence d'exploration et de survie

## Parcours jouable

1. **Réveil** : le personnage ouvre les yeux seul dans la nature. Le lieu exact reste inconnu.
2. **Percevoir le vent** : il peut écouter le vent ou observer les alentours.
3. **Suivre le vent** : il atteint un point de vue au bord d'une falaise.
4. **Examiner ou descendre** : le passage naturel peut être examiné avant que le joueur choisisse de descendre.
5. **Découvrir le sac** : au pied de la falaise, le personnage trouve un sac tressé de cinq emplacements.
6. **Découvrir les baies** : des baies locales poussent à proximité. Le personnage ne connaît ni leur nom ni leurs propriétés.
7. **Première collecte** : il peut recueillir un échantillon non identifié, qui occupe un emplacement du sac.
8. **Trouver une source d'eau** : en poursuivant l'exploration, il découvre une source. Un animal qui s'y abreuvait s'éloigne à son arrivée.
9. **Boire** : il recueille de l'eau dans ses mains et boit. La soif est restaurée entièrement.
10. **Réunir des plantes** : il collecte des plantes souples à proximité pour apprendre à les tresser.
11. **Fabriquer la gourde** : il transforme les plantes réunies en une gourde tressée de niveau 1.
12. **Chercher un abri** : le jour décline, le vent se renforce et le froid s'installe. Le personnage repère une grotte.
13. **Entrer dans la grotte** : il s'y installe temporairement pour se protéger du vent et du froid.
14. **Allumer un feu** : le feu apporte chaleur et lumière. La maîtrise du feu atteint le niveau 1 et la cuisine est déverrouillée.
15. **Faire rôtir les baies** : le premier échantillon de baies est transformé en baies rôties dans l'inventaire.
16. **Se réveiller au matin** : après la première nuit dans la grotte, le personnage sort et observe les environs.
17. **Découvrir les ruines** : il repère des vestiges d'anciennes constructions à proximité.
18. **Explorer les vestiges** : il trouve un fragment historique non identifié et le range dans son sac.
19. **Retourner à la grotte** : il revient à son abri et y établit son premier camp temporaire.

## Besoins vitaux

- La base stocke séparément la soif et la faim sur une échelle de 0 à 100.
- La création initialise les deux besoins à 100.
- Boire à la source restaure la soif à 100.
- Le moteur qui fait évoluer les besoins avec le temps réel/temps Etheria n'est pas encore raccordé. Aucune vitesse de diminution n'est inventée dans cette tranche.
- La faim reste suivie, mais aucune consommation ou valeur de nourriture n'est simulée ici.

## Inventaire et gourde

- Le sac est découvert dans l'environnement, au pied de la falaise.
- Il possède cinq emplacements et est équipé automatiquement.
- Le premier échantillon de baies utilise un code technique neutre, sans attribuer de nom fictif à une espèce.
- Les plantes souples occupent un emplacement pendant la fabrication.
- La fabrication transforme cet emplacement en objet `woven_canteen_level_1`, sans créer artificiellement un emplacement supplémentaire.
- La capacité de la gourde de niveau 1 correspond à l'équivalent de deux mains jointes remplies d'eau.
- Cette quantité suffit à restaurer entièrement la soif.
- Le système de remplissage, de transport et de consommation d'eau depuis l'inventaire reste à raccorder au moteur général des besoins et des objets.
- Le premier feu enregistre la maîtrise du feu au niveau 1 et déverrouille la fonctionnalité de cuisine.
- La cuisson transforme l'échantillon `unidentified_local_berries` en `roasted_local_berries`, sans changer le nombre d'emplacements occupés.
- La valeur nutritionnelle des baies rôties n'est pas chiffrée tant que le catalogue alimentaire et le système nutritionnel ne sont pas définis.
- La grotte est enregistrée comme abri temporaire. Aucun animal n'y est ajouté.
- Le mécanisme matériel d'allumage du feu n'est pas encore modélisé : aucune recette ni ressource d'allumage n'a été inventée.
- Le réveil après la première nuit est une étape persistante distincte.
- Les ruines sont découvertes à proximité de l'abri, sans nom de lieu, civilisation ou date inventés.
- L'exploration ajoute un fragment historique non identifié dans un emplacement du sac. Aucun contenu historique précis n'est révélé ni inventé à ce stade.
- Le fragment est un objet transportable et reste dans l'inventaire du personnage.
- Le retour à la grotte enregistre un camp temporaire associé au personnage dans `character_temporary_camps`. Il ne crée pas une propriété permanente ni un service public.
- La migration `0014_morning_ruins_and_temporary_camp.sql` autorise les scènes du lendemain matin dans la contrainte SQL, ajoute leurs jalons temporels et crée la table de persistance du camp.

## Stockage physique du camp

- Le stockage du camp est distinct du sac porté.
- Il n'est consultable, modifiable ou accessible que lorsque le personnage se trouve réellement dans la scène du camp temporaire.
- Les objets déposés sont retirés du sac porté dans la même transaction que leur ajout au stockage.
- Le retrait vérifie la place disponible dans le sac porté et remet l'objet dans celui-ci.
- La première intégration accepte le fragment historique non identifié, objet trouvé et non fabriqué. La liste sera étendue avec le catalogue canonique des objets.
- Aucun sac, coffre ou stockage à distance n'est accessible depuis une autre zone.
- Depuis l'interface Discord du camp, le joueur peut ouvrir un panneau privé, déposer le fragment historique non identifié ou le reprendre. Les opérations vérifient le lieu courant et la capacité du sac.

## Persistance et intégrité

- La scène courante est enregistrée dans `character_exploration_progress`.
- Chaque action Discord est enregistrée dans `character_exploration_events`.
- L'identifiant de l'interaction Discord sert de clé d'idempotence.
- Le sac, les objets, les besoins vitaux et les jalons de quête sont enregistrés dans des transactions.
- Le lieu géographique d'apparition n'est jamais lu ou retourné par ce module.
- Le module ne contient aucun nom de lieu ou d'espèce botanique inventé.

## Limites actuelles

Le camp est enregistré comme installation temporaire. Le stockage physique minimal des objets trouvés non fabriqués est maintenant prévu par la migration 0015, son service et son interface Discord ; il n'est accessible que depuis la scène du camp. Les améliorations et aménagements restent à programmer. Aucune recette, ressource de construction ou nouvelle plante n'est ajoutée sans définition canonique. Le système de besoins est un socle persistant : la diminution de la soif et de la faim selon le temps écoulé reste à programmer. La source d'eau, les plantes, la grotte et les ruines sont encore des événements narratifs de cette première séquence, en attente du raccordement au monde géographique et aux catalogues écologiques/historiques. Le remplissage de la gourde et l'usage général des contenants restent à programmer. Le cycle temporel réel, les ressources nécessaires pour allumer le feu et les effets nutritionnels chiffrés de la cuisson restent à définir. Le fragment historique n'a pas encore de contenu déchiffrable défini.
