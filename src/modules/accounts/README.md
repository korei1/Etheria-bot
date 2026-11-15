# Module Comptes

Ce module rattache le compte de jeu Etheria à l'identité Discord du membre de The Sweet Tea.

## Identité commune

`getOrCreateAccount(pool, input)` :

- retrouve un compte via le couple fournisseur + identifiant externe ;
- pour Etheria sur Discord, utilise `provider: "discord"` et le snowflake Discord du membre comme `providerUserId` ;
- crée un compte central et son profil lors de la première inscription ;
- actualise le nom d'affichage et la date de dernière présence lors des connexions suivantes ;
- regroupe les opérations dans une transaction PostgreSQL ;
- protège les inscriptions simultanées pour une même identité.

La contrainte unique `(provider, provider_user_id)` empêche la création de plusieurs comptes Etheria pour le même membre Discord. Tous ses personnages et ses données de jeu dépendent du même `account_id`.

Exemple d'entrée Discord :

```ts
const account = await getOrCreateAccount(pool, {
  provider: "discord",
  providerUserId: discordUser.id,
  displayName: discordUser.globalName ?? discordUser.username
});
```

Le service ne dépend pas de discord.js. Le futur site et l'application devront retrouver le même compte membre via une identité liée de manière sécurisée, sans créer un deuxième compte de jeu.

## Portefeuille de Teas : règle de source de vérité

Les Teas des membres restent ceux du module personnalisé **Sweet Tea Economy** de SCNX. Les champs utilisateur existants comprennent notamment `wallet`, `bank-balance` et `history`.

Etheria ne doit pas créer un portefeuille TEAS concurrent, attribuer un nouveau solde de départ ou réinitialiser les données de Sweet Tea Economy.

En conséquence, `getOrCreateAccount` ne crée plus de ligne dans `wallets`. Les tables historiques `wallets` et `currency_transactions` issues de la migration initiale restent présentes, mais ne constituent pas la source de vérité des Teas partagés et ne doivent pas être utilisées pour les opérations économiques.

## Pont d'intégration restant

Le stockage utilisateur de SCNX et la base PostgreSQL d'Etheria sont deux stockages distincts. Le partage effectif du solde entre Sweet Tea Economy et Etheria nécessite un pont sécurisé et idempotent, utilisant le snowflake Discord du membre comme identité commune.

Tant que ce pont n'est pas implémenté et testé, Etheria ne doit pas afficher, créditer ou débiter un solde TEAS indépendant. Les données existantes de Sweet Tea Economy ne doivent pas être remplacées ni réinitialisées.

## Préconditions techniques

- La migration `0001_initial_core.sql` doit avoir été appliquée.
- Le service doit être appelé côté serveur avec un pool PostgreSQL privé. Ne jamais exposer la connexion PostgreSQL ni un secret de service au navigateur.
- Les politiques RLS et l'architecture d'accès API devront être vérifiées avant d'exposer des données à un client web.
