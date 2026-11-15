/**
 * Catalogue canonique initial des espèces fantastiques d'Etheria.
 *
 * Ce fichier ne renseigne que les données éditoriales validées : région,
 * noms des quatre formes et élément. Les raretés, habitats, acquisitions,
 * capacités et paramètres de gameplay restent absents tant qu'ils ne sont
 * pas définis séparément. Umbrelune est confidentielle jusqu'à découverte.
 */
export const INITIAL_FANTASY_BESTIARY_REGIONS = [
  { key: "sylvaria", name: "Sylvaria", visibility: "public" },
  { key: "niveria", name: "Nivéria", visibility: "public" },
  { key: "arcanthia", name: "Arcanthia", visibility: "public" },
  { key: "solmeria", name: "Solméria", visibility: "public" },
  { key: "thalassea", name: "Thalasséa", visibility: "public" },
  { key: "igneria", name: "Ignéria", visibility: "public" },
  { key: "umbrelune", name: "Umbrelune", visibility: "discovery_locked" }
] as const;

export type InitialFantasyBestiaryRegionKey =
  (typeof INITIAL_FANTASY_BESTIARY_REGIONS)[number]["key"];

export type InitialFantasyBestiaryElement =
  | "eau"
  | "feu"
  | "terre"
  | "air"
  | "magie"
  | "psy"
  | "ombre";

export interface InitialFantasyBestiarySpecies {
  key: string;
  name: string;
  regionKey: InitialFantasyBestiaryRegionKey;
  initialForm: string;
  youngForm: string;
  adultForm: string;
  elementalEvolution: string;
  element: InitialFantasyBestiaryElement;
  editorialStatus: "approved";
}

function species(
  key: string,
  name: string,
  regionKey: InitialFantasyBestiaryRegionKey,
  initialForm: string,
  youngForm: string,
  adultForm: string,
  elementalEvolution: string,
  element: InitialFantasyBestiaryElement
): InitialFantasyBestiarySpecies {
  return {
    key, name, regionKey, initialForm, youngForm, adultForm,
    elementalEvolution, element, editorialStatus: "approved"
  };
}

