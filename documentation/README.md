# Documentation Etheria

Ce dossier est la référence documentaire du dépôt Etheria-bot.

## Règles de tenue

- La documentation de référence est conservée ; elle n'est pas réécrite à chaque évolution.
- Les changements sont ajoutés dans l'historique sous une version numérotée, regroupés par catégorie.
- Chaque entrée précise l'élément modifié et la modification apportée.
- Les décisions confirmées sont distinguées des propositions et des points encore à vérifier.
- Les anciennes entrées sont conservées.
- Les migrations SQL restent dans `src/database/migrations/` : ce sont des fichiers exécutables, pas des documents explicatifs.
- Aucun secret, token, mot de passe ou URL de connexion réelle ne doit être ajouté à ce dossier.

## Documents

- [Modèle de données PostgreSQL](database/schema-v1.md)
- [Architecture économique indépendante de SCNX](economie/architecture-economique.md)
- [Politique de conservation des données](database/data-retention-policy.md)
- [Architecture modulaire](developpement/architecture-modulaire.md)
- [État de la base de données](database/ETAT_DATABASE.md)
- [Revue des migrations et plan de reprise sécurisé](database/PLAN_REPRISE_MIGRATIONS.md)
- [Gestionnaire de migrations PostgreSQL](database/GESTIONNAIRE_MIGRATIONS.md)
- [Historique des versions documentaires et techniques](HISTORIQUE.md)

## Structure technique actuelle

- Bot Discord : interface initiale d'Etheria.
- PostgreSQL : base relationnelle commune prévue pour le bot, le futur site et l'application.
- Supabase : projet distant Etheria raccordé et inspecté en lecture seule.
- Migrations SQL : `src/database/migrations/`.
- Le script `db:check` vérifie uniquement la connexion ; il n'applique pas les migrations.
- Le gestionnaire de migrations propose les commandes `db:migrate:status`, `db:migrate:plan`, `db:migrate` et `db:migrate:baseline` ; aucune migration n'est exécutée automatiquement au démarrage du bot.
