import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  type Interaction
} from "discord.js";
import { getOrCreateAccount } from "../modules/accounts/account-service.js";
import { getDatabasePool } from "../database/client.js";
import { logger } from "../core/logger.js";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand() && interaction.commandName === "etheria") {
      const startButton = new ButtonBuilder()
        .setCustomId("etheria:start")
        .setLabel("Commencer")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(startButton);

      await interaction.reply({
        content: "Bienvenue dans Etheria. Clique sur **Commencer** pour créer ton compte et débuter ton aventure.",
        components: [row],
        ephemeral: true
      });
      return;
    }

    if (!interaction.isButton() || interaction.customId !== "etheria:start") {
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const database = getDatabasePool(process.env.DATABASE_URL?.trim() || undefined);
      const account = await getOrCreateAccount(database, {
        provider: "discord",
        providerUserId: interaction.user.id,
        displayName: interaction.user.globalName ?? interaction.user.username
      });

      await interaction.editReply(
        account.created
          ? `Ton compte Etheria est créé, **${account.displayName}** ! Ton aventure peut commencer.`
          : `Bon retour dans Etheria, **${account.displayName}** ! Ton compte a bien été retrouvé.`
      );
    } catch {
      logger.error("Impossible de créer ou retrouver le compte Etheria.");
      await interaction.editReply(
        "Je n'ai pas pu accéder à ton compte Etheria. Réessaie un peu plus tard."
      );
    }
  }
};
