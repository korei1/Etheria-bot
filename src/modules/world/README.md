# Géographie du monde Etheria

## Principes d'architecture

La géographie physique et les structures politiques sont deux domaines distincts :

- les continents, îles, archipels, océans, mers, reliefs, cours d'eau, biomes et habitats décrivent le monde physique ;
- les pays, frontières, territoires administratifs et gouvernements décrivent son organisation politique ;
- un changement de gouvernement ou de frontière ne doit pas réécrire la géographie naturelle ;
- une caractéristique géographique peut être ajoutée, révisée ou retirée sans supprimer les découvertes ou les compagnons déjà obtenus.

## Continents canoniques

Le registre initial comprend exactement sept continents :

- Sylvaria
- Nivéria
- Arcanthia
- Solméria
- Thalasséa
- Ignéria
- Umbrelune, dont les informations restent verrouillées jusqu'à sa découverte.

Les 28 pays déjà présents dans la migration 0004 sont rattachés à leur continent par une clé stable. La migration 0024 ne renomme ni ne remplace ces pays.

## Fondation technique

- `geography.ts` contient les types, le registre en mémoire, les validations et le filtre de visibilité.
- `world_continents` persiste les sept continents et leur visibilité.
- `world_geographic_features` est le registre extensible des caractéristiques physiques.
- La hiérarchie des caractéristiques utilise des identifiants stables et refuse les parents absents, les doublons et les cycles.
- Les lieux concrets, coordonnées, tracés, biomes et habitats ne sont pas préremplis sans validation éditoriale.
- Aucune extension PostGIS ni aucun format cartographique propriétaire n'est imposé à ce stade.
- Les tables sont protégées par RLS et destinées au backend de confiance.

## Hors périmètre de cette première fondation

Les unités administratives, les frontières politiques historiques, les changements de souveraineté, les régimes, les institutions et les gouvernements seront ajoutés dans des modules séparés. Aucun pays ne reçoit de régime politique ou de dirigeant inventé par cette migration.

La migration 0024 est préparée dans le dépôt mais ne doit pas être exécutée sur Supabase sans revue et approbation explicites.
