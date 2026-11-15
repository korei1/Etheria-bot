/**
 * Pistes de départ pour constituer le catalogue Etheria.
 *
 * Ces entrées sont des candidates éditoriales, pas des espèces jouables :
 * aucune rareté, région, habitat, élément, variante, protection ou méthode
 * d'acquisition n'est attribuée ici. Chaque fiche devra être documentée et
 * validée avant d'être convertie en CompanionSpeciesDefinition.
 */
import type { CompanionSpeciesCategory, CompanionSpeciesOrigin } from "./companion-species-catalog.js";

export interface CompanionSpeciesCandidate {
  key: string;
  suggestedName: string;
  origin: CompanionSpeciesOrigin;
  category: CompanionSpeciesCategory;
  reviewStatus: "draft_candidate";
}

export const COMPANION_SPECIES_CANDIDATES: readonly CompanionSpeciesCandidate[] = [
  { key: "domestic_dog", suggestedName: "Chien domestique", origin: "real_world", category: "terrestrial", reviewStatus: "draft_candidate" },
  { key: "domestic_cat", suggestedName: "Chat domestique", origin: "real_world", category: "terrestrial", reviewStatus: "draft_candidate" },
  { key: "gray_wolf", suggestedName: "Loup gris", origin: "real_world", category: "terrestrial", reviewStatus: "draft_candidate" },
  { key: "red_fox", suggestedName: "Renard roux", origin: "real_world", category: "terrestrial", reviewStatus: "draft_candidate" },
  { key: "domestic_horse", suggestedName: "Cheval domestique", origin: "real_world", category: "terrestrial", reviewStatus: "draft_candidate" },
  { key: "common_dolphin", suggestedName: "Dauphin commun", origin: "real_world", category: "aquatic", reviewStatus: "draft_candidate" },
  { key: "green_sea_turtle", suggestedName: "Tortue verte", origin: "real_world", category: "reptile_amphibian", reviewStatus: "draft_candidate" },
  { key: "great_white_shark", suggestedName: "Grand requin blanc", origin: "real_world", category: "aquatic", reviewStatus: "draft_candidate" },
  { key: "golden_eagle", suggestedName: "Aigle royal", origin: "real_world", category: "flying", reviewStatus: "draft_candidate" },
  { key: "common_pipistrelle", suggestedName: "Pipistrelle commune", origin: "real_world", category: "flying", reviewStatus: "draft_candidate" },
  { key: "honey_bee", suggestedName: "Abeille mellifère", origin: "real_world", category: "insect_arthropod", reviewStatus: "draft_candidate" },
  { key: "monarch_butterfly", suggestedName: "Monarque", origin: "real_world", category: "insect_arthropod", reviewStatus: "draft_candidate" },
  { key: "garden_spider", suggestedName: "Épeire diadème", origin: "real_world", category: "insect_arthropod", reviewStatus: "draft_candidate" },
  { key: "grass_snake", suggestedName: "Couleuvre à collier", origin: "real_world", category: "reptile_amphibian", reviewStatus: "draft_candidate" },
  { key: "common_frog", suggestedName: "Grenouille rousse", origin: "real_world", category: "reptile_amphibian", reviewStatus: "draft_candidate" },
  { key: "dragon", suggestedName: "Dragon", origin: "fantasy", category: "fantastic", reviewStatus: "draft_candidate" },
  { key: "griffin", suggestedName: "Griffon", origin: "fantasy", category: "fantastic", reviewStatus: "draft_candidate" },
  { key: "unicorn", suggestedName: "Licorne", origin: "fantasy", category: "fantastic", reviewStatus: "draft_candidate" },
  { key: "forest_spirit", suggestedName: "Esprit sylvestre", origin: "fantasy", category: "spirit_magical", reviewStatus: "draft_candidate" },
  { key: "living_vine", suggestedName: "Liane vivante", origin: "fantasy", category: "vegetal_elemental", reviewStatus: "draft_candidate" },
  { key: "clockwork_companion", suggestedName: "Compagnon mécanique", origin: "fantasy", category: "artificial", reviewStatus: "draft_candidate" },
  { key: "chimera", suggestedName: "Chimère", origin: "fantasy", category: "hybrid", reviewStatus: "draft_candidate" }
] as const;