/** Les 43 espèces du catalogue initial, sans plafond pour les ajouts futurs. */
export const INITIAL_FANTASY_BESTIARY: readonly InitialFantasyBestiarySpecies[] = [
  // Sylvaria — 6
  species("cerf_des_racines", "Cerf des Racines", "sylvaria", "Faon des Racines", "Jeune Cerf des Racines", "Cerf des Racines adulte", "Sylvacerf", "terre"),
  species("renard_ambre", "Renard d'Ambre", "sylvaria", "Renardeau d'Ambre", "Jeune Renard d'Ambre", "Renard d'Ambre adulte", "Ambéryx", "terre"),
  species("hibou_sylve", "Hibou de Sylve", "sylvaria", "Petit Hibou de Sylve", "Jeune Hibou de Sylve", "Hibou de Sylve adulte", "Sylvowl", "terre"),
  species("lievre_brumes", "Lièvre des Brumes", "sylvaria", "Levraut des Brumes", "Jeune Lièvre des Brumes", "Lièvre des Brumes adulte", "Brumélièvre", "air"),
  species("lynx_morcant", "Lynx de Morcant", "sylvaria", "Chaton de Morcant", "Jeune Lynx de Morcant", "Lynx de Morcant adulte", "Morcanyx", "ombre"),
  species("biche_ramures_claires", "Biche aux Ramures Claires", "sylvaria", "Faon aux Ramures Claires", "Jeune Biche Claire", "Biche aux Ramures Claires adulte", "Lumibiche", "magie"),

  // Nivéria — 6
  species("renard_givre", "Renard de Givre", "niveria", "Renardeau de Givre", "Jeune Renard de Givre", "Renard de Givre adulte", "Givrenox", "eau"),
  species("bouquetin_cretes", "Bouquetin des Crêtes", "niveria", "Cabri des Crêtes", "Jeune Bouquetin des Crêtes", "Bouquetin des Crêtes adulte", "Cryobouquet", "terre"),
  species("chouette_blanche", "Chouette Blanche", "niveria", "Poussin de Chouette Blanche", "Jeune Chouette Blanche", "Chouette Blanche adulte", "Nivéowl", "air"),
  species("lievre_neige", "Lièvre de Neige", "niveria", "Levraut des Neiges", "Jeune Lièvre de Neige", "Lièvre de Neige adulte", "Nivélapin", "eau"),
  species("loup_varn", "Loup de Varn", "niveria", "Louveteau de Varn", "Jeune Loup de Varn", "Loup de Varn adulte", "Varnox", "ombre"),
  species("cerf_cristaux", "Cerf des Cristaux", "niveria", "Faon des Cristaux", "Jeune Cerf des Cristaux", "Cerf des Cristaux adulte", "Cristalcerf", "magie"),

  // Arcanthia — 6
  species("aigle_orbes", "Aigle des Orbes", "arcanthia", "Aiglon des Orbes", "Jeune Aigle des Orbes", "Aigle des Orbes adulte", "Orbéon", "magie"),
  species("renard_astral", "Renard Astral", "arcanthia", "Renardeau Astral", "Jeune Renard Astral", "Renard Astral adulte", "Astréfox", "psy"),
  species("cerf_celeste", "Cerf Céleste", "arcanthia", "Faon Céleste", "Jeune Cerf Céleste", "Cerf Céleste adulte", "Célesticerf", "air"),
  species("chevre_vaelith", "Chèvre de Vaelith", "arcanthia", "Chevreau de Vaelith", "Jeune Chèvre de Vaelith", "Chèvre de Vaelith adulte", "Vaelithor", "terre"),
  species("papillon_ether", "Papillon d'Éther", "arcanthia", "Chenille d'Éther", "Chrysalide d'Éther", "Papillon d'Éther adulte", "Éthérion", "magie"),
  species("veilleur_sareth", "Veilleur de Sareth", "arcanthia", "Petit Veilleur", "Veilleur Éveillé", "Grand Veilleur de Sareth", "Sarethys", "ombre"),

  // Solméria — 6
  species("gazelle_doree", "Gazelle Dorée", "solmeria", "Faon Doré", "Jeune Gazelle Dorée", "Gazelle Dorée adulte", "Auragazelle", "feu"),
  species("renard_vergers", "Renard des Vergers", "solmeria", "Renardeau des Vergers", "Jeune Renard des Vergers", "Renard des Vergers adulte", "Pomaroux", "terre"),
  species("oiseau_soleil", "Oiseau-Soleil", "solmeria", "Oisillon-Soleil", "Jeune Oiseau-Soleil", "Oiseau-Soleil adulte", "Soléon", "feu"),
  species("tortue_sernac", "Tortue de Sernac", "solmeria", "Bébé Tortue de Sernac", "Jeune Tortue de Sernac", "Tortue de Sernac adulte", "Sernaclys", "eau"),
  species("lynx_collines", "Lynx des Collines", "solmeria", "Chaton des Collines", "Jeune Lynx des Collines", "Lynx des Collines adulte", "Collinyx", "air"),
  species("papillon_clairsoleil", "Papillon de Clairsoleil", "solmeria", "Chenille de Clairsoleil", "Chrysalide de Clairsoleil", "Papillon de Clairsoleil adulte", "Solélys", "magie"),

  // Thalasséa — 7
  species("tortue_lagons", "Tortue des Lagons", "thalassea", "Bébé Tortue des Lagons", "Jeune Tortue des Lagons", "Tortue des Lagons adulte", "Lagoréa", "eau"),
  species("raie_azur", "Raie d'Azur", "thalassea", "Petite Raie d'Azur", "Jeune Raie d'Azur", "Raie d'Azur adulte", "Azurélia", "eau"),
  species("dauphin_mille_voiles", "Dauphin des Mille Voiles", "thalassea", "Bébé Dauphin des Mille Voiles", "Jeune Dauphin des Mille Voiles", "Dauphin des Mille Voiles adulte", "Voiléphin", "eau"),
  species("oiseau_marees", "Oiseau des Marées", "thalassea", "Oisillon des Marées", "Jeune Oiseau des Marées", "Oiseau des Marées adulte", "Marélys", "air"),
  species("hippocampe_perle", "Hippocampe Perlé", "thalassea", "Bébé Hippocampe Perlé", "Jeune Hippocampe Perlé", "Hippocampe Perlé adulte", "Perloris", "eau"),
  species("baleine_profondeurs", "Baleine des Profondeurs", "thalassea", "Baleineau des Profondeurs", "Jeune Baleine des Profondeurs", "Baleine des Profondeurs adulte", "Abysséa", "eau"),
  species("dragon_recifs", "Dragon des Récifs", "thalassea", "Dragonnet des Récifs", "Jeune Dragon des Récifs", "Dragon des Récifs adulte", "Coralléon", "eau"),

  // Ignéria — 6
  species("lezard_basalte", "Lézard de Basalte", "igneria", "Bébé Lézard de Basalte", "Jeune Lézard de Basalte", "Lézard de Basalte adulte", "Basaltrix", "terre"),
  species("renard_cendres", "Renard des Cendres", "igneria", "Renardeau des Cendres", "Jeune Renard des Cendres", "Renard des Cendres adulte", "Cendryx", "feu"),
  species("salamandre_khoran", "Salamandre de Khoran", "igneria", "Bébé Salamandre de Khoran", "Jeune Salamandre de Khoran", "Salamandre de Khoran adulte", "Khoraflam", "feu"),
  species("corbeau_pyrrhane", "Corbeau de Pyrrhane", "igneria", "Oisillon de Pyrrhane", "Jeune Corbeau de Pyrrhane", "Corbeau de Pyrrhane adulte", "Pyrracor", "feu"),
  species("bouquetin_forges", "Bouquetin des Forges", "igneria", "Cabri des Forges", "Jeune Bouquetin des Forges", "Bouquetin des Forges adulte", "Forgéon", "terre"),
  species("phenix_cendre", "Phénix de Cendre", "igneria", "Poussin de Phénix de Cendre", "Jeune Phénix de Cendre", "Phénix de Cendre adulte", "Cendraphénix", "feu"),

  // Umbrelune — 6, catalogue confidentiel
  species("cerf_minuit", "Cerf de Minuit", "umbrelune", "Faon de Minuit", "Jeune Cerf de Minuit", "Cerf de Minuit adulte", "Nocticerf", "ombre"),
  species("renard_silences", "Renard des Silences", "umbrelune", "Renardeau des Silences", "Jeune Renard des Silences", "Renard des Silences adulte", "Silencys", "ombre"),
  species("luciole_profondeurs", "Luciole des Profondeurs", "umbrelune", "Larve des Profondeurs", "Jeune Luciole des Profondeurs", "Luciole des Profondeurs adulte", "Abyssolux", "magie"),
  species("poisson_sources", "Poisson des Sources", "umbrelune", "Alevin des Sources", "Jeune Poisson des Sources", "Poisson des Sources adulte", "Sourcenox", "eau"),
  species("oiseau_voiles", "Oiseau des Voiles", "umbrelune", "Oisillon des Voiles", "Jeune Oiseau des Voiles", "Oiseau des Voiles adulte", "Voilombre", "air"),
  species("gardien_brumes", "Gardien des Brumes", "umbrelune", "Petit Gardien", "Gardien Éveillé", "Grand Gardien des Brumes", "Umbryon", "ombre")
] as const;

export function getInitialFantasyBestiaryRegion(
  regionKey: InitialFantasyBestiaryRegionKey
) {
  return INITIAL_FANTASY_BESTIARY_REGIONS.find((region) => region.key === regionKey);
}

/** N'affiche jamais Umbrelune ni ses espèces avant découverte explicite. */
export function listVisibleInitialFantasyBestiary(
  discoveredRegionKeys: ReadonlySet<string>
): readonly InitialFantasyBestiarySpecies[] {
  return INITIAL_FANTASY_BESTIARY.filter((entry) => {
    const region = getInitialFantasyBestiaryRegion(entry.regionKey);
    return region?.visibility === "public" || discoveredRegionKeys.has(entry.regionKey);
  });
}
