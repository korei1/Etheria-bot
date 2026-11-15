# Historique des versions

La documentation de référence reste sans numéro de version. Les évolutions sont ajoutées ici, regroupées par version. Les décisions non validées sont signalées comme telles et ne deviennent pas des règles officielles d'Etheria.

## Version 1 — Restauration du point d'entrée Discord

### Catégorie : Bot Discord / Onboarding
- **Élément modifié :** commande d'entrée dans Etheria.
- **Modification :** ajout de la commande slash `/commencer`.
- **Présentation :** écran d'accueil « Bienvenue dans Etheria », avec les boutons « Commencer mon aventure » et « Découvrir Etheria ».
- **Parcours :** le bouton de démarrage réutilise le parcours existant de création ou de récupération du compte et du personnage.
- **Compatibilité :** les cinq sous-commandes actuelles de `/etheria` et la commande `/etheria-admin` sont conservées.
- **Statut :** fusionné dans `main` le 15 novembre 2026 (commit `47e2fedf865c0404e5b0b77da1ed293f78b7b1b2`). Déploiement et test Discord à effectuer.

### Catégorie : Documentation / Database
- **Élément modifié :** organisation documentaire du dépôt.
- **Modification :** création du dossier `documentation/`, de son index, du présent historique et d'un dossier `documentation/database/`.
- **Élément modifié :** documentation du modèle et de la conservation des données.
- **Modification :** centralisation des documents explicatifs dans `documentation/`, avec les documents de base de données dans `documentation/database/` et l'architecture dans `documentation/developpement/`.
- **Statut :** état documentaire du dépôt ; ne signifie pas que la base distante est créée ou opérationnelle.

## Version 2 — Économie indépendante de SCNX

### Catégorie : Économie / Architecture
- **Élément modifié :** système économique d'Etheria.
- **Décision :** Etheria ne dépend plus de SCNX pour gérer sa monnaie ou les portefeuilles du jeu.
- **Architecture :** le backend Etheria et PostgreSQL constituent la source officielle des soldes et transactions. Le bot Discord et les futures interfaces web/mobile utilisent le même portefeuille via les services du backend.
- **Conséquence :** aucun webhook SCNX n'est nécessaire pour l'économie d'Etheria ; SCNX sort du circuit économique du jeu.
- **Périmètre :** les opérations de consultation, crédit, débit, achats, récompenses et transferts sont des capacités prévues à implémenter, pas des fonctions déclarées déjà opérationnelles.
- **Points non tranchés :** éventuelle séparation entre solde disponible et épargne/bank-balance, plafonds, frais, taxes et règles de transfert.
- **Statut :** décision confirmée le 15 novembre 2026 ; documentation mise à jour. Aucun code économique ni aucune migration SQL n'a été modifié ou exécuté.

## Version 3 — Audit distant et alignement documentaire

### Catégorie : Base de données / Audit
- **Élément modifié :** `documentation/database/ETAT_DATABASE.md`.
- **Modification :** remplacement de l'ancien statut « base distante non inspectée » par les résultats de l'inspection Supabase en lecture seule du 15 novembre 2026.
- **Constat :** six tables de base sont présentes et correspondent au socle de `0001_initial_core.sql`. La table `currencies` contient `TEAS` ; les cinq autres tables sont vides. L'historique distant des migrations est vide et les tables introduites par les migrations suivantes ne sont pas présentes.
- **Sécurité :** RLS est activé sur les six tables, sans politique RLS. L'advisor signale aussi une clé étrangère non indexée sur `wallets.currency_code`.
- **Statut :** audit en lecture seule ; aucune donnée, migration, politique ou configuration distante n'a été modifiée.

### Catégorie : Économie / Documentation
- **Éléments modifiés :** `src/modules/accounts/README.md` et `src/modules/economy/README.md`.
- **Modification :** alignement des instructions sur la décision confirmée d'une économie Etheria indépendante de SCNX, avec PostgreSQL comme source de vérité et `TEAS` comme code de monnaie.
- **Clarification :** le client et les instructions de l'ancien pont Sweet Tea Economy / SCNX sont identifiés comme hérités et ne doivent pas être configurés ou activés.
- **Statut :** documentation uniquement. Le code du client SCNX reste présent et devra être retiré ou remplacé dans une évolution de code dédiée ; le service économique PostgreSQL reste à implémenter.

## Version 4 — Revue complète des migrations et préparation de reprise

### Catégorie : Base de données / Migrations
- **Élément créé :** `documentation/database/PLAN_REPRISE_MIGRATIONS.md`.
- **Modification :** revue individuelle des migrations SQL `0001` à `0035`, regroupement par domaine, relevé des données initiales, des dépendances et des points de vigilance.
- **Constats :** `0001` correspond au socle déjà présent sur Supabase et doit être enregistré comme baseline sans rejouer son SQL ; `0002` à `0035` restent à tester et appliquer de façon contrôlée. Le script npm `db:check` vérifie uniquement la connexion et ne constitue pas un exécuteur de migrations.
- **Écarts identifiés :** références résiduelles à SCNX dans le code économique ; absence de relation SQL entre le catalogue d'espèces et les individus compagnons ; règles de sélection élémentaire et de reproduction à garantir côté métier ; droits institutionnels à modéliser ; fuseaux locaux à affecter à partir de données validées ; cohérence des itinéraires et plans de voyage PNJ à vérifier.
- **Sécurité :** plusieurs tables personnelles de jeu n'activent pas explicitement RLS dans les migrations. Les privilèges SQL doivent être audités avant toute exposition par l'API Supabase, puis des politiques doivent limiter l'accès aux données propres à chaque joueur.
- **Éléments modifiés :** `documentation/README.md` et `documentation/database/ETAT_DATABASE.md`.
- **Modification :** ajout du lien vers le plan de reprise et actualisation de l'état technique.
- **Statut :** documentation et revue uniquement. Aucun code applicatif, migration SQL, donnée ou paramètre Supabase n'a été modifié pendant cette étape.
