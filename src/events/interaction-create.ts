import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction
} from "discord.js";
import { getOrCreateAccount } from "../modules/accounts/account-service.js";
import {
  createCharacter,
  getActiveCharacter,
  PseudonymUnavailableError
} from "../modules/characters/character-service.js";
import {
  deleteCharacterDraft,
  getCharacterDraft,
  isPseudonymAvailable,
  saveCharacterDraft
} from "../modules/characters/character-draft-service.js";
import { getDatabasePool } from "../database/client.js";
import { logger } from "../core/logger.js";

function getDatabase() {
  return getDatabasePool(process.env.DATABASE_URL?.trim() || undefined);
}

async function getAccount(interaction: Interaction) {
  if (!interaction.isRepliable()) {
    throw new Error("Interaction Discord non compatible avec le compte.");
  }

  return getOrCreateAccount(getDatabase(), {
    provider: "discord",
    providerUserId: interaction.user.id,
    displayName: interaction.user.globalName ?? interaction.user.username
  });
}

function creationButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("etheria:character:begin")
      .setLabel("Créer mon personnage")
      .setStyle(ButtonStyle.Primary)
  );
}

function draftButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("etheria:character:edit")
      .setLabel("Modifier")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("etheria:character:confirm")
      .setLabel("Confirmer mon personnage")
      .setStyle(ButtonStyle.Success)
  );
}

function showCharacterModal(
  interaction: Extract<Interaction, { isButton: () => boolean }>,
  draft?: { firstName: string; publicPseudonym: string } | null
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("etheria:character:form")
    .setTitle("Créer ton personnage");

  const firstName = new TextInputBuilder()
    .setCustomId("first_name")
    .setLabel("Prénom du personnage")
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(100)
    .setRequired(true);

  const pseudonym = new TextInputBuilder()
    .setCustomId("public_pseudonym")
    .setLabel("Pseudonyme public Etheria")
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(100)
    .setRequired(true);

  if (draft) {
    firstName.setValue(draft.firstName);
    pseudonym.setValue(draft.publicPseudonym);
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(firstName),
    new ActionRowBuilder<TextInputBuilder>().addComponents(pseudonym)
  );

  return interaction.showModal(modal);
}

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

    if (interaction.isButton() && interaction.customId === "etheria:start") {
      await interaction.deferReply({ ephemeral: true });

      try {
        const account = await getAccount(interaction);
        const activeCharacter = await getActiveCharacter(getDatabase(), account.accountId);

        if (activeCharacter) {
          await interaction.editReply(
            `Bon retour dans Etheria, **${activeCharacter.publicPseudonym}** ! Ton personnage est au niveau ${activeCharacter.level}.`
          );
          return;
        }

        const draft = await getCharacterDraft(getDatabase(), account.accountId);
        await interaction.editReply({
          content: draft
            ? "Ton compte est prêt. Tu as déjà un brouillon de personnage : tu peux le reprendre."
            : "Ton compte Etheria est prêt. Il est maintenant temps de créer ton personnage.",
          components: [creationButton()]
        });
      } catch (error) {
        logger.error("Impossible de préparer la création du personnage.", error);
        await interaction.editReply(
          "Je n'ai pas pu accéder à ton compte Etheria. Réessaie un peu plus tard."
        );
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === "etheria:character:begin") {
      const account = await getAccount(interaction).catch(() => null);
      const draft = account
        ? await getCharacterDraft(getDatabase(), account.accountId).catch(() => null)
        : null;
      await showCharacterModal(interaction, draft);
      return;
    }

    if (interaction.isButton() && interaction.customId === "etheria:character:edit") {
      try {
        const account = await getAccount(interaction);
        const draft = await getCharacterDraft(getDatabase(), account.accountId);
        await showCharacterModal(interaction, draft);
      } catch (error) {
        logger.error("Impossible de récupérer le brouillon du personnage.", error);
        await interaction.reply({
          content: "Impossible de récupérer ton brouillon pour le moment. Réessaie.",
          ephemeral: true
        });
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === "etheria:character:form") {
      await interaction.deferReply({ ephemeral: true });

      try {
        const account = await getAccount(interaction);
        const activeCharacter = await getActiveCharacter(getDatabase(), account.accountId);

        if (activeCharacter) {
          await interaction.editReply(
            `Tu possèdes déjà un personnage actif : **${activeCharacter.publicPseudonym}**.`
          );
          return;
        }

        const firstName = interaction.fields.getTextInputValue("first_name").trim();
        const publicPseudonym = interaction.fields.getTextInputValue("public_pseudonym").trim();

        if (!(await isPseudonymAvailable(getDatabase(), publicPseudonym))) {
          await interaction.editReply({
            content: "Ce pseudonyme est déjà utilisé dans Etheria. Choisis-en un autre avant de continuer.",
            components: [creationButton()]
          });
          return;
        }

        await saveCharacterDraft(getDatabase(), {
          accountId: account.accountId,
          firstName,
          publicPseudonym
        });

        await interaction.editReply({
          content:
            "**Récapitulatif de ton personnage**\n\n" +
            `Prénom : **${firstName}**\n` +
            `Pseudonyme public : **${publicPseudonym}**\n\n` +
            "Âge initial : **13 ans**\n" +
            "Statut initial : **orphelin**\n" +
            "Origine : **attribuée aléatoirement par Etheria**\n\n" +
            "Tu peux encore modifier le prénom et le pseudonyme. Le pseudonyme ne sera réservé définitivement qu'après confirmation.",
          components: [draftButtons()]
        });
      } catch (error) {
        logger.error("Impossible d'enregistrer le brouillon du personnage.", error);
        await interaction.editReply(
          "Je n'ai pas pu enregistrer ton brouillon. Réessaie un peu plus tard."
        );
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === "etheria:character:confirm") {
      await interaction.deferReply({ ephemeral: true });

      try {
        const account = await getAccount(interaction);
        const existingCharacter = await getActiveCharacter(getDatabase(), account.accountId);

        if (existingCharacter) {
          await interaction.editReply(
            `Tu possèdes déjà un personnage actif : **${existingCharacter.publicPseudonym}**.`
          );
          return;
        }

        const draft = await getCharacterDraft(getDatabase(), account.accountId);
        if (!draft) {
          await interaction.editReply(
            "Je n'ai trouvé aucun brouillon. Recommence la création de ton personnage."
          );
          return;
        }

        const character = await createCharacter(getDatabase(), {
          accountId: account.accountId,
          firstName: draft.firstName,
          publicPseudonym: draft.publicPseudonym
        });

        await deleteCharacterDraft(getDatabase(), account.accountId);

        await interaction.editReply(
          `Ton personnage **${character.firstName}** est officiellement créé !\nPseudonyme public : **${character.publicPseudonym}**\nÂge : **13 ans**\nNiveau : **1**\n\nTon pseudonyme est désormais verrouillé définitivement.`
        );
      } catch (error) {
        if (error instanceof PseudonymUnavailableError) {
          await interaction.editReply({
            content: "Ce pseudonyme vient d'être utilisé par quelqu'un d'autre. Modifie-le pour confirmer ton personnage.",
            components: [creationButton()]
          });
          return;
        }

        logger.error("Impossible de confirmer le personnage.", error);
        await interaction.editReply(
          "Je n'ai pas pu confirmer ton personnage. Ton brouillon est conservé : tu pourras réessayer."
        );
      }
      return;
    }
  }
};
