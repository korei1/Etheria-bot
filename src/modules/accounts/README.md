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

## Portefeuille Etheria

La décision actuelle est que l'économie d'Etheria est gérée par Etheria, indépendamment de SCNX.

- PostgreSQL est la source de vérité des soldes et des transactions.
- `wallets` contient le portefeuille d'un compte pour une monnaie.
- `currency_transactions` conserve le journal des mouvements.
- Le code de monnaie initial est `TEAS`.
- Discord, le futur site et l'application utiliseront le même portefeuille via les services du backend.

Le compte de jeu et le portefeuille sont deux responsabilités distinctes. À ce stade, `getOrCreateAccount` ne crée pas encore de portefeuille. Le service économique devra définir explicitement la création du portefeuille et son solde initial, sans créer de second portefeuille par interface.

## Ancienne intégration SCNX

L'ancien pont Sweet Tea Economy / SCNX n'est plus l'architecture économique retenue. Il ne doit pas être configuré, activé ou utilisé comme source de vérité pour Etheria.

Le client `SweetTeaEconomyClient` et les documents associés sont des éléments hérités à retirer ou remplacer dans une évolution dédiée. Ils ne doivent pas être utilisés par les nouveaux parcours économiques.

## Préconditions techniques

- Le socle de base de données `0001_initial_core.sql` est présent sur le projet Supabase inspecté, mais n'est pas enregistré dans l'historique distant des migrations.
- Le service doit être appelé côté serveur avec un pool PostgreSQL privé. Ne jamais exposer la connexion PostgreSQL ni un secret de service au navigateur.
- Les politiques RLS et l'architecture d'accès API devront être vérifiées avant d'exposer des données à un client web.
- Les migrations suivantes doivent être examinées et appliquées de façon contrôlée avant d'utiliser les tables de jeu correspondantes.
