import type { Pool } from "pg";
import type {
  CompanionSpeciesAvailabilityStatus,
  CompanionSpeciesEditorialStatus,
  CompanionRegionVisibility
} from "./companion-species-registry.js";

export interface PersistedCompanionSpecies {
  key: string;
  name: string;
  regionKey: string;
  element: string;
  editorialStatus: CompanionSpeciesEditorialStatus;
  availabilityStatus: CompanionSpeciesAvailabilityStatus;
  revision: number;
  forms: readonly { key: string; name: string; order: number }[];
}

interface SpeciesRow {
  species_key: string;
  display_name: string;
  region_key: string;
  element: string;
  editorial_status: CompanionSpeciesEditorialStatus;
  availability_status: CompanionSpeciesAvailabilityStatus;
  revision: number;
}

export class CompanionSpeciesCatalogRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionSpeciesCatalogRepositoryError";
  }
}

/** Lecture du catalogue public. La progression de découverte est fournie par le système de monde. */
export async function listVisiblePersistedCompanionSpecies(
  pool: Pool,
  discoveredRegionKeys: readonly string[]
): Promise<PersistedCompanionSpecies[]> {
  const result = await pool.query<SpeciesRow>(
    `SELECT s.species_key, s.display_name, s.region_key, s.element,
            s.editorial_status, s.availability_status, s.revision
     FROM companion_species_catalog s
     JOIN companion_regions r ON r.region_key = s.region_key
     WHERE s.editorial_status = 'approved'
       AND s.availability_status IN ('discoverable', 'available')
       AND (r.visibility = 'public' OR r.region_key = ANY($1::text[]))
     ORDER BY s.region_key, s.species_key`,
    [discoveredRegionKeys]
  );
  if (result.rows.length === 0) return [];
  const keys = result.rows.map((row) => row.species_key);
  const forms = await pool.query<{
    species_key: string;
    form_key: string;
    display_name: string;
    form_order: number;
  }>(
    `SELECT species_key, form_key, display_name, form_order
     FROM companion_species_forms
     WHERE species_key = ANY($1::text[])
     ORDER BY species_key, form_order`,
    [keys]
  );
  const bySpecies = new Map<string, { key: string; name: string; order: number }[]>();
  for (const form of forms.rows) {
    const entries = bySpecies.get(form.species_key) ?? [];
    entries.push({ key: form.form_key, name: form.display_name, order: form.form_order });
    bySpecies.set(form.species_key, entries);
  }
  return result.rows.map((row) => ({
    key: row.species_key,
    name: row.display_name,
    regionKey: row.region_key,
    element: row.element,
    editorialStatus: row.editorial_status,
    availabilityStatus: row.availability_status,
    revision: row.revision,
    forms: bySpecies.get(row.species_key) ?? []
  }));
}

/**
 * Action administrative transactionnelle avec contrôle de révision et journal immuable.
 * L'appelant doit déjà avoir authentifié et autorisé l'administrateur.
 */
