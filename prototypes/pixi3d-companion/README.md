# Etheria — prototype compagnon 3D

Prototype web isolé du bot Discord. Il utilise PixiJS 3D pour charger un modèle glTF animé, afficher une scène 3D et piloter ses clips depuis des boutons HTML.

## Prérequis

- Node.js 20+
- Un navigateur récent avec WebGL2 ou WebGPU
- Connexion Internet pour charger le modèle de démonstration

## Lancer

Depuis ce dossier :

```bash
npm install
npm run dev
```

Pour vérifier la compilation :

```bash
npm run build
```

## Modèle temporaire

Le prototype charge le Fox Sample Asset du dépôt Khronos glTF Sample Assets. Ce modèle sert uniquement à valider le pipeline de chargement, la caméra et la lecture des animations. Il ne constitue pas le modèle officiel de Lykos.

Attribution : Fox Sample Asset, Khronos Group, licence CC BY 4.0. Le modèle final d'Etheria devra être un fichier glTF/GLB original, avec ses propres matériaux, son squelette et ses clips d'animation.

## Contrôles

- Observer : clip `Survey`
- Marcher : clip `Walk`
- Courir : clip `Run`
- Souris ou tactile : orbiter la caméra avec `OrbitCamera`

## Notes

PixiJS 3D est actuellement en bêta ouverte. Son API peut évoluer. Le prototype est volontairement séparé du code Discord et ne touche ni à la base de données ni aux migrations Supabase.
