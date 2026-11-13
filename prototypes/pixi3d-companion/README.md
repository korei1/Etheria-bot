# Etheria — prototype compagnon 3D

Prototype web isolé du bot Discord. Il utilise PixiJS 3D (`@pixi/3d`) pour construire et afficher Lykos directement dans la scène, sans fichier Blender ni modèle externe.

## Lykos procédural

Le compagnon est assemblé en temps réel à partir de géométries 3D et de matériaux PixiJS :

- silhouette de renard orange et crème ;
- grands yeux bleus, oreilles dressées et museau ;
- queue touffue en plusieurs volumes ;
- sacoche verte avec détails dorés ;
- caméra orbitale et éclairage de scène.

Les commandes Observer, Marcher et Courir pilotent des animations procédurales calculées à chaque image. Ce sont des mouvements de prototype, pas encore des clips de squelette exportés.

## Lancer l'aperçu

Depuis ce dossier :

```bash
npm install
npm run dev
```

Pour vérifier la compilation :

```bash
npm run build
```

## Contrôles

- Observer : respiration et mouvements subtils de la tête et de la queue
- Marcher : balancement du corps et mouvement alterné des pattes
- Courir : mouvement plus rapide et plus ample
- Souris ou tactile : orbiter la caméra et zoomer

## Suite prévue

1. Vérifier le rendu et la compilation sur les navigateurs ciblés, notamment Safari sur iPad.
2. Améliorer la silhouette et les proportions à partir des captures du prototype.
3. Remplacer progressivement les volumes de base par une géométrie plus détaillée.
4. Envisager ensuite un squelette et de vrais clips d'animation si le rendu le justifie.

Le prototype reste séparé du bot Discord et de Supabase. Aucun déploiement ni migration n'est effectué ici.
