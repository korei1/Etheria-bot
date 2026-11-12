import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Interaction
} from "discord.js";
import { getOrCreateAccount } from "../modules/accounts/account-service.js";
import {
  createCharacter,
  getActiveCharacter,
  PseudonymUnavailableError,
  AvatarModelUnavailableError,
  NoOriginCountryAvailableError,
  NoStartingSpawnAvailableError
} from "../modules/characters/character-service.js";
import {
  type CharacterGender,
  deleteCharacterDraft,
  getCharacterDraft,
  isPseudonymAvailable,
  saveCharacterDraft
} from "../modules/characters/character-draft-service.js";
import { listActiveAvatarModels } from "../modules/characters/avatar-model-service.js";
import {
  getInitialExplorationState,
  performInitialExplorationAction,
  type InitialExplorationAction,
  type InitialExplorationScene
} from "../modules/exploration/initial-exploration-service.js";
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

function genderSelectionPayload() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("etheria:character:gender:femme").setLabel("Femme").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("etheria:character:gender:homme").setLabel("Homme").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("etheria:character:gender:agenre").setLabel("Agenre (sans genre)").setStyle(ButtonStyle.Secondary)
  );
  return { content: "Choisis le genre de ton personnage.", components: [row] };
}

function avatarSelectionPayload(models: Awaited<ReturnType<typeof listActiveAvatarModels>>) {
  const visibleModels = models.slice(0, 10);
  const embeds = visibleModels.map((model) =>
    new EmbedBuilder()
      .setTitle(model.displayName)
      .setDescription(model.description ?? "Modèle prédéfini")
      .setImage(model.imageUrl)
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < visibleModels.length; index += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const model of visibleModels.slice(index, index + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`etheria:character:avatar:${model.modelKey}`)
          .setLabel(model.displayName.slice(0, 80))
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("etheria:character:edit")
        .setLabel("Modifier le prénom ou le pseudonyme")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return {
    content: "Choisis un modèle prédéfini correspondant au genre sélectionné. La personnalisation physique complète n'est pas disponible en V1.",
    embeds,
    components: rows
  };
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


function explorationButton(customId: string, label: string, style = ButtonStyle.Primary) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

function initialExplorationPayload(scene: InitialExplorationScene, inspectedPath = false) {
  if (scene === "awakening") {
    return {
      content: "**Tu ouvres les yeux.** Tu es seul, au milieu de la nature. Tu ne sais pas où tu te trouves. Une brise passe près de toi. Tu peux prendre le temps de percevoir ce qui t'entoure.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:listen_wind", "Écouter le vent"),
          explorationButton("etheria:exploration:observe_surroundings", "Observer autour de moi", ButtonStyle.Secondary)
        )
      ]
    };
  }

  if (scene === "wind_perceived") {
    return {
      content: "Tu prends le temps d'écouter. Le souffle du vent devient plus perceptible. En prêtant attention à ses variations et à ce que tu ressens sur ta peau, tu peux en suivre la direction.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:follow_wind", "Suivre le vent"),
          explorationButton("etheria:exploration:observe_surroundings", "Observer encore", ButtonStyle.Secondary)
        )
      ]
    };
  }

  return {
    content: inspectedPath
      ? "Tu examines le passage. Il descend naturellement le long de la falaise. Tu peux l'emprunter quand tu le souhaites, sans être obligé de te précipiter."
      : "En suivant le vent, tu arrives au bord d'une falaise. Depuis ce point élevé, tu distingues mieux le paysage alentour. Un passage naturel permet de descendre. Tu ne sais toujours pas où tu te trouves.",
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        explorationButton("etheria:exploration:inspect_path", "Examiner le passage"),
        explorationButton("etheria:exploration:observe_surroundings", "Observer le paysage", ButtonStyle.Secondary)
      )
    ]
  };
}

