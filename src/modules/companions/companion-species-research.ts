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
    scope: "global" | "europe" | "eu27" | "national";
    category: IucnConservationCategory;
    assessedAt?: string;
    publishedAt: number;
    authority: string;
    sourceName: string;
    sourceUrl: string;
  };
  regionalAssessments?: readonly {
    scope: "europe" | "eu27" | "national";
    category: IucnConservationCategory;
    assessedAt?: string;
    publishedAt: number;
    authority: string;
    sourceName: string;
    sourceUrl: string;
  }[];
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
  },
  {
    key: "eurasian_otter",
    commonName: "Loutre d'Europe",
    scientificName: "Lutra lutra",
    category: "aquatic",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "near_threatened",
      assessedAt: "2020-01-31",
      publishedAt: 2022,
      authority: "IUCN",
      sourceName: "The IUCN Red List of Threatened Species 2022: Lutra lutra",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2022-2.RLTS.T12419A218069689.en"
    },
    habitats: [
      "Cours d'eau et plans d'eau douce",
      "Zones humides intérieures",
      "Littoraux et milieux marins côtiers",
      "Rives végétalisées et milieux aquatiques artificiels"
    ],
    rangeSummary: "Espèce largement répartie en Europe et en Asie, également présente en Afrique du Nord.",
    ecologicalNotes: [
      "L'évaluation mondiale de 2020 indique une tendance de population décroissante.",
      "La dégradation des habitats et la pollution de l'eau figurent parmi les pressions décrites dans l'évaluation.",
      "La protection et l'état des habitats varient selon les pays."
    ],
    additionalSources: [
      {
        authority: "IUCN SSC Otter Specialist Group",
        title: "Lutra lutra",
        url: "https://www.otterspecialistgroup.org/otter-species/lutra-lutra/"
      }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "red_deer",
    commonName: "Cerf élaphe",
    scientificName: "Cervus elaphus",
    category: "terrestrial",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2015-10-12",
      publishedAt: 2018,
      authority: "IUCN",
      sourceName: "The IUCN Red List of Threatened Species 2018: Cervus elaphus",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2018-2.RLTS.T55997072A142404453.en"
    },
    habitats: [
      "Forêts",
      "Fourrés et zones arbustives",
      "Prairies",
      "Zones rocheuses et montagnes",
      "Paysages terrestres modifiés par l'humain"
    ],
    rangeSummary: "Espèce présente dans une grande partie de l'Europe et de l'Asie ; présente naturellement en France.",
    ecologicalNotes: [
      "L'évaluation mondiale de 2015 classe l'espèce en préoccupation mineure et indique une tendance croissante à cette date.",
      "Les habitats occupés comprennent des milieux forestiers, ouverts et montagneux.",
      "La fiche IUCN signale que cette évaluation nécessite une mise à jour."
    ],
    additionalSources: [
      {
        authority: "Muséum national d'Histoire naturelle",
        title: "Red deer",
        url: "https://www.mnhn.fr/en/red-deer"
      }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "western_european_hedgehog",
    commonName: "Hérisson d'Europe",
    scientificName: "Erinaceus europaeus",
    category: "terrestrial",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "near_threatened",
      publishedAt: 2024,
      authority: "IUCN",
      sourceName: "The IUCN Red List 2024-2: Erinaceus europaeus",
      sourceUrl: "https://nc.iucnredlist.org/redlist/content/attachment_files/2024-2_RL_Table_7.pdf"
    },
    habitats: [
      "Lisières forestières",
      "Haies et zones arbustives",
      "Prairies et paysages agricoles",
      "Jardins, parcs et espaces verts urbains"
    ],
    rangeSummary: "Espèce d'Europe occidentale présente notamment en France.",
    ecologicalNotes: [
      "L'UICN a fait passer l'espèce de préoccupation mineure à quasi menacée dans la mise à jour mondiale publiée en 2024.",
      "L'intensification agricole, les routes et le développement urbain contribuent à la dégradation des habitats et au déclin signalé dans plusieurs pays.",
      "La date exacte de l'évaluation n'est pas renseignée dans cette fiche documentaire ; elle n'est donc pas supposée."
    ],
    additionalSources: [
      {
        authority: "IUCN",
        title: "Mise à jour 2024 de la Liste rouge : hérisson d'Europe",
        url: "https://iucn.org/fr/communique-de-presse/202410/plus-dune-espece-darbre-sur-trois-dans-le-monde-est-menacee-dextinction?language=fr"
      }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "eurasian_lynx",
    commonName: "Lynx boréal",
    scientificName: "Lynx lynx",
    category: "terrestrial",
    assessment: {
      system: "iucn_red_list",
      scope: "europe",
      category: "least_concern",
      assessedAt: "2022-04-03",
      publishedAt: 2025,
      authority: "IUCN",
      sourceName: "The IUCN Red List of Threatened Species 2025: Lynx lynx (Europe assessment)",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2025-1.RLTS.T12519A216872952.en"
    },
    regionalAssessments: [
      {
        scope: "eu27",
        category: "near_threatened",
        assessedAt: "2022-04-03",
        publishedAt: 2025,
        authority: "IUCN",
        sourceName: "Lynx lynx - European Union 27 assessment",
        sourceUrl: "https://doi.org/10.2305/IUCN.UK.2025-1.RLTS.T12519A216872952.en"
      }
    ],
    habitats: [
      "Forêts",
      "Fourrés et zones arbustives",
      "Prairies"
    ],
    rangeSummary: "Espèce eurasiatique ; présente en France métropolitaine dans le cadre de réintroductions.",
    ecologicalNotes: [
      "L'évaluation européenne publiée en 2025 classe l'espèce en préoccupation mineure.",
      "La même fiche indique une catégorie quasi menacée pour l'évaluation de l'Union européenne à 27 pays.",
      "Ces deux périmètres ne doivent pas être confondus avec une évaluation mondiale."
    ],
    additionalSources: [],
    gameplayStatus: "research_only"
  },
  {
    key: "short_beaked_common_dolphin",
    commonName: "Dauphin commun",
    scientificName: "Delphinus delphis",
    category: "aquatic",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2020-10-20",
      publishedAt: 2021,
      authority: "IUCN",
      sourceName: "The IUCN Red List of Threatened Species 2021: Delphinus delphis",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2021-2.RLTS.T134817215A199893039.en"
    },
    habitats: ["Eaux marines néritiques", "Eaux océaniques tropicales et tempérées chaudes"],
    rangeSummary: "Espèce largement répartie dans les eaux tropicales et tempérées chaudes ; présente dans les eaux françaises.",
    ecologicalNotes: [
      "L'évaluation mondiale publiée en 2021 classe l'espèce en préoccupation mineure ; la tendance mondiale y est indiquée comme inconnue.",
      "Elle vit souvent en groupes et se nourrit notamment de petits poissons et de calmars.",
      "Les captures accidentelles dans les engins de pêche, la pollution et le bruit sous-marin figurent parmi les pressions documentées."
    ],
    additionalSources: [
      {
        authority: "Convention sur les espèces migratrices (CMS)",
        title: "Short-Beaked Common Dolphin - Delphinus delphis",
        url: "https://www.cms.int/species/delphinus-delphis"
      }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "great_white_shark",
    commonName: "Grand requin blanc",
    scientificName: "Carcharodon carcharias",
    category: "aquatic",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "vulnerable",
      assessedAt: "2018-11-07",
      publishedAt: 2022,
      authority: "IUCN SSC Shark Specialist Group",
      sourceName: "The IUCN Red List of Threatened Species 2022: Carcharodon carcharias (amended version of 2019 assessment)",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2022-1.RLTS.T3855A212629880.en"
    },
    habitats: ["Eaux marines néritiques", "Eaux océaniques"],
    rangeSummary: "Espèce marine à vaste répartition dans les océans du monde, avec des populations réparties entre plusieurs grands bassins océaniques.",
    ecologicalNotes: [
      "L'évaluation mondiale publiée en 2022 reprend l'évaluation réalisée en 2018 et classe l'espèce comme vulnérable.",
      "La tendance de population est indiquée comme décroissante dans l'évaluation du statut vert de 2021 ; ce résultat ne doit pas être confondu avec une nouvelle catégorie de Liste rouge.",
      "La pêche et les prélèvements constituent des pressions documentées."
    ],
    additionalSources: [],
    gameplayStatus: "research_only"
  },
  {
    key: "common_pipistrelle",
    commonName: "Pipistrelle commune",
    scientificName: "Pipistrellus pipistrellus",
    category: "flying",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2019-05-14",
      publishedAt: 2020,
      authority: "IUCN SSC Bat Specialist Group",
      sourceName: "The IUCN Red List of Threatened Species 2020: Pipistrellus pipistrellus (errata version published in 2021)",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2020-2.RLTS.T85333513A196581936.en"
    },
    habitats: ["Forêts", "Fourrés et zones arbustives", "Zones humides intérieures", "Cavités et sites souterrains", "Bâtiments et autres milieux terrestres artificiels"],
    rangeSummary: "Espèce largement répartie en Europe, en Afrique du Nord-Ouest et dans une partie de l'Asie ; présente en France métropolitaine.",
    ecologicalNotes: [
      "L'évaluation mondiale publiée en 2020 classe l'espèce en préoccupation mineure et indique une tendance stable à cette date.",
      "Elle chasse principalement de petits insectes et utilise des fissures de bâtiments ou des cavités d'arbres comme gîtes.",
      "Les travaux sur les bâtiments, les traitements du bois et les dérangements peuvent affecter certaines colonies."
    ],
    additionalSources: [
      {
        authority: "Muséum national d'Histoire naturelle",
        title: "Pipistrelle commune",
        url: "https://www.mnhn.fr/fr/pipistrelle-commune"
      },
      {
        authority: "Convention sur les espèces migratrices (CMS)",
        title: "Pipistrellus pipistrellus",
        url: "https://www.cms.int/species/pipistrellus-pipistrellus"
      }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "monarch_butterfly",
    commonName: "Monarque",
    scientificName: "Danaus plexippus",
    category: "insect_arthropod",
    assessment: {
      system: "iucn_red_list",
      scope: "global",
      category: "least_concern",
      assessedAt: "2021-08-19",
      publishedAt: 2022,
      authority: "IUCN",
      sourceName: "The IUCN Red List of Threatened Species 2022: Danaus plexippus",
      sourceUrl: "https://doi.org/10.2305/IUCN.UK.2022-1.RLTS.T159971A219149911.en"
    },
    habitats: ["Forêts", "Fourrés et zones arbustives", "Prairies", "Zones humides intérieures", "Paysages terrestres modifiés par l'humain"],
    rangeSummary: "Espèce originaire des Amériques, avec des populations établies ou des observations dans de nombreuses autres régions.",
    ecologicalNotes: [
      "L'évaluation mondiale de l'espèce publiée en 2022 la classe en préoccupation mineure et indique une tendance décroissante.",
      "Le statut de la sous-espèce migratrice Danaus plexippus plexippus est distinct : son évaluation propre publiée en 2022 la classe en danger. Il ne faut pas transférer automatiquement ce statut à toute l'espèce.",
      "Les chenilles dépendent des plantes hôtes du genre Asclepias ; la perte d'habitats et les changements climatiques affectent notamment les populations migratrices."
    ],
    additionalSources: [
      {
        authority: "IUCN",
        title: "Le papillon monarque migrateur est désormais En danger",
        url: "https://iucn.org/press-release/202207/migratory-monarch-butterfly-now-endangered-iucn-red-list?language=fr"
      },
      {
        authority: "U.S. Geological Survey",
        title: "Non-negligible near-term risk to the eastern migratory monarch population",
        url: "https://pubs.usgs.gov/publication/ofr20231097/full"
      }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "domestic_dog",
    commonName: "Chien domestique",
    scientificName: "Canis familiaris",
    category: "terrestrial",
    assessment: { system: "iucn_red_list", scope: "global", category: "not_evaluated", publishedAt: 2024, authority: "Mammal Diversity Database", sourceName: "Mammal Diversity Database 2024: Canis familiaris", sourceUrl: "https://www.mammaldiversity.org/taxon/1005940/" },
    habitats: ["Milieux habités", "Zones urbaines", "Forêts et autres milieux fréquentés par les populations féraux"],
    rangeSummary: "Animal domestique présent dans le monde entier ; des populations retournées à l'état féral existent dans de nombreuses régions.",
    ecologicalNotes: [
      "La base taxonomique consultée indique que le chien domestique n'a pas été évalué dans la Liste rouge mondiale de l'IUCN ; aucune catégorie de menace ne doit donc lui être attribuée.",
      "Les chiens vivant librement peuvent exercer une prédation sur la faune locale et transmettre certaines maladies.",
      "La taxonomie du chien domestique est parfois présentée sous le nom Canis lupus familiaris ; ce dossier conserve Canis familiaris selon la source taxonomique choisie."
    ],
    additionalSources: [
      { authority: "IUCN SSC Invasive Species Specialist Group", title: "Global Invasive Species Database: Canis lupus / domestic dogs", url: "https://www.iucngisd.org/gisd/speciesname/Canis%2Blupus" },
      { authority: "Integrated Taxonomic Information System", title: "Canis familiaris", url: "https://www.itis.gov/servlet/SingleRpt/SingleRpt?print_version=PRT&search_topic=TSN&search_value=183815" }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "domestic_cat",
    commonName: "Chat domestique",
    scientificName: "Felis catus",
    category: "terrestrial",
    assessment: { system: "iucn_red_list", scope: "global", category: "not_evaluated", publishedAt: 2024, authority: "Mammal Diversity Database", sourceName: "Mammal Diversity Database 2024: Felis catus", sourceUrl: "https://www.mammaldiversity.org/taxon/1005985/" },
    habitats: ["Zones urbaines", "Zones périurbaines", "Paysages agricoles", "Habitats proches des établissements humains"],
    rangeSummary: "Espèce domestique répandue mondialement ; des populations féraux ou errantes sont présentes dans de nombreuses régions.",
    ecologicalNotes: [
      "La base taxonomique consultée indique que le chat domestique n'a pas été évalué dans la Liste rouge mondiale de l'IUCN ; aucune catégorie de menace ne doit donc lui être attribuée.",
      "Les chats conservent un comportement de chasse ; leurs effets sur la biodiversité varient selon les milieux et les contextes locaux.",
      "Une étude menée en France métropolitaine a documenté les proies rapportées par des chats suivis entre 2015 et 2022."
    ],
    additionalSources: [
      { authority: "Animal Diversity Web, University of Michigan", title: "Felis catus", url: "https://animaldiversity.org/accounts/Felis_catus/" },
      { authority: "Animals", title: "Spatiotemporal and Individual Patterns of Domestic Cat Hunting Behaviour in France", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10668736/" }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "domestic_horse",
    commonName: "Cheval domestique",
    scientificName: "Equus caballus",
    category: "terrestrial",
    assessment: { system: "iucn_red_list", scope: "global", category: "not_evaluated", publishedAt: 2024, authority: "Mammal Diversity Database", sourceName: "Mammal Diversity Database 2024: Equus caballus", sourceUrl: "https://www.mammaldiversity.org/taxon/1006122/" },
    habitats: ["Prairies tempérées", "Steppes", "Savanes", "Semi-déserts", "Marais", "Zones boisées"],
    rangeSummary: "Animal domestique répandu mondialement ; des populations retournées à l'état féral existent dans plusieurs régions, dont certaines parties de l'Europe.",
    ecologicalNotes: [
      "La base taxonomique consultée indique que le cheval domestique n'a pas été évalué dans la Liste rouge mondiale de l'IUCN ; aucune catégorie de menace ne doit donc lui être attribuée.",
      "Les chevaux domestiques occupent une grande variété de milieux sous gestion humaine ; les populations féraux peuvent pâturer dans des milieux ouverts.",
      "Le pâturage peut modifier la structure de la végétation et les dynamiques écologiques locales."
    ],
    additionalSources: [
      { authority: "Animal Diversity Web, University of Michigan", title: "Equus caballus", url: "https://animaldiversity.org/accounts/Equus_caballus/" },
      { authority: "Ministère de la Culture", title: "La domestication du cheval", url: "https://cheval-patrimoine.culture.gouv.fr/fr/la-domestication-du-cheval" }
    ],
    gameplayStatus: "research_only"
  },
  {
    key: "honey_bee",
    commonName: "Abeille mellifère",
    scientificName: "Apis mellifera",
    category: "insect_arthropod",
    assessment: { system: "iucn_red_list", scope: "global", category: "not_evaluated", publishedAt: 2009, authority: "Animal Diversity Web, University of Michigan", sourceName: "Apis mellifera", sourceUrl: "https://animaldiversity.org/accounts/Apis_mellifera/" },
    habitats: ["Prairies fleuries", "Milieux agricoles", "Jardins", "Lisières et clairières", "Cavités naturelles ou ruches"],
    rangeSummary: "Espèce originaire de l'Ancien Monde, aujourd'hui élevée et introduite dans de nombreuses régions du monde.",
    ecologicalNotes: [
      "La source consultée ne signale pas de statut spécial dans la Liste rouge IUCN pour l'espèce ; cette mention ne doit pas être interprétée comme une évaluation récente de l'état de toutes les populations.",
      "L'espèce vit en colonies organisées autour d'une reine et de castes spécialisées.",
      "Elle contribue à la pollinisation de nombreuses plantes sauvages et cultivées ; les pressions sur les colonies peuvent inclure parasites, maladies, pesticides et disponibilité des ressources florales."
    ],
    additionalSources: [],
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
    if (dossier.assessment.assessedAt &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(dossier.assessment.assessedAt) ||
        !Number.isFinite(Date.parse(dossier.assessment.assessedAt)))) {
      issues.push(`Date d'évaluation invalide pour ${dossier.key}.`);
    }
    for (const regional of dossier.regionalAssessments ?? []) {
      if (!/^https:\/\//.test(regional.sourceUrl) ||
        !regional.authority.trim() || !regional.sourceName.trim()) {
        issues.push(`Évaluation régionale invalide pour ${dossier.key}.`);
      }
      if (regional.assessedAt &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(regional.assessedAt) ||
          !Number.isFinite(Date.parse(regional.assessedAt)))) {
        issues.push(`Date d'évaluation régionale invalide pour ${dossier.key}.`);
      }
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
