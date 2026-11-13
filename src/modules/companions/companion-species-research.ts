/**
 * Premières fiches documentaires d'espèces réelles pour Etheria.
 *
 * Elles ne sont PAS encore des définitions jouables : aucune rareté Etheria,
 * aucun élément, aucune méthode d'acquisition ni capacité n'est attribué.
 * Les évaluations de conservation indiquées sont mondiales, pas locales.
 */
import type { CompanionSpeciesCategory } from "./companion-species-catalog.js";
import type { IucnConservationCategory } from "./companion-species-catalog.js";

export interface SpeciesResearchSource {
  authority: string;
  title: string;
  url: string;
}

export interface CompanionSpeciesResearchDossier {
  key: string;
  commonName: string;
  scientificName: string;
  category: CompanionSpeciesCategory;
  assessment: {
    system: "iucn_red_list";
    scope: "global";
    category: IucnConservationCategory;
    assessedAt: string;
    publishedAt: number;
    authority: string;
    sourceName: string;
    sourceUrl: string;
  };
  habitats: readonly string[];
  rangeSummary: string;
  ecologicalNotes: readonly string[];
  additionalSources: readonly SpeciesResearchSource[];
  gameplayStatus: "research_only";
}

export const COMPANION_SPECIES_RESEARCH_DOSSIERS: readonly CompanionSpeciesResearchDossier[] = [
  {
    key: "gray_wolf",
    commonName: "Loup gris",
    scientificName: "Canis lupus",
    category: "terrestrial",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2018-08-30",
      publishedAt: 2018,
      authority: "IUCN",
      sourceName: "The IUCN Red List of Threatened Species 2018: Canis lupus",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2018-2.RLTS.T3746A163508960.en"
    },
    habitats: [
      "Forêts",
      "Fourrés et zones arbustives",
      "Prairies",
      "Zones humides intérieures",
      "Zones rocheuses et montagnes",
      "Déserts",
      "Paysages terrestres modifiés par l'humain"
    ],
    rangeSummary: "Espèce à vaste répartition dans l'hémisphère Nord ; présente en France.",
    ecologicalNotes: [
      "La fiche IUCN mondiale classe l'espèce en préoccupation mineure.",
      "Cette évaluation mondiale ne décrit pas à elle seule l'état des populations de chaque pays."
    ],
    additionalSources: [],
    gameplayStatus: "research_only"
  },
  {
    key: "red_fox",
    commonName: "Renard roux",
    scientificName: "Vulpes vulpes",
    category: "terrestrial",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2016-03-01",
      publishedAt: 2021,
      authority: "IUCN",
      sourceName: "The IUCN Red List of Threatened Species 2021: Vulpes vulpes (amended version of 2016 assessment)",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2021-1.RLTS.T23062A193903628.en"
    },
    habitats: [
      "Forêts",
      "Fourrés et zones arbustives",
      "Prairies",
      "Zones humides intérieures",
      "Déserts",
      "Paysages terrestres modifiés par l'humain"
    ],
    rangeSummary: "Espèce largement répartie dans l'hémisphère Nord ; présente en France.",
    ecologicalNotes: [
      "La fiche IUCN mondiale indique une tendance de population stable dans l'évaluation de 2016.",
      "L'espèce utilise des milieux naturels variés ainsi que certains paysages modifiés par l'humain."
    ],
    additionalSources: [],
    gameplayStatus: "research_only"
  },
  {
    key: "golden_eagle",
    commonName: "Aigle royal",
    scientificName: "Aquila chrysaetos",
    category: "flying",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2016-10-01",
      publishedAt: 2016,
      authority: "IUCN / BirdLife International",
      sourceName: "The IUCN Red List of Threatened Species 2016: Aquila chrysaetos",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2016-3.RLTS.T22696060A93541662.en"
    },
    habitats: [
      "Forêts",
      "Fourrés et zones arbustives",
      "Prairies",
      "Falaises et zones rocheuses",
      "Montagnes",
      "Déserts"
    ],
    rangeSummary: "Espèce présente dans de nombreuses régions de l'hémisphère Nord, dont la France.",
    ecologicalNotes: [
      "La fiche mondiale de 2016 classe l'espèce en préoccupation mineure et indique une tendance stable.",
      "Elle est associée notamment aux paysages ouverts, aux reliefs et aux zones rocheuses."
    ],
    additionalSources: [
      {
        authority: "Convention sur les espèces migratrices (CMS)",
        title: "Aquila chrysaetos",
        url: "https://www.cms.int/species/aquila-chrysaetos"
      }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "green_sea_turtle",
    commonName: "Tortue verte",
    scientificName: "Chelonia mydas",
    category: "reptile_amphibian",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2024-12-09",
      publishedAt: 2025,
      authority: "IUCN / Marine Turtle Specialist Group",
      sourceName: "The IUCN Red List of Threatened Species 2025: Chelonia mydas",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2025-2.RLTS.T4615A285108125.en"
    },
    habitats: [
      "Eaux marines côtières peu profondes",
      "Herbiers marins",
      "Récifs coralliens",
      "Zones océaniques",
      "Plages sableuses utilisées pour la ponte"
    ],
    rangeSummary: "Espèce marine présente dans les mers tropicales et subtropicales du monde.",
    ecologicalNotes: [
      "Les adultes sont principalement herbivores et consomment notamment des herbiers marins et des algues.",
      "Les femelles pondent sur des plages sableuses.",
      "L'évaluation mondiale publiée en 2025 classe l'espèce en préoccupation mineure ; cela ne remplace pas les évaluations locales ou nationales."
    ],
    additionalSources: [
      {
        authority: "Office français de la biodiversité",
        title: "Tortue verte (Chelonia mydas)",
        url: "https://ofb.gouv.fr/especes/tortue-verte-chelonia-mydas"
      },
      {
        authority: "Inventaire national du patrimoine naturel",
        title: "Chelonia mydas - INPN",
        url: "https://inpn.mnhn.fr/explorer/especes/chelonia_mydas/77338"
      }
    ],
    gameplayStatus: "research_only"
  }
] as const;

export function validateSpeciesResearchDossiers(
  dossiers: readonly CompanionSpeciesResearchDossier[] =
    COMPANION_SPECIES_RESEARCH_DOSSIERS
): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  const scientificNames = new Set<string>();

  for (const dossier of dossiers) {
    if (keys.has(dossier.key)) issues.push(`Clé de dossier dupliquée : ${dossier.key}.`);
    keys.add(dossier.key);

    if (scientificNames.has(dossier.scientificName.toLowerCase())) {
      issues.push(`Nom scientifique dupliqué : ${dossier.scientificName}.`);
    }
    scientificNames.add(dossier.scientificName.toLowerCase());

    if (!/^https:\/\//.test(dossier.assessment.sourceUrl)) {
      issues.push(`Source IUCN HTTPS manquante pour ${dossier.key}.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dossier.assessment.assessedAt)) {
      issues.push(`Date d'évaluation invalide pour ${dossier.key}.`);
    }
    if (dossier.habitats.length === 0 || dossier.ecologicalNotes.length === 0) {
      issues.push(`Informations écologiques incomplètes pour ${dossier.key}.`);
    }
    for (const source of dossier.additionalSources) {
      if (!source.authority.trim() || !source.title.trim() || !/^https:\/\//.test(source.url)) {
        issues.push(`Source complémentaire invalide pour ${dossier.key}.`);
      }
    }
    if (dossier.gameplayStatus !== "research_only") {
      issues.push(`Un dossier documentaire ne peut pas être directement jouable : ${dossier.key}.`);
    }
  }
  return issues;
}
