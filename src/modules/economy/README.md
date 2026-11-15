# Module Économie Etheria

## Source de vérité

Etheria possède son propre système économique. SCNX n'est pas requis pour gérer la monnaie, les portefeuilles ou les transactions du jeu.

- **Base de données :** PostgreSQL via le projet Supabase d'Etheria.
- **Autorité économique :** le backend Etheria.
- **Monnaie :** `TEAS`.
- **Portefeuille :** table `wallets`.
- **Journal des mouvements :** table `currency_transactions`.

Le bot Discord, le futur site et l'application doivent utiliser les mêmes services backend. Aucune interface ne modifie directement un solde et aucun portefeuille concurrent ne doit être créé par interface.

## Opérations prévues

Le service économique doit prendre en charge :

- consultation du solde ;
- crédit et débit ;
- achats et ventes ;
- récompenses ;
- transferts entre joueurs, selon les règles qui seront validées ;
- consultation de l'historique.

Ces opérations sont des objectifs d'implémentation. Elles ne sont pas toutes disponibles dans le code actuel.

## Garanties requises

1. Toutes les opérations sont exécutées côté serveur dans des transactions PostgreSQL atomiques.
2. Un débit est refusé si le solde est insuffisant.
3. Le changement de solde et l'écriture du journal sont atomiques.
4. Chaque opération possède une clé d'idempotence pour éviter les doubles mouvements.
5. L'historique n'est pas réécrit : une correction passe par une opération compensatrice.
6. Les permissions sont vérifiées côté backend.
7. Les secrets restent dans les variables privées de l'hébergeur et ne sont jamais enregistrés dans Git.

## État du code

- Les tables `wallets` et `currency_transactions` existent sur la base distante et sont vides.
- Le code de monnaie `TEAS` est présent dans la table `currencies`.
- Le service économique PostgreSQL reste à implémenter.
- Le service de création de compte ne crée pas encore de portefeuille.
- La création du portefeuille et la règle du solde initial restent à définir avant implémentation.
- Les tests d'intégration doivent couvrir les crédits, débits, refus de solde insuffisant, répétitions idempotentes et transactions concurrentes.

## Ancienne intégration SCNX

Le pont Sweet Tea Economy / SCNX est une ancienne piste abandonnée. Il ne doit pas être configuré ou activé.

Les éléments hérités suivants sont à retirer ou remplacer dans une évolution de code dédiée :

- `SweetTeaEconomyClient` ;
- `SWEET_TEA_ECONOMY_WEBHOOK_URL` ;
- `SWEET_TEA_ECONOMY_SHARED_SECRET` ;
- les instructions de configuration du webhook SCNX ;
- les tests qui valident uniquement le transport vers ce webhook.

Aucun solde SCNX ne doit être synchronisé ou importé automatiquement. La base Etheria reste la source de vérité de la nouvelle économie. Le serveur étant encore en phase de tests sans membres, aucune migration de soldes de joueurs n'est prévue à ce stade.

## Sécurité de la base

RLS est activé sur les six tables de base actuellement présentes, mais aucune politique n'est définie. Les accès depuis les clients ne doivent pas être ouverts avant la conception et les tests des politiques. Le backend doit conserver la responsabilité des opérations économiques.
