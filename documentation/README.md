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
- [Politique de conservation des données](database/data-retention-policy.md)
- [Architecture modulaire](developpement/architecture-modulaire.md)
- [État et plan de mise en service de la database](database/ETAT_DATABASE.md)
- [Historique des versions documentaires et techniques](HISTORIQUE.md)

## Structure technique actuelle

- Bot Discord : interface initiale d'Etheria.
- PostgreSQL : base relationnelle commune prévue pour le bot, le futur site et l'application.
- Supabase : fournisseur ciblé dans le modèle de configuration actuel, à confirmer lors de la création ou du raccordement du projet.
- Migrations SQL : `src/database/migrations/`.
