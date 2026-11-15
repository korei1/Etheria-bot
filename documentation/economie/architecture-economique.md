# Architecture économique d'Etheria

## Décision validée

Etheria possède son propre système économique. SCNX n'est pas requis pour gérer la monnaie, les portefeuilles ou les transactions du jeu.

La même économie est utilisée depuis toutes les interfaces :
- le bot Discord ;
- le futur site web ;
- la future application.

Il n'existe pas de solde parallèle par interface. Un joueur retrouve le même portefeuille et le même solde partout.

## Source officielle

- **Base de données :** PostgreSQL, avec Supabase comme fournisseur prévu dans la configuration actuelle du projet.
- **Autorité économique :** le backend d'Etheria.
- **Interfaces :** Discord, site et application appellent les services du backend ; elles ne modifient jamais directement un solde.
- **SCNX :** hors du circuit économique d'Etheria. Aucun webhook SCNX n'est nécessaire.

Le code de monnaie déjà utilisé par la migration initiale est `TEAS`. Le schéma de conception devra être aligné sur ce code lors d'une évolution documentaire dédiée, sans réécrire rétroactivement la référence initiale.

## Opérations prévues

Le service économique devra permettre, après implémentation :
- consulter le solde d'un compte ;
- créditer un portefeuille ;
- débiter un portefeuille ;
- effectuer des transferts entre joueurs, si cette fonctionnalité est activée ;
- payer des achats et recevoir des ventes ;
- attribuer des récompenses ;
- consulter l'historique des transactions.

Ces opérations sont des capacités cibles de l'architecture. Leur présence dans ce document ne signifie pas qu'elles sont déjà toutes implémentées.

## Intégrité et sécurité

Chaque opération économique devra être exécutée côté serveur et dans une transaction PostgreSQL atomique.

Garanties requises :
1. Un débit est refusé si le solde disponible est insuffisant.
2. Le solde et son écriture dans le journal sont modifiés atomiquement.
3. Chaque demande possède une clé d'idempotence afin d'éviter les doubles crédits ou débits en cas de répétition.
4. Chaque mouvement est historisé avec son motif, sa référence et sa date.
5. L'historique économique n'est pas réécrit pour corriger une erreur : une opération compensatrice est créée.
6. Les opérations sensibles sont autorisées côté backend ; les commandes Discord et les futures interfaces ne sont jamais considérées comme fiables par elles-mêmes.
7. Les secrets de connexion restent dans les variables d'environnement de l'hébergeur et ne sont jamais enregistrés dans Git.

## Modèle de données

Le modèle de référence s'appuie sur :
- `wallets` : un portefeuille par compte et par code de monnaie ;
- `currency_transactions` : journal des mouvements de crédit et de débit.

Le solde affiché doit rester cohérent avec le journal. La stratégie de calcul et de contrôle de ce solde sera définie lors de la conception du service économique et de ses migrations.

## Points encore à définir

La décision d'indépendance vis-à-vis de SCNX est validée, mais les règles suivantes ne sont pas figées par ce document :
- existence éventuelle d'un compte bancaire ou d'une épargne distincte du portefeuille disponible ;
- plafonds de solde et de transfert ;
- frais, taxes et commissions ;
- permissions et limites de crédit administratif ;
- règles de remboursement et de litige ;
- règles de transferts entre joueurs et leurs éventuels délais.

Ces règles devront être validées avant leur implémentation.

## État d'avancement

- Architecture économique indépendante de SCNX : **décidée**.
- Portefeuille commun entre Discord et les futures interfaces : **décidé**.
- Backend Etheria comme autorité économique : **décidé**.
- Service économique et opérations : **à implémenter**.
- Base distante et migrations : **à inspecter avant toute exécution**.
- Aucune migration n'a été exécutée dans le cadre de cette décision.
