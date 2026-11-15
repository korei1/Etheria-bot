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
    "zones-depart",
    "localites",
    "placer-pnj-localite",
    "itineraires",
    "ajouter-itineraire",
    "approuver-itineraire",
    "pnjs",
    "ajouter-pnj",
    "ajouter-dialogue",
    "ajouter-choix",
    "approuver-pnj",
    "visibilite-region",
    "contenus-locaux",
    "ajouter-contenu-local",
    "modifier-contenu-local",
    "approuver-contenu-local",
    "stocks-locaux",
    "ajouter-stock-local"
  ]);
  assert.ok(names.length <= 25, "Discord limite les sous-commandes à 25.");

  const routes = subcommands.find((option) => option.name === "itineraires");
  assert.ok(routes);
  assert.deepEqual(routes.options?.map((option) => option.name), ["pnj", "itineraire", "depart_dans"]);
  assert.ok(routes.options?.every((option) => !option.required));
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

test("la création de contenu local impose un rattachement et un ancrage culturel", () => {
  const subcommands = bestiaryAdminCommand.toJSON().options ?? [];
  const create = subcommands.find((option) => option.name === "ajouter-contenu-local");
  assert.ok(create);
  const required = create.options?.filter((option) => option.required).map((option) => option.name);
  assert.deepEqual(required, [
    "cle", "nom", "localite", "type", "visibilite", "description", "tags", "justification"
  ]);
  const kind = create.options?.find((option) => option.name === "type");
  assert.deepEqual(kind?.choices?.map((choice) => choice.value), [
    "activity", "service", "shop", "event"
  ]);
});

test("la modification et l'approbation des contenus locaux exigent une révision", () => {
  const subcommands = bestiaryAdminCommand.toJSON().options ?? [];
  for (const name of ["modifier-contenu-local", "approuver-contenu-local"]) {
    const command = subcommands.find((option) => option.name === name);
    assert.ok(command);
    assert.ok(command.options?.some((option) => option.name === "revision" && option.required));
  }
});

test("les commandes de gestion des horaires et stocks sont exposées", () => {
  const options = bestiaryAdminCommand.toJSON().options ?? [];
  const modify = options.find((option) => option.name === "modifier-contenu-local");
  assert.ok(modify?.options?.some((option) => option.name === "horaires_json"));
  assert.ok(options.some((option) => option.name === "stocks-locaux"));
  assert.ok(options.some((option) => option.name === "ajouter-stock-local"));
});

test("les options obligatoires précèdent toujours les options facultatives", () => {
  for (const command of bestiaryAdminCommand.toJSON().options ?? []) {
    let optionalSeen = false;
    for (const option of command.options ?? []) {
      if (option.required === false) optionalSeen = true;
      if (option.required === true) {
        assert.equal(optionalSeen, false, `Option obligatoire placée après une option facultative dans ${command.name}.`);
      }
    }
  }
});
