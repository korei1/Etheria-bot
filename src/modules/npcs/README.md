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


## Présence des PNJ selon l'heure locale

- Chaque placement en zone de départ ou en localité possède un champ éditorial `presence_schedule` au format du calendrier hebdomadaire Etheria.
- `NULL` conserve le comportement antérieur : le PNJ est disponible sans restriction horaire.
- Un calendrier configuré est évalué avec le jour et la minute locale de la localité, via l'horloge mondiale commune et le fuseau approuvé.
- La liste `/etheria rencontrer` filtre les PNJ hors de leurs créneaux ; le démarrage d'une conversation revalide également la présence pour éviter de contourner le filtre.
- Les bornes d'intervalles suivent la règle [ouverture, fermeture[ : l'heure d'ouverture est incluse, l'heure de fermeture exclue.
- Si un calendrier est configuré mais qu'aucune heure locale fiable n'est disponible, le PNJ n'est pas proposé. Les zones de départ n'ont pas encore de fuseau attribuable : leurs PNJ sans calendrier restent disponibles, ceux avec calendrier restent masqués jusqu'à prise en charge du fuseau de la zone.
- Aucun PNJ, horaire ou dialogue n'est préchargé. La migration 0033 ajoute les champs, mais elle n'a pas été exécutée.
- L'interface d'administration pour modifier ces calendriers reste à ajouter ; pour l'instant, les champs sont prêts côté base et service, sans commande joueur permettant de les modifier.
