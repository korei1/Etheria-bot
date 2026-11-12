# Module PNJ : rencontres et première découverte

## Règle de jeu

Le lieu d'apparition du personnage est connu du moteur, mais reste caché au joueur au début de l'aventure. Il est révélé après sa première rencontre effective avec un PNJ.

La révélation n'est pas déclenchée par l'ouverture d'un menu, un bouton arbitraire ou la simple proximité d'un PNJ. Elle intervient uniquement lorsque le système de jeu a validé une rencontre.

## Contrat technique

Le gestionnaire de quête, d'exploration ou de rencontre devra appeler :

`recordNpcEncounter(pool, { encounterId, accountId, characterId, npcKey })`

- `encounterId` : UUID stable pour cette rencontre validée. Il sert à rendre les relances techniques idempotentes.
- `accountId` et `characterId` : identifient le personnage actif concerné.
- `npcKey` : identifiant technique stable du PNJ. Aucun nom ou PNJ canonique n'est présupposé ici.

## Comportement

- Enregistre la rencontre dans `npc_encounters`.
- Détermine si c'est la première rencontre du personnage.
- À la première rencontre, enregistre le PNJ, l'horodatage et la révélation du lieu dans la même transaction.
- Retourne les informations de la zone de départ uniquement pour la première rencontre.
- Les rencontres suivantes sont enregistrées sans révéler à nouveau le lieu.
- Une répétition du même `encounterId` retourne le résultat initial sans créer de doublon.
- Le lieu n'est jamais ajouté aux réponses générales du personnage.

## État de l'intégration

Le service d'enregistrement de rencontre est implémenté et raccordé au suivi de la quête « Suivre le vent » : la première rencontre valide le jalon correspondant dans la même transaction que l'enregistrement de la rencontre et la révélation du lieu. Le moteur d'exploration et les scènes PNJ qui certifieront qu'une rencontre a réellement eu lieu restent à construire. Aucun faux bouton de rencontre n'est ajouté pour contourner cette règle.
