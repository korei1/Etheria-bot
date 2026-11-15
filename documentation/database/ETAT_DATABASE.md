# État de la database Etheria

Dernière vérification distante : 15 novembre 2026.

## Projet inspecté

Le projet Supabase **Etheria** a été inspecté en lecture seule. Aucun changement de schéma, de donnée ou de configuration n'a été effectué pendant cet audit.

## État distant constaté

Six tables sont présentes dans le schéma `public` :

- `accounts`
- `account_identities`
- `player_profiles`
- `currencies`
- `wallets`
- `currency_transactions`

Les six tables sont vides, à l'exception de `currencies`, qui contient une ligne : `TEAS` / `Teas`. Aucun compte joueur, profil, portefeuille ou mouvement économique n'a été trouvé.

L'historique des migrations Supabase est vide. Cela signifie qu'aucune migration n'est enregistrée dans le registre distant ; cela ne permet pas de déterminer à lui seul comment les six tables présentes ont été créées.

## Comparaison avec les migrations du dépôt

Le dépôt contient les migrations numérotées de `0001` à `0035`.

Le schéma distant des six tables de base correspond aux objets créés par `0001_initial_core.sql` : comptes, identités, profils, monnaie, portefeuilles et transactions. Les contraintes et index principaux de cette migration sont présents.

En revanche, les tables introduites par les migrations suivantes, notamment `characters`, les inventaires, les compagnons, la géographie, les localités, les PNJ, l'horloge du monde et les itinéraires, ne sont pas présentes dans le schéma distant inspecté. La base distante n'est donc pas encore au niveau du schéma complet décrit par les 35 migrations du dépôt.

**Conclusion :** le socle de `0001` est présent et compatible avec le fichier SQL, mais son enregistrement comme migration appliquée est absent. Les migrations `0002` à `0035` restent à examiner et à préparer avant toute application. Ne pas relancer `0001` sur cette base : ses créations de tables ne sont pas idempotentes.

## Sécurité et performance

- RLS est activé sur les six tables.
- Aucune politique RLS n'est définie sur ces six tables. Les accès via les rôles soumis à RLS seront donc bloqués ; il faut concevoir les politiques selon le futur modèle d'accès avant toute exposition à un client.
- L'advisor Supabase signale une clé étrangère non indexée : `wallets.currency_code`.
- Deux index sont signalés comme inutilisés. La base étant pratiquement vide, ce signal n'est pas une raison suffisante pour les supprimer.
- Aucun changement de sécurité ou d'index n'a été appliqué pendant l'audit.

## État des données

| Élément | État observé |
|---|---:|
| `accounts` | 0 |
| `account_identities` | 0 |
| `player_profiles` | 0 |
| `currencies` | 1 (`TEAS`) |
| `wallets` | 0 |
| `currency_transactions` | 0 |
| Migrations enregistrées | 0 |

## Points de vigilance

1. **Registre vide :** les migrations doivent être rapprochées du schéma réel avant toute exécution. Il ne faut pas supposer que le registre vide signifie que la base est vierge.
2. **Sauvegarde :** l'existence d'une sauvegarde restaurable n'a pas été vérifiée. Une sauvegarde vérifiée est requise avant les migrations.
3. **RLS :** aucune politique n'est définie. Ne pas exposer les tables à un client web/mobile avant d'avoir défini et testé les règles d'accès.
4. **Économie :** la décision d'architecture actuelle est un portefeuille Etheria commun à Discord et aux futures interfaces, avec PostgreSQL comme source de vérité. Les tables historiques `wallets` et `currency_transactions` sont vides et constituent le socle prévu ; le service économique reste à implémenter.
5. **Code monnaie :** la migration `0001` et la base distante utilisent `TEAS`. Le document de conception doit rester aligné sur ce code lors de sa prochaine révision.

## Ordre de travail sécurisé

1. Confirmer la sauvegarde et la possibilité de restauration.
2. Examiner individuellement les migrations `0002` à `0035`, leur ordre, leurs dépendances et leurs effets sur les données.
3. Ajouter un registre de migrations fiable ou choisir un exécuteur adapté, en tenant compte des six tables déjà présentes.
4. Préparer un plan de reprise qui reconnaît le socle `0001` existant sans le rejouer.
5. Définir et tester les politiques RLS avec le modèle d'accès backend retenu.
6. Appliquer les migrations approuvées dans un environnement de test, puis vérifier les tables, contraintes, index et données attendus.
7. N'appliquer ensuite les migrations à la base cible qu'après sauvegarde vérifiée et autorisation explicite.

## Statut

- Connexion distante : **accessible et inspectée en lecture seule**.
- Socle de schéma `0001` : **présent, compatible, mais non enregistré dans l'historique distant**.
- Migrations `0002` à `0035` : **non présentes dans le schéma inspecté, à préparer**.
- RLS : **activé sans politiques**.
- Sauvegarde restaurable : **non vérifiée**.
- Exécuteur / registre de migrations : **à définir**.
- Modifications distantes pendant cet audit : **aucune**.
