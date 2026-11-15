# État de la database Etheria

Dernière vérification : 15 novembre 2026.

## État constaté dans le dépôt

- Le code utilise PostgreSQL via le paquet `pg`.
- La variable de connexion attendue est `DATABASE_URL`.
- Le fichier `.env.example` décrit une URL PostgreSQL Supabase avec SSL (`sslmode=require`).
- Le pool PostgreSQL est créé à la demande et limité à 5 connexions.
- La commande de contrôle `npm run db:check` vérifie uniquement que la connexion répond à `SELECT 1`.
- Aucune valeur réelle de `DATABASE_URL` n'est présente dans le dépôt.
- Aucune base distante n'a été raccordée ou inspectée pendant cette vérification.
- Aucun exécuteur de migrations ni registre de migrations appliquées n'a été trouvé dans le code inspecté.

## Migrations présentes

Le dossier `src/database/migrations/` contient les migrations numérotées de `0001` à `0035`.

Elles couvrent notamment :
- comptes, identités, économie et personnages ;
- création et progression des personnages ;
- géographie, régions, localités et découvertes ;
- inventaires, collecte, fabrication et traçabilité des lots ;
- compagnons et catalogue des espèces ;
- PNJ, dialogues, présence locale et activités ;
- déplacements des PNJ, horloge du monde et fuseaux horaires.

La présence d'un fichier SQL dans Git ne prouve pas que la migration a été appliquée sur une base distante.

## Points de vigilance relevés

1. **Aucune exécution distante confirmée.** L'historique du projet indique que les migrations n'ont pas été exécutées et que `DATABASE_URL` était volontairement absent. Ce statut doit être vérifié dans le tableau de bord du fournisseur avant toute opération.
2. **Pas de runner repéré.** Il faut définir une procédure contrôlée qui vérifie l'état de la base, l'ordre des migrations et celles déjà appliquées. Ne pas simplement exécuter tous les fichiers à nouveau.
3. **Sauvegarde obligatoire.** Avant toute migration sur une base contenant des données, créer et vérifier une sauvegarde restaurable.
4. **Migrations non équivalentes en risque.** Certaines créent des tables et contraintes ; d'autres insèrent des catalogues ou transforment des données existantes. Elles doivent être examinées individuellement.
5. **Écart documentaire sur la monnaie.** Le schéma de conception présente encore le code interne de Teas comme à fixer, tandis que la migration `0001` insère déjà le code `TEAS`. Cette décision doit être réconciliée dans la documentation avant de considérer le modèle comme parfaitement aligné.
6. **Schéma et migrations doivent être comparés.** `schema-v1.md` est un document de conception et non la description garantie de l'état réel de la base.

## Ordre de travail sécurisé

1. Identifier le projet PostgreSQL/Supabase destiné à Etheria et vérifier qui en détient l'accès.
2. Vérifier si le projet est neuf ou s'il contient déjà des données.
3. Lire l'état réel du schéma et l'historique des migrations appliquées, sans rien modifier.
4. Comparer cet état aux migrations `0001` à `0035`.
5. Résoudre les écarts et préparer une procédure d'application ordonnée, avec sauvegarde.
6. Exécuter d'abord les contrôles de connexion, puis les migrations approuvées une par une ou par lots explicitement vérifiés.
7. Vérifier les tables, contraintes, index et données attendus après chaque étape.

## Statut

- Connexion distante : **non configurée / non vérifiée**.
- Migrations distantes : **aucune application confirmée**.
- Sauvegarde distante : **non vérifiée**.
- Exécuteur de migrations : **à concevoir ou à choisir après inspection**.
- Aucune migration n'a été exécutée pendant cet audit.
