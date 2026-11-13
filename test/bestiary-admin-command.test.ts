import assert from "node:assert/strict";
import test from "node:test";
import { PermissionFlagsBits } from "discord.js";
import { bestiaryAdminCommand } from "../src/commands/bestiary-admin.js";

test("la commande d'administration du bestiaire est réservée aux administrateurs", () => {
  const definition = bestiaryAdminCommand.toJSON();
  assert.equal(definition.name, "etheria-admin");
  assert.equal(definition.default_member_permissions, PermissionFlagsBits.Administrator.toString());
  assert.equal(definition.dm_permission, false);
});

test("les opérations administratives essentielles sont exposées", () => {
  const subcommands = bestiaryAdminCommand.toJSON().options ?? [];
  const names = subcommands.map((option) => option.name);
  assert.deepEqual(names, [
    "historique",
    "regions",
    "especes",
    "disponibilite",
    "ajouter-region",
    "ajouter-espece",
    "approuver",
    "visibilite-region"
  ]);
});

test("la disponibilité ne permet pas de réactiver directement une espèce retirée", () => {
  const availability = bestiaryAdminCommand.toJSON().options?.find(
    (option) => option.name === "disponibilite"
  );
  assert.ok(availability);
  const status = availability.options?.find((option) => option.name === "statut");
  assert.ok(status);
  assert.deepEqual(
    status.choices?.map((choice) => choice.value),
    ["discoverable", "available", "retired"]
  );
});
