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


## Protection et conservation

Le catalogue distingue trois origines : animal réel, créature fantastique et hybride.

Pour les espèces réelles, une évaluation de conservation IUCN est facultative, mais lorsqu'elle est renseignée elle doit comporter une catégorie reconnue, une autorité, une source HTTPS et une date d'évaluation. Une protection légale n'est pas déduite de la catégorie IUCN : elle devra être documentée séparément par juridiction avant d'être ajoutée.

Pour les espèces fantastiques, le statut de conservation est propre à l'univers Etheria et reste distinct des évaluations réelles. Aucun statut n'est attribué automatiquement.

Le fichier `companion-species-candidates.ts` contient une première liste de pistes (animaux réels et créatures fantastiques). Ce sont uniquement des candidates éditoriales : elles ne sont pas jouables et ne reçoivent aucune rareté, région, habitat, élément, capacité, variante ou protection avant validation de leur fiche.

Les données écologiques réelles doivent être sourcées et datées. Les catégories de rareté Etheria, les éléments, les chances de rencontre et les règles d'acquisition restent des décisions de gameplay, pas des déductions automatiques à partir du statut de conservation réel.


## Premières fiches documentaires réelles

Le fichier `companion-species-research.ts` contient quatre dossiers documentaires sourcés :

- Loup gris (`Canis lupus`)
- Renard roux (`Vulpes vulpes`)
- Aigle royal (`Aquila chrysaetos`)
- Tortue verte (`Chelonia mydas`)

Chaque dossier conserve le nom scientifique, les habitats décrits par les sources, un résumé de répartition, des notes écologiques, la catégorie de l'évaluation mondiale IUCN, sa date, son autorité et son URL. Les sources complémentaires de l'OFB et de l'INPN sont également conservées pour la tortue verte.

**Ces dossiers sont exclusivement documentaires** (`research_only`). Ils ne définissent pas encore d'espèces jouables : rareté Etheria, élément, méthodes d'acquisition, capacités, taux de rencontre et rareté régionale restent non renseignés. Une évaluation IUCN mondiale ne doit jamais être présentée comme le statut de toutes les populations locales. Les évaluations territoriales et protections juridiques devront être enregistrées séparément, avec leur juridiction et leurs propres sources.

Les données documentaires sont séparées du catalogue de gameplay afin d'éviter de transformer accidentellement une donnée écologique réelle en règle de jeu.


### Extension des dossiers documentaires

Huit dossiers supplémentaires portent désormais le registre à douze espèces réelles :

- Loutre d'Europe (`Lutra lutra`) : évaluation mondiale quasi menacée, évaluée en 2020 et publiée en 2022.
- Cerf élaphe (`Cervus elaphus`) : évaluation mondiale préoccupation mineure, évaluée en 2015 et publiée en 2018 ; la fiche IUCN signale que cette évaluation nécessite une mise à jour.
- Hérisson d'Europe (`Erinaceus europaeus`) : évaluation mondiale quasi menacée, publiée dans la mise à jour IUCN 2024-2. La date exacte d'évaluation n'est pas fournie dans la fiche et reste donc vide.
- Lynx boréal (`Lynx lynx`) : évaluation européenne préoccupation mineure, évaluée en 2022 et publiée en 2025 ; une évaluation distincte de l'UE à 27 pays le classe quasi menacé.

Le modèle distingue désormais les périmètres global, européen, UE-27 et national. Une catégorie ne peut pas être interprétée sans son périmètre. Les dates d'évaluation absentes restent facultatives plutôt que d'être estimées.

Ces douze dossiers restent `research_only` : ils ne sont pas des espèces jouables et ne déterminent aucune règle de rareté, d'élément, de capacité ou d'acquisition Etheria.


### Deuxième extension des dossiers documentaires

Quatre dossiers supplémentaires complètent le registre à douze espèces réelles :

- Dauphin commun (`Delphinus delphis`) : évaluation mondiale préoccupation mineure, évaluée en 2020 et publiée en 2021.
- Grand requin blanc (`Carcharodon carcharias`) : évaluation mondiale vulnérable, évaluée en 2018 et publiée dans une version amendée en 2022.
- Pipistrelle commune (`Pipistrellus pipistrellus`) : évaluation mondiale préoccupation mineure, évaluée en 2019 et publiée en 2020.
- Monarque (`Danaus plexippus`) : évaluation mondiale préoccupation mineure, évaluée en 2021 et publiée en 2022. La sous-espèce migratrice `Danaus plexippus plexippus` possède une évaluation distincte en danger ; elle n'est pas fusionnée avec le statut de l'espèce entière.

Toutes ces fiches sont documentaires (`research_only`). Elles n'attribuent aucune rareté, élément, capacité, méthode d'acquisition ou fréquence de rencontre dans Etheria.

### Troisième extension des dossiers documentaires

