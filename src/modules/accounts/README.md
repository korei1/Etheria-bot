# Module Comptes

Ce module gère les comptes Etheria indépendamment de Discord.

## Service disponible

`getOrCreateAccount(pool, input)` :

- retrouve un compte via le couple fournisseur + identifiant externe ;
- crée un compte central et son profil lors de la première inscription ;
- crée le portefeuille initial en Teas ;
- actualise le nom d'affichage et la date de dernière présence lors des connexions suivantes ;
- regroupe les opérations dans une transaction PostgreSQL ;
- protège les inscriptions simultanées pour une même identité.

Exemple d'entrée pour Discord (à appeler depuis une future interface Discord) :

```ts
const account = await getOrCreateAccount(pool, {
  provider: "discord",
  providerUserId: discordUser.id,
  displayName: discordUser.globalName ?? discordUser.username
});
```

Le service ne dépend pas de discord.js. Le futur site et l'application pourront appeler le même service avec un autre fournisseur d'identité.

## Préconditions

- La migration `0001_initial_core.sql` doit avoir été appliquée.
- La monnaie `TEAS` doit exister dans `currencies`.
- Le service doit être appelé côté serveur avec un pool PostgreSQL privé. Ne jamais exposer la connexion PostgreSQL ni un secret de service au navigateur.
- Les politiques RLS et l'architecture d'accès API devront être vérifiées avant d'exposer des données à un client web.

Ce service n'est pas encore relié à une commande ou un bouton Discord. Cette intégration sera réalisée dans une étape séparée.