export async function setPersistedSpeciesAvailability(
  pool: Pool,
  input: {
    speciesKey: string;
    nextStatus: CompanionSpeciesAvailabilityStatus;
    expectedRevision: number;
    actorAccountId?: string | null;
    idempotencyKey?: string;
  }
): Promise<{ revision: number; availabilityStatus: CompanionSpeciesAvailabilityStatus }> {
  if (!input.speciesKey.trim() || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new CompanionSpeciesCatalogRepositoryError("Clé d'espèce ou révision attendue invalide.");
  }
  const transitions: Readonly<Record<CompanionSpeciesAvailabilityStatus, readonly CompanionSpeciesAvailabilityStatus[]>> = {
    unavailable: ["discoverable", "retired"],
    discoverable: ["available", "retired"],
    available: ["retired"],
    retired: []
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<SpeciesRow>(
      `SELECT species_key, display_name, region_key, element, editorial_status,
              availability_status, revision
       FROM companion_species_catalog
       WHERE species_key = $1
       FOR UPDATE`,
      [input.speciesKey]
    );
    const current = selected.rows[0];
    if (!current) throw new CompanionSpeciesCatalogRepositoryError("Espèce inconnue.");
    if (current.revision !== input.expectedRevision) {
      throw new CompanionSpeciesCatalogRepositoryError("La fiche a changé : rechargez-la avant de modifier son statut.");
    }
    if (current.editorial_status !== "approved") {
      throw new CompanionSpeciesCatalogRepositoryError("Une espèce doit être approuvée avant sa disponibilité.");
    }
    if (!transitions[current.availability_status].includes(input.nextStatus)) {
      throw new CompanionSpeciesCatalogRepositoryError("Transition de disponibilité interdite.");
    }
    const before = {
      availabilityStatus: current.availability_status,
      revision: current.revision
    };
    const updated = await client.query<{ revision: number; availability_status: CompanionSpeciesAvailabilityStatus }>(
      `UPDATE companion_species_catalog
       SET availability_status = $2, revision = revision + 1, updated_at = NOW()
       WHERE species_key = $1
       RETURNING revision, availability_status`,
      [input.speciesKey, input.nextStatus]
    );
    const next = updated.rows[0]!;
    await client.query(
      `INSERT INTO companion_species_admin_events
       (actor_account_id, action, entity_type, entity_key, revision, before_state, after_state, idempotency_key)
       VALUES ($1, $2, 'species', $3, $4, $5::jsonb, $6::jsonb, $7::uuid)`,
      [
        input.actorAccountId ?? null,
        input.nextStatus === "retired" ? "species_retired" : "species_availability_changed",
        input.speciesKey,
        next.revision,
        JSON.stringify(before),
        JSON.stringify({ availabilityStatus: next.availability_status, revision: next.revision }),
        input.idempotencyKey ?? null
      ]
    );
    await client.query("COMMIT");
    return { revision: next.revision, availabilityStatus: next.availability_status };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Les régions secrètes ne deviennent publiques que par une action administrative explicite. */
export async function setPersistedRegionVisibility(
  pool: Pool,
  input: {
    regionKey: string;
    visibility: CompanionRegionVisibility;
    expectedRevision: number;
    actorAccountId?: string | null;
    idempotencyKey?: string;
  }
): Promise<{ revision: number; visibility: CompanionRegionVisibility }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<{
      region_key: string;
      visibility: CompanionRegionVisibility;
      revision: number;
    }>(
      "SELECT region_key, visibility, revision FROM companion_regions WHERE region_key = $1 FOR UPDATE",
      [input.regionKey]
    );
    const current = selected.rows[0];
    if (!current) throw new CompanionSpeciesCatalogRepositoryError("Région inconnue.");
    if (current.revision !== input.expectedRevision) {
      throw new CompanionSpeciesCatalogRepositoryError("La région a changé : rechargez-la avant de modifier sa visibilité.");
    }
    if (current.visibility === input.visibility) {
      throw new CompanionSpeciesCatalogRepositoryError("La région possède déjà cette visibilité.");
    }
    const updated = await client.query<{ revision: number; visibility: CompanionRegionVisibility }>(
      `UPDATE companion_regions SET visibility = $2, revision = revision + 1, updated_at = NOW()
       WHERE region_key = $1 RETURNING revision, visibility`,
      [input.regionKey, input.visibility]
    );
    const next = updated.rows[0]!;
    await client.query(
      `INSERT INTO companion_species_admin_events
       (actor_account_id, action, entity_type, entity_key, revision, before_state, after_state, idempotency_key)
       VALUES ($1, 'region_updated', 'region', $2, $3, $4::jsonb, $5::jsonb, $6::uuid)`,
      [
        input.actorAccountId ?? null,
        input.regionKey,
        next.revision,
        JSON.stringify({ visibility: current.visibility, revision: current.revision }),
        JSON.stringify({ visibility: next.visibility, revision: next.revision }),
        input.idempotencyKey ?? null
      ]
    );
    await client.query("COMMIT");
    return { revision: next.revision, visibility: next.visibility };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}


/** Crée une nouvelle région sans plafond global et journalise sa création. */
export async function createPersistedCompanionRegion(
  pool: Pool,
  input: {
    regionKey: string;
    name: string;
    visibility: CompanionRegionVisibility;
    actorAccountId?: string | null;
    idempotencyKey?: string;
  }
): Promise<void> {
  if (!/^[a-z][a-z0-9_]*$/.test(input.regionKey) || !input.name.trim()) {
    throw new CompanionSpeciesCatalogRepositoryError("Clé ou nom de région invalide.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO companion_regions (region_key, display_name, visibility) VALUES ($1, $2, $3)",
      [input.regionKey, input.name.trim(), input.visibility]
    );
    await client.query(
      `INSERT INTO companion_species_admin_events
       (actor_account_id, action, entity_type, entity_key, revision, after_state, idempotency_key)
       VALUES ($1, 'region_created', 'region', $2, 1, $3::jsonb, $4::uuid)`,
      [input.actorAccountId ?? null, input.regionKey,
       JSON.stringify({ name: input.name.trim(), visibility: input.visibility }), input.idempotencyKey ?? null]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Ajoute une fiche et ses formes sans lui inventer de paramètres de gameplay. */
export async function createPersistedEditorialSpecies(
  pool: Pool,
  input: {
    speciesKey: string;
    name: string;
    regionKey: string;
    element: string;
    editorialStatus?: "draft" | "approved";
    forms: readonly { key: string; name: string; order: number }[];
    actorAccountId?: string | null;
    idempotencyKey?: string;
  }
): Promise<void> {
  if (!/^[a-z][a-z0-9_]*$/.test(input.speciesKey) || !input.name.trim() ||
    !/^[a-z][a-z0-9_]*$/.test(input.regionKey) ||
    !["eau", "feu", "electrique", "terre", "air", "magie", "psy", "ombre"].includes(input.element) ||
    input.forms.length < 2) {
    throw new CompanionSpeciesCatalogRepositoryError("La fiche éditoriale est incomplète ou invalide.");
  }
  const formKeys = new Set<string>();
  const formOrders = new Set<number>();
  for (const form of input.forms) {
    if (!/^[a-z][a-z0-9_]*$/.test(form.key) || !form.name.trim() ||
      !Number.isInteger(form.order) || form.order < 0 ||
      formKeys.has(form.key) || formOrders.has(form.order)) {
      throw new CompanionSpeciesCatalogRepositoryError("Une forme de la fiche est invalide ou dupliquée.");
    }
    formKeys.add(form.key);
    formOrders.add(form.order);
  }
  const editorialStatus = input.editorialStatus ?? "draft";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO companion_species_catalog
       (species_key, display_name, region_key, element, editorial_status, availability_status)
       VALUES ($1, $2, $3, $4, $5, 'unavailable')`,
      [input.speciesKey, input.name.trim(), input.regionKey, input.element, editorialStatus]
    );
    for (const form of input.forms) {
      await client.query(
        `INSERT INTO companion_species_forms (species_key, form_key, display_name, form_order)
         VALUES ($1, $2, $3, $4)`,
        [input.speciesKey, form.key, form.name.trim(), form.order]
      );
    }
    await client.query(
      `INSERT INTO companion_species_admin_events
       (actor_account_id, action, entity_type, entity_key, revision, after_state, idempotency_key)
       VALUES ($1, 'species_created', 'species', $2, 1, $3::jsonb, $4::uuid)`,
      [input.actorAccountId ?? null, input.speciesKey,
       JSON.stringify({ name: input.name.trim(), regionKey: input.regionKey, element: input.element,
         editorialStatus, availabilityStatus: "unavailable", forms: input.forms }), input.idempotencyKey ?? null]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Valide une fiche brouillon ; la disponibilité reste séparément indisponible. */
export async function approvePersistedEditorialSpecies(
  pool: Pool,
  input: {
    speciesKey: string;
    expectedRevision: number;
    actorAccountId?: string | null;
    idempotencyKey?: string;
  }
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<{ editorial_status: string; availability_status: string; revision: number }>(
      "SELECT editorial_status, availability_status, revision FROM companion_species_catalog WHERE species_key = $1 FOR UPDATE",
      [input.speciesKey]
    );
    const current = selected.rows[0];
    if (!current) throw new CompanionSpeciesCatalogRepositoryError("Espèce inconnue.");
    if (current.revision !== input.expectedRevision || current.editorial_status !== "draft" ||
      current.availability_status !== "unavailable") {
      throw new CompanionSpeciesCatalogRepositoryError("La fiche ne peut pas être approuvée dans son état actuel.");
    }
    const updated = await client.query<{ revision: number }>(
      `UPDATE companion_species_catalog
       SET editorial_status = 'approved', revision = revision + 1, updated_at = NOW()
       WHERE species_key = $1 RETURNING revision`,
      [input.speciesKey]
    );
    const revision = updated.rows[0]!.revision;
    await client.query(
      `INSERT INTO companion_species_admin_events
       (actor_account_id, action, entity_type, entity_key, revision, before_state, after_state, idempotency_key)
       VALUES ($1, 'species_updated', 'species', $2, $3, $4::jsonb, $5::jsonb, $6::uuid)`,
      [input.actorAccountId ?? null, input.speciesKey, revision,
       JSON.stringify({ editorialStatus: current.editorial_status, availabilityStatus: current.availability_status }),
       JSON.stringify({ editorialStatus: "approved", availabilityStatus: "unavailable" }),
       input.idempotencyKey ?? null]
    );
    await client.query("COMMIT");
    return revision;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
