# Territoires et localités d'Etheria

## Deux registres distincts

La géographie physique (continents, îles, archipels, reliefs, hydrographie, biomes) reste dans le registre `geography.ts`. Ce module décrit les lieux habités et les découpages administratifs.

## Territoires administratifs

Une zone administrative appartient à un pays et peut avoir une zone parente du même pays. Les types disponibles sont volontairement génériques : région, province, département, district, comté, municipalité et territoire. Ils permettent de représenter des systèmes administratifs différents sans imposer un modèle uniforme à tous les pays.

Aucune province, aucun district et aucune frontière interne ne sont préremplis : leurs noms et leur nombre restent à définir.

## Localités

Le registre distingue capitale, ville, bourg, village, hameau et site isolé. Une localité peut être rattachée à une zone administrative. Chaque pays ne peut avoir qu'une capitale.

La migration 0025 reprend automatiquement les 24 capitales publiques déjà inscrites dans `countries`. Elle ne crée aucune localité pour les quatre pays secrets d'Umbrelune. Les villes secondaires et villages seront ajoutés après validation éditoriale.

## Confidentialité et intégrité

- Les localités et territoires d'un pays secret ne doivent jamais être rendus publics.
- Les fiches en brouillon ou retirées ne sont pas exposées au catalogue public.
- Les identifiants techniques restent stables quand un nom évolue.
- Les rattachements administratifs ne peuvent pas traverser les frontières d'un pays.
- Les cycles dans les hiérarchies sont refusés par les validations métier.
- Les changements de frontières ou de gouvernement ne suppriment pas les localités ni leur historique.

Les tables SQL sont protégées par RLS et réservées au backend de confiance. La migration 0025 est préparée mais n'a pas été exécutée sur Supabase.
