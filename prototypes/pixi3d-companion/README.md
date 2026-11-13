# Etheria — prototype compagnon 3D

Prototype web isolé du bot Discord. Il utilise PixiJS 3D (`@pixi/3d`) pour charger un modèle glTF/GLB, afficher une scène 3D et piloter ses animations.

## Générer le modèle original de Lykos

Le dépôt contient un générateur Blender Python :

```bash
blender --background --python tools/create_lykos_blender.py
```

Le script produit :

`prototypes/pixi3d-companion/public/assets/lykos.glb`

Lykos est un renard fantastique stylisé, avec fourrure orange et crème, grands yeux bleus, oreilles, queue touffue et sacoche. Le générateur construit aussi un squelette et trois clips : `Idle`, `Walk` et `Run`.

Prérequis : Blender 4.x installé localement. Le modèle est une base procédurale originale et modifiable, pas encore une création artistique finale. Vérifier le résultat dans Blender avant de le considérer comme validé.

## Lancer l'aperçu PixiJS 3D

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

- Observer : animation `Idle`
- Marcher : animation `Walk`
- Courir : animation `Run`
- Souris ou tactile : orbiter la caméra et zoomer

## Architecture

- Blender génère le fichier GLB dans `public/assets`.
- PixiJS 3D charge le GLB avec `Assets.load` et l'affiche via `Model3D` dans un `View3D`.
- Le modèle et ses animations restent indépendants du bot Discord et de Supabase.

PixiJS 3D est en bêta ouverte ; son API peut évoluer.