Quatre espèces domestiques supplémentaires complètent le registre à seize dossiers :

- Chien domestique (`Canis familiaris`) : non évalué dans la Liste rouge mondiale selon la base taxonomique consultée ; les chiens féraux peuvent exercer une prédation sur la faune.
- Chat domestique (`Felis catus`) : non évalué dans la Liste rouge mondiale selon la base taxonomique consultée ; les impacts écologiques de la chasse varient selon les contextes locaux.
- Cheval domestique (`Equus caballus`) : non évalué dans la Liste rouge mondiale selon la base taxonomique consultée ; les habitats mentionnés décrivent des milieux utilisés sous domestication et par certaines populations féraux.
- Abeille mellifère (`Apis mellifera`) : la source consultée ne signale pas de statut spécial IUCN. Cette mention ne constitue pas une évaluation récente exhaustive des populations.

**Précaution taxonomique et de conservation :** « non évalué » ne signifie pas « préoccupation mineure ». Les fiches ne convertissent pas l'absence d'évaluation en diagnostic positif. Les informations écologiques sur les animaux domestiques sont également séparées des situations locales des populations féraux.

Ces quatre fiches restent `research_only`.

## Registre évolutif des espèces et régions

Le fichier `companion-species-registry.ts` sépare trois dimensions qui ne doivent pas être confondues :

- **Validation éditoriale** : `draft` ou `approved`. Une fiche approuvée reste approuvée même si son territoire est secret ou si l'espèce n'est pas encore accessible en jeu.
- **Disponibilité en jeu** : `unavailable`, `discoverable`, `available` ou `retired`. Une espèce ne peut pas devenir découvrable ou disponible avant son approbation.
- **Confidentialité géographique** : une région est `public` ou `discovery_locked`. Les espèces de cette région restent masquées tant que la région n'a pas été découverte, indépendamment de leur approbation éditoriale.

Le registre ne fixe aucune limite globale au nombre de régions, d'espèces ou de formes évolutives. Chaque espèce et chaque forme possède une clé stable ; une clé existante ne peut pas être réutilisée. Les formes évolutives sont des données ordonnées et peuvent être ajoutées sans modifier le moteur.

Une espèce retirée reste dans le registre afin que les références des compagnons déjà possédés restent résolubles ; elle n'est plus proposée aux nouvelles acquisitions. Le catalogue public ne montre que les espèces approuvées, dans les régions visibles, et dont la disponibilité est `discoverable` ou `available`.

Ce registre est une couche métier en mémoire, sans migration SQL ni intégration Discord à ce stade. La persistance et l'administration du catalogue devront être ajoutées séparément après validation de la structure et des données canoniques du bestiaire.

## Catalogue fantastique initial canonique

Le fichier `initial-fantasy-bestiary.ts` contient les 43 espèces fantastiques initiales réparties dans les sept régions :

- Sylvaria : 6 espèces.
- Nivéria : 6 espèces.
- Arcanthia : 6 espèces.
- Solméria : 6 espèces.
- Thalasséa : 7 espèces.
- Ignéria : 6 espèces, dont le Phénix de Cendre.
- Umbrelune : 6 espèces confidentielles.

Chaque fiche conserve le nom, les quatre formes et l'élément fournis dans le catalogue canonique. Umbrelune reste invisible dans le catalogue public tant que sa région n'a pas été découverte.

Les 43 espèces sont toutes officiellement approuvées et constituent le bestiaire canonique initial. La formulation historique mentionnant trois espèces de Sylvaria déjà validées ne représente pas une restriction de validation.

Ce fichier ne renseigne volontairement pas les raretés, habitats, capacités, conditions de rencontre ou méthodes d'acquisition qui ne sont pas définis dans les données canoniques. Le catalogue reste extensible : ces 43 entrées constituent uniquement la collection initiale.


### Raccordement au registre extensible

Le registre `companion-species-registry.ts` héberge désormais deux couches complémentaires :

- `editorialSpecies` contient les fiches approuvées du bestiaire, avec leur identifiant stable, leur région, leur élément et leurs formes.
- `species` contient les définitions complètes nécessaires au gameplay, lorsque rareté, méthodes d'acquisition et autres paramètres sont établis.

La fonction `createInitialFantasyBestiaryRegistry()` charge les 43 espèces et les sept régions dans la couche éditoriale. Elle ne leur attribue aucune rareté, méthode d'acquisition ou habitat par défaut. `listVisibleEditorialCompanionSpecies()` expose les fiches des régions publiques et garde les six fiches d'Umbrelune masquées jusqu'à découverte.

Les fiches éditoriales et les définitions de gameplay restent volontairement séparées : être approuvé et visible dans l'encyclopédie ne rend pas automatiquement une espèce disponible à l'achat ou à la rencontre. Les ajouts futurs utilisent le même registre sans plafond global.
