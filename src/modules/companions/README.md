# Compagnons Etheria

Ce module contient les règles métier des compagnons. Les règles pures sont indépendantes de Discord et de PostgreSQL.

## Règles d'identité, d'élément et de reproduction

- Sept raretés : Commun, Peu commun, Rare, Très rare, Épique, Légendaire, Mythique.
- Huit éléments : Eau, Feu, Électrique, Terre, Air, Magie, Psy, Ombre.
- Seules les espèces achetables dans la boutique Discord permettent au joueur de choisir l'élément. Pour toutes les autres espèces, l'élément est imposé par l'espèce.
- Un tableau élémentaire commun sert aux combats et à la reproduction.
- Les relations de faiblesse validées sont Eau→Feu, Feu→Terre, Terre→Électrique, Électrique→Eau, Air→Ombre, Magie→Ombre et Psy→Magie. Ombre et Psy restent équilibrés.
- En reproduction, les compagnons doivent être de la même espèce. La santé, la maturité et les conditions particulières de l'espèce doivent être suffisantes.
- Les combinaisons élémentaires incompatibles sont refusées sauf lorsque l'exception de rareté importante s'applique.
- La limite est de quatre compagnons d'une même espèce par joueur, quel que soit le canal d'acquisition : boutique, adoption, reproduction ou échange.
- Le compagnon acheté avant le début de l'aventure observe le personnage sans se montrer ; il le rejoint lors de sa première sortie en pleine nature après l'arrivée au village, à partir du niveau 4.

## Alimentation et repos

- Une ration gratuite est disponible toutes les 48 heures.
- Une ration restaure normalement la jauge de faim ; en cas de troubles digestifs, sa restauration est réduite de moitié.
- Un aliment acheté restaure la jauge de faim à 100 %.
- Les aliments sont réservés à la catégorie de rareté correspondante du compagnon.
- Cinq catégories de nourriture ont des prix définis : Commun 50 Teas, Peu commun 100 Teas, Rare 200 Teas, Épique 350 Teas, Exclusif 500 Teas.
- Le repos restaure 10 points d'énergie toutes les 30 minutes, ou 5 points en cas de fatigue chronique.
- L'énergie est plafonnée à 100.
- Les intervalles de repos écoulés hors ligne sont rattrapés au retour. Les intervalles incomplets sont conservés.
- Il est impossible de changer de compagnon pendant son repos ; un refus de changement ne réinitialise pas la progression du repos.

## Précaution sur la règle de rareté élémentaire

Le seuil Rare (troisième rang) est validé pour l'exception de choix libre des combinaisons élémentaires. Le contexte ne précise pas encore si ce seuil doit être vérifié sur un parent, sur les deux parents ou sur la descendance. Le moteur reçoit donc un booléen explicite `freeCombinationAllowed` au lieu de choisir arbitrairement une interprétation.

## Non défini volontairement

- Aucun multiplicateur de dégâts ou calcul de combat n'est inventé à partir des relations de faiblesse.
- Aucun taux de diminution de faim ou de soif, seuil de déshydratation, seuil de santé, durée de maladie ou effet supplémentaire n'est ajouté.
- Le mapping exact entre rareté d'espèce et catégorie de nourriture doit provenir du catalogue validé.
- Les conditions particulières de reproduction restent fournies par la fiche de chaque espèce.
- Les variantes héréditaires, capacités hybrides et évolutions nécessitent leurs propres règles canoniques.

Les fonctions de soin sont pures et testables. Elles ne créent aucune table SQL, ne débitent aucun portefeuille et ne modifient aucune donnée distante.


## Catalogue des espèces et profils individuels

Le fichier `companion-species-catalog.ts` fournit le contrat du catalogue :

- Une espèce possède une clé technique stable, un nom, une catégorie, une rareté et ses méthodes d'acquisition.
- Les catégories disponibles couvrent les espèces terrestres, aquatiques, volantes, reptiles/amphibiens, insectes/arthropodes, fantastiques, végétales/élémentaires, esprits/magiques, artificielles et hybrides.
- Une espèce achetable dans la boutique Discord autorise le choix de l'élément et ne déclare pas d'élément fixe.
- Toute autre espèce doit déclarer son élément fixe.
- Chaque espèce peut définir ses caractéristiques individuelles descriptives : texte, choix parmi des valeurs validées ou booléen.
- Le validateur refuse les clés dupliquées, les catégories/raretés/méthodes inconnues, les configurations élémentaires incohérentes et les caractéristiques individuelles non autorisées.

Aucune espèce concrète n'est préremplie : leurs noms, raretés, éléments, méthodes d'acquisition et caractéristiques doivent être confirmés avant d'entrer dans le catalogue. Les caractéristiques individuelles sont descriptives et n'accordent aucun bonus de gameplay tant que leurs effets ne sont pas définis séparément.


## Répartition régionale et variantes naturelles

Le catalogue prend également en charge les décisions déjà validées pour la diversité des espèces :

- Une espèce peut exister dans plusieurs régions et habitats.
- Sa rareté peut varier selon le couple région/habitat ; en l'absence d'occurrence exacte, sa rareté générale de référence s'applique.
- Les variantes naturelles possibles sont chromatiques, morphologiques, régionales, climatiques et génétiques.
- Les règles de transmission sont définies séparément pour chaque espèce.
- Une combinaison parentale ne produit une variante que si une règle explicite la décrit. Le code ne suppose aucun taux de transmission ni caractère dominant/récessif.
- Le catalogue accepte des espèces animales existantes aussi bien que des créatures fantastiques, sans limiter le monde à l'une de ces familles.

Les fiches d'espèces réelles ou fantastiques restent à renseigner avec leurs habitats, répartitions et variantes vérifiés. Aucune espèce, répartition ou capacité n'est inventée dans le catalogue par défaut.
