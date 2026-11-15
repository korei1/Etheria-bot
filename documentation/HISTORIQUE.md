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
