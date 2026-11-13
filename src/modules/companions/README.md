# Compagnons Etheria

Ce module contient les règles métier communes des compagnons, indépendantes de Discord et de la base de données.

## Règles canoniques intégrées

- Sept raretés : Commun, Peu commun, Rare, Très rare, Épique, Légendaire, Mythique.
- Huit éléments : Eau, Feu, Électrique, Terre, Air, Magie, Psy, Ombre.
- Seules les espèces achetables dans la boutique Discord permettent au joueur de choisir l'élément. Pour toutes les autres espèces, l'élément est imposé par l'espèce.
- Un tableau élémentaire commun sert aux combats et à la reproduction.
- Les relations de faiblesse validées sont Eau→Feu, Feu→Terre, Terre→Électrique, Électrique→Eau, Air→Ombre, Magie→Ombre et Psy→Magie. Ombre et Psy restent équilibrés.
- En reproduction, les compagnons doivent être de la même espèce. La santé, la maturité et les conditions particulières de l'espèce doivent être suffisantes.
- Les combinaisons élémentaires incompatibles sont refusées sauf lorsque l'exception de rareté importante s'applique.
- La limite est de quatre compagnons d'une même espèce par joueur, quel que soit le canal d'acquisition : boutique, adoption, reproduction ou échange.\n- Le compagnon acheté avant le début de l'aventure observe le personnage sans se montrer ; il le rejoint lors de sa première sortie en pleine nature après l'arrivée au village, à partir du niveau 4.

## Précaution sur la règle de rareté

Le seuil Rare (troisième rang) est validé pour l'exception de choix libre des combinaisons élémentaires. Le contexte ne précise pas encore si ce seuil doit être vérifié sur un parent, sur les deux parents ou sur la descendance. Le moteur reçoit donc un booléen explicite `freeCombinationAllowed` au lieu de choisir arbitrairement une interprétation.

## Non défini volontairement

- Aucun multiplicateur de dégâts ou calcul de combat n'est inventé à partir des relations de faiblesse.
- Aucun seuil chiffré de santé ou de maturité n'est ajouté.
- Aucun catalogue d'espèces, stock de boutique ou règle de réapprovisionnement n'est créé ici.
- Les conditions particulières de reproduction restent fournies par la fiche de chaque espèce.
- Les variantes héréditaires, capacités hybrides et évolutions nécessitent leurs propres règles canoniques.

Ce fichier pose des fonctions pures testables. Il ne crée aucune table SQL et ne modifie aucune donnée distante.
