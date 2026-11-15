import { SlashCommandBuilder } from "discord.js";

export const etheriaCommand = new SlashCommandBuilder()
  .setName("etheria")
  .setDescription("Découvrir et commencer ton aventure dans Etheria.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rencontrer")
      .setDescription("Chercher un habitant présent dans ton lieu actuel.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("voyager")
      .setDescription("Consulter les itinéraires accessibles depuis ton lieu actuel.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("carte")
      .setDescription("Consulter les lieux déjà découverts dans ta carte personnelle.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("localite")
      .setDescription("Consulter les activités, services et commerces de ta localité actuelle.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("progression")
      .setDescription("Consulter ta progression de découverte dans Etheria.")
  );
