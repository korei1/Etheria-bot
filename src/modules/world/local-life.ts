/**
 * Fondation éditoriale de la vie locale d'Etheria.
 *
 * Les contenus sont rattachés à une localité et à son identité continentale.
 * Aucun commerce, habitant, activité ou événement n'est prérempli.
 */

export type LocalContentKind = "activity" | "service" | "shop" | "event";
export type LocalContentStatus = "draft" | "approved" | "retired";
export type LocalContentVisibility = "public" | "discovery_locked";

export type WorldContinentKey =
  | "sylvaria"
  | "niveria"
  | "arcanthia"
  | "solmeria"
  | "thalassea"
  | "igneria"
  | "umbrelune";

export interface ContinentCulturalIdentity {
  key: WorldContinentKey;
  displayName: string;
  publicByDefault: boolean;
  identity: string;
  culturalAnchors: readonly string[];
  festivalName: string;
  festivalDurationDays?: number;
  festivalStartDay?: number;
}

export const CONTINENT_CULTURAL_IDENTITIES: readonly ContinentCulturalIdentity[] = [
  {
    key: "sylvaria",
    displayName: "Sylvaria",
    publicByDefault: true,
    identity: "La mémoire vivante d'Etheria : gardienne de l'histoire du monde et centre historique et culturel.",
    culturalAnchors: ["mémoire collective", "archives", "récits", "grandes légendes", "histoire étudiée et transmise"],
    festivalName: "Souvenance",
    festivalDurationDays: 7,
    festivalStartDay: 114
  },
  {
    key: "niveria",
    displayName: "Nivéria",
    publicByDefault: true,
    identity: "Un continent où la beauté, les arts et la chaleur humaine s'épanouissent malgré le climat glacial.",
    culturalAnchors: ["beauté", "arts", "chaleur humaine", "inventions", "cadeaux", "prouesses"],
    festivalName: "Luminéa",
    festivalDurationDays: 30
  },
  {
    key: "arcanthia",
    displayName: "Arcanthia",
    publicByDefault: true,
    identity: "Un continent où science et croyances sont complémentaires, entre recherche, intériorité et phénomènes célestes.",
    culturalAnchors: ["science", "croyances", "recherche", "intériorité", "phénomènes célestes"],
    festivalName: "Sérénith"
  },
  {
    key: "solmeria",
    displayName: "Solméria",
    publicByDefault: true,
    identity: "Un continent attaché à la justice, à l'honneur, à la sincérité et à l'entraide.",
    culturalAnchors: ["justice", "honneur", "sincérité", "entraide", "solidarité"],
    festivalName: "Concordia"
  },
  {
    key: "thalassea",
    displayName: "Thalasséa",
    publicByDefault: true,
    identity: "Un continent de liberté, d'indépendance, d'aventure et de découverte, entouré de nombreuses îles indépendantes.",
    culturalAnchors: ["liberté", "indépendance", "aventure", "découverte", "cultures insulaires"],
    festivalName: "Horizéa"
  },
  {
    key: "igneria",
    displayName: "Ignéria",
    publicByDefault: true,
    identity: "Le continent où la force se démontre par les actes : grand rendez-vous des combattants et des aventuriers.",
    culturalAnchors: ["puissance", "courage", "maîtrise", "stratégie", "épreuves encadrées"],
    festivalName: "Ardence",
    festivalDurationDays: 2,
    festivalStartDay: 60
  },
  {
    key: "umbrelune",
    displayName: "Umbrelune",
    publicByDefault: false,
    identity: "Un continent secret aux villes cachées, à la vie nocturne discrète et aux vérités oubliées.",
    culturalAnchors: ["secrets", "discrétion", "vie nocturne", "intimité", "vérités oubliées"],
    festivalName: "Secretine"
  }
] as const;

export interface LocalContentDefinition {
  key: string;
  name: string;
  settlementKey: string;
  continentKey: WorldContinentKey;
  kind: LocalContentKind;
  status: LocalContentStatus;
  visibility: LocalContentVisibility;
  description: string;
  /** Tags éditoriaux qui relient explicitement le contenu à la culture locale. */
  culturalTags: readonly string[];
  /** Justification éditoriale : explique comment le contenu reflète l'identité du continent. */
  culturalRationale: string;
  /** Données propres au type, validées par le module métier concerné. */
  payload?: Readonly<Record<string, unknown>>;
  /** Jour de l'année Etheria (1 à 120), réservé aux événements datés. */
  startDay?: number;
  endDay?: number;
}

