# Politique de conservation des données Etheria

Ce document définit les règles techniques à appliquer pour limiter la croissance de la base sans perdre les informations nécessaires au monde persistant.

## 1. Mémoire des PNJ

- Conserver les souvenirs qui changent réellement la relation, les décisions, les quêtes ou le comportement d'un PNJ.
- Regrouper les souvenirs répétitifs et résumer les événements anciens lorsque le résumé préserve les faits utiles.
- Donner à chaque type de souvenir un niveau d'importance et une règle de conservation.
- Ne pas conserver automatiquement l'intégralité des conversations ou des messages Discord.
- Ne pas supprimer automatiquement un souvenir important pour une quête, une relation ou un événement encore actif.
- Toute politique automatisée devra être testée sur des données fictives avant activation.

## 2. Historiques et archivage

- Ne persister que les événements de jeu significatifs, pas chaque vérification technique ou chaque rafraîchissement d'interface.
- Définir des durées distinctes pour les journaux techniques, événements temporaires, historiques narratifs et données d'audit.
- Résumer les événements narratifs anciens lorsque le détail complet n'est plus nécessaire au gameplay.
- Garder les données fréquemment consultées dans les tables opérationnelles ; déplacer les données froides vers des tables d'archives ou un stockage objet selon les besoins d'accès.
- Les archives doivent être datées, documentées, exportables et restaurables.
- Le journal des transactions de monnaie reste traçable et ne fait pas l'objet d'une suppression automatique. Une éventuelle partition ou archive devra préserver les références et l'audit.

## 3. Fichiers et médias

- Stocker les illustrations, avatars, sons, vidéos et autres binaires dans un stockage objet séparé de PostgreSQL.
- Garder en base uniquement les métadonnées et la référence stable du fichier : clé, type MIME, taille, propriétaire éventuel, dates et statut.
- Ne pas enregistrer de contenu binaire ou de chaînes base64 dans les tables.
- Utiliser une interface de stockage abstraite pour que le fournisseur puisse être remplacé sans modifier les règles métier.
- Contrôler l'accès aux fichiers privés côté serveur ; ne pas intégrer de secrets ni d'URL privées temporaires au code.

## 4. Protection contre la saturation

- Suivre régulièrement la taille de la base, la taille des principales tables, les index et le volume des fichiers.
- Définir des seuils d'alerte avant d'approcher le quota du fournisseur.
- Tester les tâches de résumé et d'archivage sur une copie avant toute opération réelle.
- Ne jamais supprimer des données uniquement pour faire baisser le compteur sans vérifier leur utilité et leur possibilité de restauration.

## 5. Indépendance du fournisseur

Le modèle relationnel reste PostgreSQL standard autant que possible. Le code métier ne doit pas dépendre directement des API propriétaires du fournisseur. Les intégrations spécifiques (authentification, stockage objet, temps réel) passent par des adaptateurs séparés.
