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

function initialExplorationPayload(
  scene: InitialExplorationScene,
  lastAction?: InitialExplorationAction,
  bagCapacity: number | null = null,
  bagUsedSlots = 0,
  thirstPercent = 100,
  hungerPercent = 100
) {
  if (scene === "awakening") {
    return {
      content: lastAction === "observe_surroundings"
        ? "Tu prends le temps d'observer autour de toi. Tu découvres les formes, les couleurs et les mouvements de la nature, sans reconnaître cet endroit. Une brise légère passe près de toi."
        : "**Tu ouvres les yeux.** Tu es seul, au milieu de la nature. Tu ne sais pas où tu te trouves. Une brise passe près de toi. Tu peux prendre le temps de percevoir ce qui t'entoure.",
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
      content: lastAction === "observe_surroundings"
        ? "Tu observes plus attentivement les alentours. Rien ne te permet encore de reconnaître cet endroit. Le vent continue de souffler ; tu peux essayer d'en suivre la direction."
        : "Tu prends le temps d'écouter. Le souffle du vent devient plus perceptible. En prêtant attention à ses variations et à ce que tu ressens sur ta peau, tu peux en suivre la direction.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:follow_wind", "Suivre le vent"),
          explorationButton("etheria:exploration:observe_surroundings", "Observer encore", ButtonStyle.Secondary)
        )
      ]
    };
  }

  if (scene === "cliff_foot") {
    return {
      content: lastAction === "observe_surroundings"
        ? "Au pied de la falaise, tu observes les environs. Tu remarques un petit sac tressé abandonné à proximité, ainsi que des baies que tu ne sais pas identifier."
        : "Tu arrives au pied de la falaise. À proximité, tu découvres un petit sac tressé pouvant contenir **5 emplacements**. Un peu plus loin poussent des baies locales. Tu ne connais ni leur nom ni leurs propriétés.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:collect_local_berries", "Recueillir un premier échantillon"),
          explorationButton("etheria:exploration:observe_surroundings", "Observer les environs", ButtonStyle.Secondary)
        )
      ]
    };
  }

  if (scene === "berries_collected") {
    return {
      content: `Tu as recueilli un premier échantillon de baies locales inconnues. Tu ne connais pas encore leur nom ni leurs propriétés.\\n\\n**Sac tressé** : ${bagUsedSlots}/${bagCapacity ?? 5} emplacements occupés.\\n**Contenu** : 1 échantillon de baies non identifiées.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:discover_water_source", "Continuer l'exploration"),
          explorationButton("etheria:exploration:observe_surroundings", "Observer les environs", ButtonStyle.Secondary)
        )
      ]
    };
  }

  if (scene === "water_source_found") {
    return {
      content: "En poursuivant ton exploration, tu découvres une source d'eau. Un animal qui s'y abreuvait s'éloigne à ton arrivée. Tu peux boire directement en recueillant de l'eau dans tes mains. Tu ne connais toujours pas le nom de cet endroit.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:drink_from_hands", "Boire avec mes mains")
        )
      ]
    };
  }

  if (scene === "thirst_restored") {
    return {
      content: "Tu bois dans tes mains. Ta soif est entièrement restaurée. Tu réfléchis ensuite à un moyen de transporter de l'eau pour ne plus dépendre uniquement des sources. Des plantes souples à proximité pourraient être tressées.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:gather_canteen_plants", "Réunir des plantes souples")
        )
      ]
    };
  }

  if (scene === "plants_gathered") {
    return {
      content: "Tu as réuni des plantes souples et compris comment les tresser pour fabriquer un contenant simple. La première recette de gourde est maintenant accessible. Tu peux tenter de la fabriquer.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:craft_initial_canteen", "Fabriquer la gourde de niveau 1")
        )
      ]
    };
  }

  if (scene === "canteen_crafted") {
    return {
      content: "Tu viens de fabriquer ta première gourde de niveau 1 à partir de plantes tressées. Sa capacité correspond à l'équivalent de deux mains jointes remplies d'eau. Cette quantité suffit à restaurer entièrement ta soif.\\n\\n**Gourde** : niveau 1.\\n\\nLe jour décline. Le vent se renforce et l'air devient froid. Tu aperçois une ouverture dans la roche qui pourrait offrir un abri.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:seek_shelter", "Chercher un abri")
        )
      ]
    };
  }

  if (scene === "cave_found") {
    return {
      content: "À mesure que la nuit approche, le froid et le vent deviennent plus difficiles à supporter. Tu as repéré une grotte dans la roche. Son entrée semble offrir une protection contre les intempéries, même si tu ignores ce qui se trouve plus loin.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:enter_cave", "Entrer dans la grotte")
        )
      ]
    };
  }

  if (scene === "cave_shelter") {
    return {
      content: "Tu t'installes à l'abri dans la grotte. Tu peux enfin te protéger du vent. La nuit est tombée et tu comprends qu'il te faudrait une source de chaleur et de lumière pour rendre cet endroit plus accueillant.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:light_campfire", "Allumer un feu")
        )
      ]
    };
  }

  if (scene === "campfire_lit") {
    return {
      content: "Le feu éclaire la grotte et apporte une chaleur bienvenue. Tu viens de faire ta première expérience de maîtrise du feu. **Maîtrise du feu : niveau 1.** La compétence de cuisine est désormais déverrouillée. Les baies récoltées peuvent être rôties près des flammes.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:roast_local_berries", "Faire rôtir les baies")
        )
      ]
    };
  }

  if (scene === "berries_roasted") {
    return {
      content: "Tu fais rôtir les baies près du feu. Leur texture et leur odeur ont changé sous l'effet de la chaleur. Tu as préparé ton premier aliment cuit et découvert les bases de la cuisine. La grotte devient ton premier abri temporaire pour la nuit. Après cette première nuit, la lumière du matin revient.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:wake_after_first_night", "Se réveiller au matin")
        )
      ]
    };
  }

  if (scene === "morning_outside_cave") {
    return {
      content: "La nuit est passée. Tu sors de la grotte et découvres les environs à la lumière du matin. En observant le paysage proche, tu remarques des formes inhabituelles qui semblent être les vestiges d'anciennes constructions.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:discover_nearby_ruins", "Examiner les vestiges")
        )
      ]
    };
  }

  if (scene === "ruins_found") {
    return {
      content: "Tu t'approches des ruines. Des fragments de structures anciennes sont encore visibles. Tu ne sais pas qui les a bâties, ni à quelle époque. Certains éléments portent des traces qui pourraient conserver des morceaux d'histoire.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:explore_ruins", "Explorer les ruines")
        )
      ]
    };
  }

  if (scene === "ruins_explored") {
    return {
      content: "En explorant les vestiges, tu découvres un fragment ancien qui semble lié à l'histoire de ce monde. Tu ne peux pas encore en comprendre le sens. Tu le ranges dans ton sac pour le préserver. Après cette découverte, tu retournes vers la grotte afin d'y installer ton premier camp temporaire.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:return_to_cave", "Retourner à la grotte")
        )
      ]
    };
  }

  if (scene === "temporary_camp_established") {
    return {
      content: "Tu retrouves la grotte et y installes ton premier camp temporaire. Tu disposes désormais d'un endroit où revenir et conserver tes affaires à l'abri. Le fragment historique trouvé dans les ruines reste dans ton sac. Ce camp n'est pas encore un établissement permanent.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:observe_surroundings", "Observer le camp", ButtonStyle.Secondary)
        )
      ]
    };
  }

  return {
    content: lastAction === "inspect_path"
      ? "Tu examines le passage. Il descend naturellement le long de la falaise. Tu peux l'emprunter quand tu le souhaites, sans être obligé de te précipiter."
      : lastAction === "observe_surroundings"
        ? "Tu prends le temps d'observer le paysage depuis le bord de la falaise. Tu distingues mieux les reliefs et les espaces naturels, mais rien ne t'indique le nom de cet endroit."
        : "En suivant le vent, tu arrives au bord d'une falaise. Depuis ce point élevé, tu distingues mieux le paysage alentour. Un passage naturel permet de descendre. Tu ne sais toujours pas où tu te trouves.",
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        explorationButton("etheria:exploration:inspect_path", "Examiner le passage"),
        explorationButton("etheria:exploration:descend_path", "Descendre par le passage"),
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
          const explorationPayload = initialExplorationPayload(exploration.scene);
          await interaction.editReply({
            ...explorationPayload,
            content: `Bon retour dans Etheria, **${activeCharacter.publicPseudonym}** ! Ton personnage est au niveau ${activeCharacter.level}.\\n\\n${initialExplorationPayload(
            exploration.scene,
            undefined,
            exploration.bagCapacity,
            exploration.bagUsedSlots,
            exploration.thirstPercent,
            exploration.hungerPercent
          ).content}`
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
      await interaction.deferUpdate();
      try {
        const account = await getAccount(interaction);
        const character = await getActiveCharacter(getDatabase(), account.accountId);
        if (!character) {
          await interaction.editReply("Aucun personnage actif n'a été trouvé. Commence par créer ton personnage.");
          return;
        }

        const action = interaction.customId.slice("etheria:exploration:".length) as InitialExplorationAction;
        const allowedActions: InitialExplorationAction[] = [
          "listen_wind", "observe_surroundings", "follow_wind", "inspect_path",
          "descend_path", "collect_local_berries", "discover_water_source",
          "drink_from_hands", "gather_canteen_plants", "craft_initial_canteen",
          "seek_shelter", "enter_cave", "light_campfire", "roast_local_berries",
          "wake_after_first_night", "discover_nearby_ruins", "explore_ruins", "return_to_cave"
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
          initialExplorationPayload(
            state.scene,
            action,
            state.bagCapacity,
            state.bagUsedSlots,
            state.thirstPercent,
            state.hungerPercent
          )
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

        const openingPayload = initialExplorationPayload("awakening");
        await interaction.editReply({
          ...openingPayload,
          content:
            `Ton personnage **${character.firstName}** est officiellement créé !\\nPseudonyme public : **${character.publicPseudonym}**\\nÂge : **13 ans**\\nNiveau : **1**\\nQuête initiale : **Suivre le vent** (commencée)\\n\\nTon pseudonyme est désormais verrouillé définitivement.\\n\\n${openingPayload.content}`
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