export interface LocalContentValidationContext {
  settlementKeys: ReadonlySet<string>;
  settlementContinents: ReadonlyMap<string, WorldContinentKey>;
}

const validKey = (value: string): boolean => /^[a-z][a-z0-9_]*$/.test(value);
const contentKinds = new Set<LocalContentKind>(["activity", "service", "shop", "event"]);
const contentStatuses = new Set<LocalContentStatus>(["draft", "approved", "retired"]);
const visibilityValues = new Set<LocalContentVisibility>(["public", "discovery_locked"]);

export function validateLocalContent(
  entries: readonly LocalContentDefinition[],
  context: LocalContentValidationContext
): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();

  for (const entry of entries) {
    if (!validKey(entry.key) || !entry.name.trim()) {
      issues.push(`[${entry.key}] Clé ou nom de contenu invalide.`);
    }
    if (keys.has(entry.key)) issues.push(`[vie locale] Clé dupliquée : ${entry.key}.`);
    keys.add(entry.key);

    if (!context.settlementKeys.has(entry.settlementKey)) {
      issues.push(`[${entry.key}] Localité inconnue : ${entry.settlementKey}.`);
    }
    const actualContinent = context.settlementContinents.get(entry.settlementKey);
    if (actualContinent && actualContinent !== entry.continentKey) {
      issues.push(`[${entry.key}] Le continent ne correspond pas à celui de la localité.`);
    }
    if (!contentKinds.has(entry.kind)) issues.push(`[${entry.key}] Type de contenu inconnu.`);
    if (!contentStatuses.has(entry.status)) issues.push(`[${entry.key}] Statut éditorial inconnu.`);
    if (!visibilityValues.has(entry.visibility)) issues.push(`[${entry.key}] Visibilité inconnue.`);
    if (!entry.description.trim()) issues.push(`[${entry.key}] Une description est obligatoire.`);
    if (entry.culturalTags.length === 0 || entry.culturalTags.some((tag) => !tag.trim())) {
      issues.push(`[${entry.key}] Au moins un ancrage culturel non vide est obligatoire.`);
    }
    if (!entry.culturalRationale.trim()) {
      issues.push(`[${entry.key}] La justification culturelle est obligatoire.`);
    }
    if (entry.kind !== "event" && (entry.startDay !== undefined || entry.endDay !== undefined)) {
      issues.push(`[${entry.key}] Seuls les événements peuvent avoir des dates calendaires.`);
    }
    if (entry.kind === "event") {
      if ((entry.startDay === undefined) !== (entry.endDay === undefined)) {
        issues.push(`[${entry.key}] Les deux bornes calendaires doivent être renseignées ensemble.`);
      }
      if (entry.startDay !== undefined && entry.endDay !== undefined) {
        if (!Number.isInteger(entry.startDay) || !Number.isInteger(entry.endDay) ||
            entry.startDay < 1 || entry.endDay > 120 || entry.endDay < entry.startDay) {
          issues.push(`[${entry.key}] La période doit être comprise entre les jours 1 et 120.`);
        }
      }
    }
    if (entry.continentKey === "umbrelune" && entry.visibility === "public") {
      issues.push(`[${entry.key}] Un contenu d'Umbrelune ne peut pas être public.`);
    }
  }

  return [...new Set(issues)];
}

export function listVisibleLocalContent(
  entries: readonly LocalContentDefinition[],
  input: {
    settlementKey: string;
    discoveredSettlementKeys: ReadonlySet<string>;
    discoveredContentKeys?: ReadonlySet<string>;
  }
): readonly LocalContentDefinition[] {
  return entries.filter((entry) => {
    if (entry.status !== "approved" || entry.settlementKey !== input.settlementKey) return false;
    if (entry.visibility === "discovery_locked") {
      return input.discoveredContentKeys?.has(entry.key) === true;
    }
    return input.discoveredSettlementKeys.has(entry.settlementKey);
  });
}
