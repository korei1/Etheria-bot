# État de la database Etheria

Dernière vérification distante : 15 novembre 2026.

## Projet inspecté

Le projet Supabase **Etheria** a été inspecté en lecture seule. Aucun changement de schéma, de donnée ou de configuration distante n'a été effectué.

## État distant constaté

Six tables sont présentes dans le schéma `public` :

- `accounts`
- `account_identities`
- `player_profiles`
- `currencies`
- `wallets`
- `currency_transactions`

La table `currencies` contient une ligne : `TEAS` / `Teas`. Les cinq autres tables sont vides. Aucun compte joueur, profil, portefeuille ou mouvement économique n'a été trouvé.

L'historique des migrations Supabase est vide. Cela signifie qu'aucune migration n'est enregistrée dans le registre distant ; cela ne permet pas de déterminer à lui seul comment les six tables présentes ont été créées.

## Comparaison avec les migrations du dépôt

Le dépôt contient les migrations numérotées de `0001` à `0035`.

Le schéma distant des six tables de base correspond aux objets créés par `0001_initial_core.sql` : comptes, identités, profils, monnaie, portefeuilles et transactions. Les contraintes et index principaux de cette migration sont présents.

Les tables introduites par les migrations suivantes, notamment les personnages, inventaires, compagnons, données géographiques, localités, PNJ, horloge du monde et itinéraires, ne sont pas présentes dans le schéma distant inspecté.

Les migrations `0001` à `0035` ont maintenant été relues individuellement au niveau SQL. La revue et les écarts à traiter sont détaillés dans [le plan de reprise des migrations](PLAN_REPRISE_MIGRATIONS.md).

**Conclusion :** le socle de `0001` est présent et compatible avec le fichier SQL, mais son enregistrement comme migration appliquée est absent. Ne pas relancer `0001` sur cette base. Les migrations `0002` à `0035` restent à tester et à appliquer via une procédure contrôlée.

## Sécurité et performance

- RLS est activé sur les six tables distantes.
- Aucune politique RLS n'est définie sur ces six tables. Le backend doit utiliser un rôle de confiance côté serveur ; aucune table ne doit être exposée directement aux clients avant définition et tests des politiques.
- L'advisor Supabase signale une clé étrangère non indexée : `wallets.currency_code`.
- Deux index sont signalés comme inutilisés. La base étant pratiquement vide, ce signal ne justifie pas leur suppression.
- Aucun changement de sécurité ou d'index n'a été appliqué.

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

## Exécution des migrations

Le script npm `db:check` exécute seulement `SELECT 1` pour vérifier la connexion. Il ne vérifie pas la structure de la base et n'exécute aucune migration. Aucun exécuteur de migrations n'est déclaré dans les scripts npm examinés.

La procédure de reprise doit :

1. vérifier une sauvegarde restaurable ;
2. enregistrer le socle `0001` existant dans un registre de baseline sans rejouer son SQL ;
3. installer un exécuteur fiable avec journal et checksum ;
4. tester les migrations `0002` à `0035` dans un environnement isolé ;
5. corriger les écarts de règles métier et de sécurité identifiés ;
6. appliquer les migrations validées seulement après sauvegarde et autorisation explicite.

## Points de vigilance confirmés

- **Économie :** la décision actuelle est un portefeuille Etheria commun à Discord et aux futures interfaces, avec PostgreSQL comme source de vérité. Le code conserve encore des références au pont SCNX ; le service économique PostgreSQL reste à implémenter.
- **Compagnons :** le catalogue d'espèces et les individus ne sont pas reliés par une clé étrangère dans les migrations actuelles. La règle de choix d'élément selon l'achat en boutique Discord doit être garantie dans le backend et renforcée dans le schéma.
- **Gouvernance :** le catalogue des services, commerces, activités et événements ne suffit pas à représenter les droits des institutions compétentes. Les joueurs ne doivent pas recevoir de droits de gestion du contenu public.
- **Fuseaux :** le schéma prévoit des décalages UTC fixes et aucun changement saisonnier. Les fuseaux locaux doivent être affectés aux localités à partir de données validées.
- **Voyages PNJ :** le service doit vérifier que les localités d'un plan de voyage correspondent aux extrémités de l'itinéraire référencé.
- **Sauvegarde :** l'existence d'une sauvegarde restaurable n'a pas été vérifiée.

## Statut

- Connexion distante : **accessible et inspectée en lecture seule**.
- Socle de schéma `0001` : **présent, compatible, mais non enregistré dans l'historique distant**.
- Migrations `0001` à `0035` : **revues individuellement au niveau SQL**.
- Migrations `0002` à `0035` : **non présentes dans le schéma inspecté ; tests et reprise à effectuer**.
- Exécuteur de migrations : **absent des scripts npm examinés**.
- RLS : **activé sans politiques sur les six tables du socle distant**.
- Sauvegarde restaurable : **non vérifiée**.
- Modifications distantes pendant les audits : **aucune**.