function showCharacterModal(
  interaction: ButtonInteraction,
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
          const exploration = await getInitialExplorationState(
            getDatabase(),
            account.accountId,
            activeCharacter.id
          );
          await interaction.editReply({
            content: `Bon retour dans Etheria, **${activeCharacter.publicPseudonym}** ! Ton personnage est au niveau ${activeCharacter.level}.\\n\\n`,
            ...initialExplorationPayload(exploration.scene)
          });
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


    if (interaction.isButton() && interaction.customId.startsWith("etheria:exploration:")) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const account = await getAccount(interaction);
        const character = await getActiveCharacter(getDatabase(), account.accountId);
        if (!character) {
          await interaction.editReply("Aucun personnage actif n'a été trouvé. Commence par créer ton personnage.");
          return;
        }

        const action = interaction.customId.slice("etheria:exploration:".length) as InitialExplorationAction;
        const allowedActions: InitialExplorationAction[] = [
          "listen_wind", "observe_surroundings", "follow_wind", "inspect_path"
        ];
        if (!allowedActions.includes(action)) {
          await interaction.editReply("Cette action d'exploration n'est pas reconnue.");
          return;
        }

        const state = await performInitialExplorationAction(getDatabase(), {
          interactionId: interaction.id,
          accountId: account.accountId,
          characterId: character.id,
          action
        });
        await interaction.editReply(
          initialExplorationPayload(state.scene, action === "inspect_path")
        );
      } catch (error) {
        logger.error("Impossible d'enregistrer l'action d'exploration.", error);
        await interaction.editReply(
          "Je n'ai pas pu enregistrer cette action. Ta progression précédente est conservée."
        );
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === "etheria:character:begin") {
      try {
        const account = await getAccount(interaction);
        const draft = await getCharacterDraft(getDatabase(), account.accountId);
        await showCharacterModal(interaction, draft);
      } catch (error) {
        logger.error("Impossible de démarrer la création du personnage.", error);
        await interaction.reply({
          content: "Impossible de démarrer la création de ton personnage pour le moment. Réessaie.",
          ephemeral: true
        });
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("etheria:character:gender:")) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const account = await getAccount(interaction);
        const draft = await getCharacterDraft(getDatabase(), account.accountId);
        if (!draft) {
          await interaction.editReply("Je n'ai trouvé aucun brouillon. Recommence la création du personnage.");
          return;
        }
        const gender = interaction.customId.slice("etheria:character:gender:".length) as CharacterGender;
        if (!["femme", "homme", "agenre"].includes(gender)) {
          await interaction.editReply("Ce choix de genre n'est pas valide.");
          return;
        }
        await saveCharacterDraft(getDatabase(), {
          accountId: account.accountId,
          firstName: draft.firstName,
          publicPseudonym: draft.publicPseudonym,
          genderIdentity: gender,
          avatarModelKey: null
        });
        const models = await listActiveAvatarModels(getDatabase(), gender);
        if (models.length === 0) {
          await interaction.editReply("Aucun modèle prédéfini n'est encore configuré pour ce genre. Ton brouillon est conservé.");
          return;
        }
        await interaction.editReply(avatarSelectionPayload(models));
      } catch (error) {
        logger.error("Impossible d'enregistrer le genre du personnage.", error);
        await interaction.editReply("Impossible d'enregistrer ce choix pour le moment. Réessaie.");
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("etheria:character:avatar:")) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const account = await getAccount(interaction);
        const draft = await getCharacterDraft(getDatabase(), account.accountId);
        if (!draft) {
          await interaction.editReply("Je n'ai trouvé aucun brouillon. Recommence la création du personnage.");
          return;
        }

        const modelKey = interaction.customId.slice("etheria:character:avatar:".length);
        if (!draft.genderIdentity) {
          await interaction.editReply(genderSelectionPayload());
          return;
        }
        const models = await listActiveAvatarModels(getDatabase(), draft.genderIdentity);
        const selectedModel = models.find((model) => model.modelKey === modelKey);
        if (!selectedModel) {
          await interaction.editReply("Ce modèle n'est plus disponible. Recommence le choix de l'avatar.");
          return;
        }

        await saveCharacterDraft(getDatabase(), {
          accountId: account.accountId,
          firstName: draft.firstName,
          publicPseudonym: draft.publicPseudonym,
          genderIdentity: draft.genderIdentity,
          avatarModelKey: selectedModel.modelKey
        });

        const preview = new EmbedBuilder()
          .setTitle(selectedModel.displayName)
          .setDescription(selectedModel.description ?? "Apparence choisie")
          .setImage(selectedModel.imageUrl);

        await interaction.editReply({
          content:
            "**Récapitulatif de ton personnage**\n\n" +
            `Prénom : **${draft.firstName}**\n` +
            `Pseudonyme public : **${draft.publicPseudonym}**\n` +
            `Genre : **${draft.genderIdentity}**\n` +
            `Avatar : **${selectedModel.displayName}**\n\n` +
            "Âge initial : **13 ans**\n" +
            "Statut initial : **orphelin**\n\n" +
            "Ton lieu d'apparition reste secret. Tu le découvriras grâce au premier PNJ rencontré. Tu peux encore modifier ton prénom, ton pseudonyme, ton genre et ton avatar avant la confirmation.",
          embeds: [preview],
          components: [draftButtons()]
        });
      } catch (error) {
        logger.error("Impossible d'enregistrer le choix d'avatar.", error);
        await interaction.editReply("Impossible d'enregistrer ce modèle pour le moment. Réessaie.");
      }
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

        // Le brouillon est conservé même si le pseudonyme est déjà pris :
        // le joueur peut le corriger sans perdre son prénom.
        const previousDraft = await getCharacterDraft(getDatabase(), account.accountId);
        await saveCharacterDraft(getDatabase(), {
          accountId: account.accountId,
          firstName,
          publicPseudonym,
          genderIdentity: previousDraft?.genderIdentity ?? null,
          avatarModelKey: previousDraft?.avatarModelKey ?? null
        });

        if (!(await isPseudonymAvailable(getDatabase(), publicPseudonym))) {
          await interaction.editReply({
            content: "Ce pseudonyme est déjà utilisé dans Etheria. Ton prénom est conservé : modifie le pseudonyme pour continuer.",
            components: [creationButton()]
          });
          return;
        }

        await interaction.editReply(genderSelectionPayload());
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
          publicPseudonym: draft.publicPseudonym,
          avatarModelKey: draft.avatarModelKey,
          genderIdentity: draft.genderIdentity ?? undefined
        });

        await deleteCharacterDraft(getDatabase(), account.accountId);

        await interaction.editReply({
          content:
            `Ton personnage **${character.firstName}** est officiellement créé !\\nPseudonyme public : **${character.publicPseudonym}**\\nÂge : **13 ans**\\nNiveau : **1**\\nQuête initiale : **Suivre le vent** (commencée)\\n\\nTon pseudonyme est désormais verrouillé définitivement.\\n\\n`,
          ...initialExplorationPayload("awakening")
        });
      } catch (error) {
        if (error instanceof PseudonymUnavailableError) {
          await interaction.editReply({
            content: "Ce pseudonyme vient d'être utilisé par quelqu'un d'autre. Modifie-le pour confirmer ton personnage.",
            components: [creationButton()]
          });
          return;
        }

        if (error instanceof AvatarModelUnavailableError) {
          await interaction.editReply(genderSelectionPayload());
          return;
        }

        if (error instanceof NoOriginCountryAvailableError) {
          await interaction.editReply(
            "La création est temporairement indisponible. Ton brouillon est conservé."
          );
          return;
        }

        if (error instanceof NoStartingSpawnAvailableError) {
          await interaction.editReply(
            "La création est temporairement indisponible. Ton brouillon est conservé."
          );
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
