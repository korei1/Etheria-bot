import assert from "node:assert/strict";
import test from "node:test";
import { etheriaCommand } from "../src/commands/etheria.js";

test("/etheria expose la carte personnelle et la progression", () => {
  const definition = etheriaCommand.toJSON();
  assert.equal(definition.name, "etheria");
  const subcommands = definition.options?.map((option) => option.name) ?? [];
  assert.deepEqual(subcommands, ["rencontrer", "carte", "progression"]);
});
