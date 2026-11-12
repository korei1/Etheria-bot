# Pont économique Sweet Tea Economy

## Source de vérité

Les Teas ne sont pas stockés dans Etheria. La source de vérité est le module SCNX **Sweet Tea Economy** de The Sweet Tea :

- `wallet` : portefeuille individuel en Teas ;
- `bank-balance` : compte bancaire individuel, distinct du portefeuille ;
- `history` : historique individuel des transactions.

Etheria utilise le portefeuille `wallet` uniquement pour ses opérations de jeu. Le compte bancaire n'est pas modifié par ce pont. Les comptes sont liés par le snowflake Discord du membre, identique à `account_identities.provider_user_id` lorsque `provider = 'discord'`.

## Adaptation SCNX ajoutée

Le module Sweet Tea Economy possède maintenant, en plus de ses champs existants :

- `etheria-wallet-request` : forme de la demande entrante ;
- `etheria-wallet-response` : forme de la réponse ;
- `etheria-operation-locks` : champ STRING indexé par clé, utilisé comme verrou atomique par identifiant d'opération ;
- `etheria-operation-results` : résultats conservés par identifiant d'opération.

Ces ajouts sont uniquement additifs. Les champs économiques existants, les soldes et les commandes existantes n'ont pas été modifiés.

## Contrat HTTP

Le client `SweetTeaEconomyClient` envoie une requête POST HTTPS avec l'en-tête `x-etheria-secret`.

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

Réponse :

```json
{
  "operationId": "même UUID",
  "success": true,
  "walletBalance": 475
}
```

Pour un refus de débit, `success` vaut `false` et `errorCode` vaut `INSUFFICIENT_FUNDS`. Le solde retourné reste le solde réel du portefeuille Sweet Tea.

## Règles obligatoires du flow SCNX à configurer

Le webhook doit être créé sur la page Integrations SCNX en mode **Respond**, avec vérification par **Secret header** sur `x-etheria-secret`. Le secret doit être configuré côté SCNX et dans l'environnement privé du bot ; il ne doit jamais être inscrit dans le code, un message Discord ou une URL.

Le flow du module doit :

1. Configurer le déclencheur Webhook avec le champ Body shape = `etheria-wallet-request` (identifiant de la forme, sans préfixe `RECORD:`), puis lire la sortie Body.
2. Vérifier le type d'opération, le UUID, le snowflake Discord et le montant.
3. Utiliser `atomic-set-if` sur `etheria-operation-locks`, clé = `operationId`, condition ABSENT, valeur `processing`. Si le verrou n'est pas obtenu, ne jamais refaire l'opération : renvoyer le résultat déjà enregistré ou une réponse de conflit si elle est encore en cours.
4. Vérifier le membre avec son identifiant Discord avant de toucher son portefeuille.
5. Pour un portefeuille absent, appliquer la même initialisation que les commandes Sweet Tea existantes : 100 Teas. Ne jamais réinitialiser un portefeuille déjà présent.
6. Pour `balance`, lire `wallet` avec le défaut 100.
7. Pour `credit`, utiliser l'action d'incrément sur `wallet`.
8. Pour `debit`, utiliser `atomic-increment-if` avec condition GTE et une variation négative, afin qu'un solde insuffisant ne soit jamais débité.
9. Pour un crédit ou un débit réussi, ajouter une entrée à l'historique individuel `history`, avec le montant signé, le motif, le solde après opération et la date. Cet ajout doit rester dans la branche qui a obtenu le verrou.
10. Enregistrer le résultat sous `operationId` dans `etheria-operation-results`, puis marquer le verrou `done`.
11. Répondre en JSON avec le même `operationId`, le booléen `success`, le solde réel et, si nécessaire, un code d'erreur.

**Règle de sécurité en cas d'incident :** si le flow s'arrête après avoir posé le verrou `processing`, une répétition ne doit jamais rejouer automatiquement le débit ou le crédit. L'opération doit être vérifiée et réconciliée manuellement avant de libérer le verrou.

## État d'intégration

Le client TypeScript et les champs SCNX sont en place. Le webhook Respond et son flow ne sont pas encore configurés, car le connecteur SCNX ne permet pas de créer le point d'entrée webhook lui-même. Il faut créer le webhook dans l'interface SCNX, puis sélectionner ce webhook dans le déclencheur du flow. Aucun secret ni URL de webhook n'est encore enregistré dans le dépôt.

Le client refuse HTTP, les URL contenant des identifiants, les réponses invalides et les erreurs réseau. Il n'effectue aucun repli vers un portefeuille Etheria local.
