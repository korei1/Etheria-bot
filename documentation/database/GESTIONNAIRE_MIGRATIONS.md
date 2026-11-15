# Gestionnaire de migrations PostgreSQL

Le gestionnaire applique les fichiers SQL de `src/database/migrations/` dans l'ordre, avec historique et contrôle d'intégrité.

## Commandes

- `npm run db:migrate:status` : affiche les migrations enregistrées et celles en attente, sans écrire.
- `npm run db:migrate:plan` : simule le plan d'exécution, sans écrire.
- `npm run db:migrate` : applique les migrations en attente.
- `npm run db:migrate:baseline` : enregistre explicitement `0001_initial_core.sql` comme baseline après vérification du socle déjà présent. Le SQL de `0001` n'est jamais exécuté par cette commande.

Toutes les commandes nécessitent `DATABASE_URL`. Elles ferment le pool PostgreSQL à la fin et ne journalisent jamais l'URL.

## Garanties

- verrou consultatif PostgreSQL pour empêcher deux exécutions simultanées ;
- ordre numérique et refus des versions dupliquées ;
- SHA-256 du contenu exact de chaque migration ;
- refus si un fichier déjà appliqué a changé ou si l'historique référence un fichier absent ;
- transaction unique par migration, incluant son enregistrement dans l'historique ;
- retrait de l'enveloppe historique `BEGIN/COMMIT` afin d'éviter qu'elle ne valide prématurément la transaction du gestionnaire ;
- simulation et consultation d'état sans création de table ni écriture ;
- détection du socle initial déjà présent sans historique : aucune tentative de rejouer `0001` n'est autorisée ;
- baseline limitée à `0001`, vérifiant les six tables, leurs colonnes attendues, les contraintes essentielles, RLS et la présence de TEAS.

## Historique

Le gestionnaire crée `public.etheria_schema_migrations` au premier lancement réel. Chaque entrée conserve le nom du fichier, son checksum, la date, la durée et le statut éventuel de baseline.

## Déploiement et précautions

Le build copie les fichiers SQL dans `dist/database/migrations`, à côté du gestionnaire compilé. Le bot ne lance jamais les migrations automatiquement au démarrage.

Ne pas lancer `db:migrate` sur le projet Supabase réel avant :
1. d'avoir confirmé une sauvegarde restaurable ;
2. d'avoir exécuté et contrôlé la baseline ;
3. d'avoir testé les migrations sur une base isolée ;
4. d'avoir obtenu une autorisation explicite pour l'application au projet cible.

Le mode simulation ne prouve pas qu'une migration s'exécutera correctement : seul un test sur une base PostgreSQL isolée peut le confirmer.
