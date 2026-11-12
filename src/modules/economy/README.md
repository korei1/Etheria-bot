# Pont économique Sweet Tea Economy

## Source de vérité

Les Teas ne sont pas stockés dans Etheria. La source de vérité est le module SCNX **Sweet Tea Economy** de The Sweet Tea :

- `wallet` : portefeuille individuel en Teas ;
- `bank-balance` : compte bancaire individuel, distinct du portefeuille ;
- `history` : historique individuel des transactions.

Etheria utilise uniquement le portefeuille `wallet` pour les opérations de jeu. Le compte bancaire n'est jamais modifié par ce pont. Les comptes sont liés par le snowflake Discord du membre, identique à `account_identities.provider_user_id` lorsque `provider = 'discord'`.

## Adaptation SCNX

Le module possède les structures additives suivantes :

- `etheria-wallet-request` : forme de la demande entrante ;
- `etheria-wallet-response` : forme de la réponse ;
- `etheria-operation-locks` : champ STRING indexé par clé, utilisé comme verrou atomique par identifiant d'opération ;
- `etheria-operation-results` : résultats conservés dans une table de correspondance par identifiant d'opération.

Les champs économiques historiques, les soldes et les commandes existantes n'ont pas été modifiés.

## Flow SCNX créé

Le flow **Etheria — pont de portefeuille Sweet Tea** est enregistré dans le module :

- ID : `394760fb-753d-4956-8536-e8576682686c`
- Révision : 2
- État : brouillon désactivé
- [Ouvrir le flow dans SCNX](https://scnx.app/guild/1568943152067514388/bot/custom-commands/modules/72af5a51-2118-484b-84cc-a811938615ba/394760fb-753d-4956-8536-e8576682686c)

Il traite les opérations `balance`, `credit` et `debit`. Il vérifie que le snowflake correspond à un membre du serveur, initialise uniquement un portefeuille absent à 100 Teas comme les commandes Sweet Tea existantes, utilise une incrémentation atomique pour les crédits et un débit atomique conditionné par le solde disponible. Les crédits et débits réussis ajoutent une transaction à `history`. Les réponses finales sont enregistrées par `operationId`.

Le verrou empêche une même demande de crédit ou débit d'être exécutée deux fois. Une répétition après la fin de l'opération reçoit la réponse mémorisée. Si une seconde demande arrive pendant qu'une première est encore en cours et que son résultat n'est pas encore enregistré, elle reçoit `DUPLICATE_CONFLICT` sans modifier le portefeuille. Si une exécution s'arrête après avoir acquis le verrou, celui-ci reste volontairement bloqué : il faut vérifier et réconcilier l'opération avant toute intervention manuelle. Aucun rejeu automatique n'est autorisé.

## Contrat HTTP

Le client TypeScript `SweetTeaEconomyClient` envoie une requête POST HTTPS avec l'en-tête `x-etheria-secret`.

Corps :

```json
{
  "operationId": "UUID",
  "operation": "balance | credit | debit",
  "discordUserId": "snowflake Discord",
  "amount": 25,
  "reasonCode": "etheria_reason"
}
```

- `amount` est absent pour `balance` et doit être un entier strictement positif pour `credit` et `debit`.
- `reasonCode` est facultatif à ce stade.
- La réponse contient le même `operationId`, `success`, `walletBalance` et, en cas de refus, `errorCode`.

Codes d'erreur possibles : `INSUFFICIENT_FUNDS`, `INVALID_MEMBER`, `INVALID_AMOUNT`, `INVALID_OPERATION`, `DUPLICATE_CONFLICT`.

## Configuration manuelle restante dans SCNX

Le connecteur SCNX peut créer et valider les flows et les structures de stockage, mais ne peut pas créer l'intégration entrante sur la page Integrations. Pour terminer la configuration :

1. Dans SCNX, ouvrir **Integrations** et créer un webhook entrant nommé exactement `etheria-wallet-bridge`.
2. Activer l'attente d'une réponse (mode Respond / réponse attendue).
3. Configurer l'authentification par secret header avec le nom `x-etheria-secret`.
4. Ouvrir le flow ci-dessus et remplacer `REPLACE_WITH_SHARED_SECRET` dans le filtre du déclencheur par le même secret.
5. Enregistrer l'URL du webhook et le secret uniquement dans les variables d'environnement privées du bot : `SWEET_TEA_ECONOMY_WEBHOOK_URL` et `SWEET_TEA_ECONOMY_SHARED_SECRET`.
6. Lancer un test de consultation, puis un petit crédit et un petit débit sur un compte de test. Vérifier le portefeuille et l'historique dans SCNX.
7. N'activer le flow qu'après ces vérifications.

Ne jamais publier le secret, l'URL du webhook ou un solde de test dans un salon Discord, le dépôt GitHub ou les journaux applicatifs.

## Sécurité et limites

- Le flow reste désactivé tant que l'authentification et le webhook ne sont pas configurés.
- Le client refuse HTTP, les URL contenant des identifiants, les UUID ou snowflakes invalides, les montants incorrects et les réponses incohérentes.
- En cas d'indisponibilité SCNX, Etheria n'effectue aucun repli vers un portefeuille TEAS local.
- Aucun compte bancaire n'est crédité ou débité par les opérations Etheria.
- Les migrations PostgreSQL des lots d'objets sont indépendantes de ce pont économique.
