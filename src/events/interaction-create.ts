import { createHash } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  ModalBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
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
import {
  CampStorageItemError,
  CampStorageUnavailableError,
  depositFoundItemAtTemporaryCamp,
  listTemporaryCampStorage,
  withdrawFoundItemFromTemporaryCamp
} from "../modules/exploration/temporary-camp-storage-service.js";
import {
  craftItem,
  CraftingInventoryError,
  CraftingRequirementError,
  CraftingRecipeUnavailableError
} from "../modules/crafting/crafting-service.js";
import { getItemDisplayName } from "../modules/inventory/item-model.js";
import { getDatabasePool } from "../database/client.js";
import { getPersistedDiscoveryState } from "../modules/world/discovery-repository.js";
import { getPersonalMapProgress } from "../modules/world/discovery.js";
import { chooseNpcDialogueOption, listNpcEncountersAtCharacterSpawn, startNpcConversation, type NpcDialogueView } from "../modules/npc/npc-dialogue-service.js";
import { logger } from "../core/logger.js";
import {
  approvePersistedEditorialSpecies,
  createPersistedCompanionRegion,
  createPersistedEditorialSpecies,
  setPersistedSpeciesAvailability,
  setPersistedRegionVisibility
} from "../modules/companions/companion-species-catalog-repository.js";

function discordInteractionUuid(interactionId: string): string {
  const bytes = createHash("sha256").update("etheria:crafting:" + interactionId).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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



function npcDialoguePayload(view: NpcDialogueView) {
  const reveal = view.revealedLocation
    ? (view.firstEncounter
      ? "\\n\\n**Ton premier interlocuteur te révèle enfin où tu te trouves.**\\n"
      : "\\n\\n**Tu retrouves les indications données lors de votre première rencontre.**\\n") +
      `Pays : **${view.revealedLocation.countryName}**\\nRégion : **${view.revealedLocation.regionName}**\\n` +
      (view.revealedLocation.localityName ? `Localité : **${view.revealedLocation.localityName}**\\n` : "") +
      `Environnement : **${view.revealedLocation.biomeName}**`
    : "";
  const components = view.choices.length > 0
    ? [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`etheria:npc:choice:${view.conversationId}`)
          .setPlaceholder("Choisir une réponse")
          .addOptions(view.choices.map((choice) => ({
            label: choice.label.slice(0, 100),
            value: choice.choiceKey
          })))
      )]
    : [];
  return {
    content: `**${view.npcName}**\\n\\n${view.dialogueText}${reveal}`,
    components
  };
}
\nfunction explorationButton(customId: string, label: string, style = ButtonStyle.Primary) {
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
          explorationButton("etheria:camp:craft:grass_bedding_level_1", "Fabriquer un couchage", ButtonStyle.Primary),
          explorationButton("etheria:camp:craft:woven_rope_level_1", "Fabriquer une corde", ButtonStyle.Secondary),
          explorationButton("etheria:camp:craft:fragile_wooden_barrier_level_1", "Fabriquer une barrière", ButtonStyle.Secondary)
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          explorationButton("etheria:exploration:observe_surroundings", "Observer le camp", ButtonStyle.Secondary),
          explorationButton("etheria:camp:storage", "Gérer le stockage", ButtonStyle.Secondary)
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
    if (interaction.isChatInputCommand() && interaction.commandName === "etheria-admin") {
      if (!interaction.inGuild() ||
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: "Cette commande est réservée aux administrateurs du serveur.",
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        const database = getDatabase();
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "zones-depart") {
          const result = await database.query<{
            zone_key: string;
            country_name: string;
            region_name: string;
            locality_name: string | null;
            biome_name: string;
            is_active: boolean;
          }>(
            `SELECT z.zone_key, co.display_name AS country_name,
                    z.region_name, z.locality_name, z.biome_name, z.is_active
             FROM starting_spawn_zones z
             JOIN countries co ON co.id = z.country_id
             ORDER BY co.display_name, z.region_name, z.zone_key
             LIMIT 25`
          );
          const lines = result.rows.map((row) =>
            `• ${row.zone_key} — ${row.country_name} · ${row.region_name}` +
            (row.locality_name ? ` · ${row.locality_name}` : "") +
            ` · ${row.biome_name} · ${row.is_active ? "active" : "inactive"}`
          );
          await interaction.editReply(
            lines.length ? `**Zones de départ configurées**\\n\\n${lines.join("\\n")}` : "Aucune zone de départ n'est encore configurée."
          );
          return;
        }

        if (subcommand === "pnjs") {
          const result = await database.query<{
            npc_key: string;
            display_name: string;
            editorial_status: string;
            is_active: boolean;
            start_node_key: string;
          }>(
            `SELECT npc_key, display_name, editorial_status, is_active, start_node_key
             FROM npc_definitions ORDER BY display_name LIMIT 25`
          );
          const lines = result.rows.map((row) =>
            `• **${row.display_name}** (${row.npc_key}) — ${row.editorial_status}, ${row.is_active ? "actif" : "inactif"}, départ : ${row.start_node_key}`
          );
          await interaction.editReply(lines.length ? `**PNJ Etheria**\\n\\n${lines.join("\\n")}` : "Aucun PNJ n'est encore enregistré.");
          return;
        }

        if (subcommand === "ajouter-pnj") {
          const npcKey = interaction.options.getString("cle", true).trim().toLowerCase();
          const displayName = interaction.options.getString("nom", true).trim();
          const zoneKey = interaction.options.getString("zone", true).trim().toLowerCase();
          const nodeKey = interaction.options.getString("noeud", true).trim().toLowerCase();
          const dialogueText = interaction.options.getString("texte", true).trim();
          const description = interaction.options.getString("description")?.trim() || null;
          if (!/^[a-z0-9_-]{1,80}$/.test(npcKey) || !/^[a-z0-9_-]{1,80}$/.test(nodeKey)) {
            throw new Error("Les clés du PNJ et du dialogue doivent utiliser uniquement lettres minuscules, chiffres, tirets ou tirets bas.");
          }
          const client = await database.connect();
          try {
            await client.query("BEGIN");
            const zone = await client.query<{ id: string }>(
              "SELECT id FROM starting_spawn_zones WHERE zone_key = $1 AND is_active = TRUE",
              [zoneKey]
            );
            if (!zone.rows[0]) throw new Error("Cette zone de départ n'existe pas ou n'est plus active.");
            await client.query(
              `INSERT INTO npc_definitions
               (npc_key, display_name, description, start_node_key, editorial_status)
               VALUES ($1, $2, $3, $4, 'draft')`,
              [npcKey, displayName, description, nodeKey]
            );
            await client.query(
              `INSERT INTO npc_dialogue_nodes (npc_key, node_key, dialogue_text, is_terminal)
               VALUES ($1, $2, $3, FALSE)`,
              [npcKey, nodeKey, dialogueText]
            );
            await client.query(
              "INSERT INTO npc_spawn_locations (npc_key, spawn_zone_id) VALUES ($1, $2)",
              [npcKey, zone.rows[0].id]
            );
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            client.release();
          }
          await interaction.editReply("PNJ créé en brouillon avec son premier dialogue et son emplacement. Ajoute ses réponses, puis approuve-le lorsqu'il est complet.");
          return;
        }

        if (subcommand === "ajouter-dialogue") {
          const npcKey = interaction.options.getString("pnj", true).trim().toLowerCase();
          const nodeKey = interaction.options.getString("noeud", true).trim().toLowerCase();
          if (!/^[a-z0-9_-]{1,80}$/.test(nodeKey)) throw new Error("La clé du dialogue n'est pas valide.");
          await database.query(
            `INSERT INTO npc_dialogue_nodes (npc_key, node_key, dialogue_text, is_terminal)
             VALUES ($1, $2, $3, $4)`,
            [
              npcKey,
              nodeKey,
              interaction.options.getString("texte", true).trim(),
              interaction.options.getBoolean("terminal", true)
            ]
          );
          await interaction.editReply("Nœud de dialogue ajouté.");
          return;
        }

        if (subcommand === "ajouter-choix") {
          const npcKey = interaction.options.getString("pnj", true).trim().toLowerCase();
          const nodeKey = interaction.options.getString("noeud", true).trim().toLowerCase();
          const choiceKey = interaction.options.getString("cle", true).trim().toLowerCase();
          const label = interaction.options.getString("libelle", true).trim();
          const destination = interaction.options.getString("destination", true).trim().toLowerCase();
          if (![nodeKey, choiceKey, destination].every((key) => /^[a-z0-9_-]{1,80}$/.test(key))) {
            throw new Error("Les clés du choix et des dialogues doivent utiliser uniquement lettres minuscules, chiffres, tirets ou tirets bas.");
          }
          await database.query(
            `INSERT INTO npc_dialogue_choices
             (npc_key, node_key, choice_key, choice_label, next_node_key)
             VALUES ($1, $2, $3, $4, $5)`,
            [npcKey, nodeKey, choiceKey, label, destination]
          );
          await interaction.editReply("Choix de dialogue ajouté.");
          return;
        }

        if (subcommand === "approuver-pnj") {
          const npcKey = interaction.options.getString("pnj", true).trim().toLowerCase();
          const client = await database.connect();
          try {
            await client.query("BEGIN");
            const npc = await client.query<{ start_node_key: string }>(
              "SELECT start_node_key FROM npc_definitions WHERE npc_key = $1 FOR UPDATE",
              [npcKey]
            );
            if (!npc.rows[0]) throw new Error("PNJ introuvable.");
            const placement = await client.query(
              "SELECT 1 FROM npc_spawn_locations WHERE npc_key = $1 AND is_active = TRUE LIMIT 1",
              [npcKey]
            );
            if (!placement.rowCount) throw new Error("Le PNJ doit être placé dans au moins une zone active.");
            const incomplete = await client.query<{ node_key: string }>(
              `SELECT n.node_key
               FROM npc_dialogue_nodes n
               WHERE n.npc_key = $1 AND n.is_terminal = FALSE
                 AND NOT EXISTS (
                   SELECT 1 FROM npc_dialogue_choices c
                   WHERE c.npc_key = n.npc_key AND c.node_key = n.node_key
                 )
               LIMIT 1`,
              [npcKey]
            );
            if (incomplete.rows[0]) {
              throw new Error(`Le nœud "${incomplete.rows[0].node_key}" n'a aucune réponse et n'est pas terminal.`);
            }
            const tooManyChoices = await client.query<{ node_key: string; choice_count: number }>(
              `SELECT node_key, COUNT(*)::integer AS choice_count
               FROM npc_dialogue_choices
               WHERE npc_key = $1
               GROUP BY node_key
               HAVING COUNT(*) > 5
               LIMIT 1`,
              [npcKey]
            );
            if (tooManyChoices.rows[0]) {
              throw new Error(`Le nœud "${tooManyChoices.rows[0].node_key}" possède plus de cinq réponses. Le menu Discord ne peut en afficher que cinq.`);
            }
            await client.query(
              "UPDATE npc_definitions SET editorial_status = 'approved', is_active = TRUE, updated_at = NOW() WHERE npc_key = $1",
              [npcKey]
            );
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            client.release();
          }
          await interaction.editReply("PNJ approuvé et disponible dans sa zone de placement.");
          return;
        }

        if (subcommand === "historique") {
          const limit = interaction.options.getInteger("limite") ?? 10;
          const result = await database.query<{
            action: string;
            entity_type: string;
            entity_key: string;
            revision: number;
            created_at: Date;
          }>(
            `SELECT action, entity_type, entity_key, revision, created_at
             FROM companion_species_admin_events
             ORDER BY created_at DESC, id DESC
             LIMIT $1`,
            [limit]
          );
          const content = result.rows.map((row) =>
            `• ${row.action} — ${row.entity_type} ${row.entity_key} · révision ${row.revision} · ${row.created_at.toISOString()}`
          ).join("\n");
          await interaction.editReply(content
            ? `**Historique administratif** (${result.rows.length} événements)\n\n${content}`
            : "Aucune opération administrative enregistrée.");
          return;
        }

        if (subcommand === "regions") {
          const result = await database.query<{
            region_key: string; display_name: string; visibility: string; revision: number;
          }>(
            "SELECT region_key, display_name, visibility, revision FROM companion_regions ORDER BY region_key"
          );
          const content = result.rows.map((row) =>
            `• **${row.display_name}** (${row.region_key}) — ${row.visibility}, révision ${row.revision}`
          ).join("\n");
          await interaction.editReply(content ? `**Régions Etheria**\n\n${content}` : "Aucune région enregistrée.");
          return;
        }

        if (subcommand === "especes") {
          const region = interaction.options.getString("region");
          const result = await database.query<{
            species_key: string; display_name: string; region_key: string;
            element: string; editorial_status: string; availability_status: string; revision: number;
          }>(
            `SELECT species_key, display_name, region_key, element, editorial_status, availability_status, revision
             FROM companion_species_catalog
             WHERE ($1::text IS NULL OR region_key = $1)
             ORDER BY region_key, display_name
             LIMIT 15`,
            [region]
          );
          const content = result.rows.map((row) =>
            `• **${row.display_name}** (${row.species_key}) — ${row.region_key} · ${row.element} · ${row.editorial_status}/${row.availability_status} · rev ${row.revision}`
          ).join("\n");
          await interaction.editReply(content
            ? `**Espèces Etheria** (15 maximum par affichage)\n\n${content}`
            : "Aucune espèce ne correspond à ce filtre.");
          return;
        }

        if (subcommand === "ajouter-region") {
          const account = await getAccount(interaction);
          await createPersistedCompanionRegion(database, {
            regionKey: interaction.options.getString("cle", true).trim().toLowerCase(),
            name: interaction.options.getString("nom", true).trim(),
            visibility: interaction.options.getString("visibilite", true) as "public" | "discovery_locked",
            actorAccountId: account.accountId,
            idempotencyKey: discordInteractionUuid(interaction.id)
          });
          await interaction.editReply("La nouvelle région a été créée et inscrite dans le journal administratif.");
          return;
        }

        if (subcommand === "visibilite-region") {
          const account = await getAccount(interaction);
          const result = await setPersistedRegionVisibility(database, {
            regionKey: interaction.options.getString("region", true).trim().toLowerCase(),
            visibility: interaction.options.getString("visibilite", true) as "public" | "discovery_locked",
            expectedRevision: interaction.options.getInteger("revision", true),
            actorAccountId: account.accountId,
            idempotencyKey: discordInteractionUuid(interaction.id)
          });
          await interaction.editReply(
            `Visibilité de la région mise à jour : **${result.visibility}** (révision ${result.revision}).`
          );
          return;
        }

        if (subcommand === "approuver") {
          const account = await getAccount(interaction);
          const revision = await approvePersistedEditorialSpecies(database, {
            speciesKey: interaction.options.getString("espece", true).trim().toLowerCase(),
            expectedRevision: interaction.options.getInteger("revision", true),
            actorAccountId: account.accountId,
            idempotencyKey: discordInteractionUuid(interaction.id)
          });
          await interaction.editReply(
            `Fiche approuvée (révision ${revision}). Elle reste indisponible tant que son statut de disponibilité n'est pas modifié.`
          );
          return;
        }

        if (subcommand === "ajouter-espece") {
          const account = await getAccount(interaction);
          const rawForms = interaction.options.getString("formes", true);
          const forms = rawForms.split("\n").map((line, order) => {
            const separator = line.indexOf("|");
            if (separator < 1) throw new Error("Chaque forme doit respecter le format cle|nom, une forme par ligne.");
            return {
              key: line.slice(0, separator).trim().toLowerCase(),
              name: line.slice(separator + 1).trim(),
              order
            };
          });
          if (forms.length > 4) throw new Error("La fiche accepte au maximum quatre formes pour cette commande Discord.");
          await createPersistedEditorialSpecies(database, {
            speciesKey: interaction.options.getString("cle", true).trim().toLowerCase(),
            name: interaction.options.getString("nom", true).trim(),
            regionKey: interaction.options.getString("region", true).trim().toLowerCase(),
            element: interaction.options.getString("element", true),
            editorialStatus: "draft",
            forms,
            actorAccountId: account.accountId,
            idempotencyKey: discordInteractionUuid(interaction.id)
          });
          if (interaction.options.getBoolean("approuvee", true)) {
            await approvePersistedEditorialSpecies(database, {
              speciesKey: interaction.options.getString("cle", true).trim().toLowerCase(),
              expectedRevision: 1,
              actorAccountId: account.accountId,
              idempotencyKey: discordInteractionUuid(interaction.id + ":approve")
            });
          }
          await interaction.editReply("La fiche d'espèce a été créée. Elle reste indisponible en jeu tant que sa disponibilité n'est pas modifiée.");
          return;
        }

        if (subcommand === "disponibilite") {
          const account = await getAccount(interaction);
          const result = await setPersistedSpeciesAvailability(database, {
            speciesKey: interaction.options.getString("espece", true).trim().toLowerCase(),
            nextStatus: interaction.options.getString("statut", true) as "discoverable" | "available" | "retired",
            expectedRevision: interaction.options.getInteger("revision", true),
            actorAccountId: account.accountId,
            idempotencyKey: discordInteractionUuid(interaction.id)
          });
          await interaction.editReply(
            `Disponibilité mise à jour : **${result.availabilityStatus}** (révision ${result.revision}).`
          );
          return;
        }

        await interaction.editReply("Sous-commande administrative inconnue.");
      } catch (error) {
        logger.error("Échec d'une commande d'administration du bestiaire.", error);
        const message = error instanceof Error ? error.message : "Erreur inconnue.";
        await interaction.editReply(`Impossible d'effectuer cette opération : ${message}`);
      }
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "etheria") {
      const subcommand = interaction.options.getSubcommand(false);
      if (subcommand === "rencontrer") {
        await interaction.deferReply({ ephemeral: true });
        try {
          const account = await getAccount(interaction);
          const character = await getActiveCharacter(getDatabase(), account.accountId);
          if (!character) {
            await interaction.editReply("Tu dois d'abord créer un personnage actif pour rencontrer les habitants d'Etheria.");
            return;
          }
          const npcs = await listNpcEncountersAtCharacterSpawn(getDatabase(), {
            accountId: account.accountId
          });
          if (npcs.length === 0) {
            await interaction.editReply("Aucun habitant n'est actuellement configuré dans ton lieu. Les rencontres apparaîtront ici lorsque les premiers PNJ de cette zone auront été ajoutés.");
            return;
          }
          const menu = new StringSelectMenuBuilder()
            .setCustomId("etheria:npc:begin")
            .setPlaceholder("Choisir une personne à rencontrer")
            .addOptions(npcs.slice(0, 25).map((npc) => ({
              label: npc.displayName.slice(0, 100),
              value: npc.npcKey,
              description: npc.description?.slice(0, 100)
            })));
          await interaction.editReply({
            content: "Tu aperçois des habitants à proximité. Choisis la personne que tu souhaites approcher.",
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]
          });
        } catch (error) {
          logger.error("Impossible de rechercher les PNJ proches.", error);
          await interaction.editReply("Je n'ai pas pu repérer les habitants de cette zone. Ta progression n'a pas été modifiée.");
        }
        return;
      }

      if (subcommand === "carte" || subcommand === "progression") {
        await interaction.deferReply({ ephemeral: true });
        try {
          const account = await getAccount(interaction);
          const state = await getPersistedDiscoveryState(getDatabase(), account.accountId);
          const progress = getPersonalMapProgress(state, account.accountId);

          if (subcommand === "progression") {
            const labels: Record<string, string> = {
              continent: "Continents",
              country: "Pays",
              administrative_area: "Territoires administratifs",
              settlement: "Localités",
              spawn_zone: "Zones de départ révélées",
              geographic_feature: "Caractéristiques géographiques",
              travel_link: "Liaisons découvertes"
            };
            const lines = Object.entries(progress.byKind)
              .filter(([, count]) => count > 0)
              .map(([kind, count]) => `• ${labels[kind] ?? kind} : **${count}**`);
            await interaction.editReply(
              `**Ta progression cartographique**\\n\\nDécouvertes enregistrées : **${progress.discoveredCount}**\\n\\n` +
              (lines.length ? lines.join("\\n") : "Tu n'as pas encore enregistré de découverte.")
            );
            return;
          }

          const recent = [...state.records]
            .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))
            .slice(0, 15);
          const kindLabels: Record<string, string> = {
            continent: "Continent",
            country: "Pays",
            administrative_area: "Territoire",
            settlement: "Localité",
            spawn_zone: "Zone de départ",
            geographic_feature: "Lieu naturel",
            travel_link: "Liaison"
          };
          const entries = recent.map((record) =>
            `• **${kindLabels[record.targetKind] ?? record.targetKind}** : ${record.targetKey.replaceAll("_", " ")}`
          );
          await interaction.editReply(
            `**Ta carte personnelle**\\n\\n` +
            (entries.length ? entries.join("\\n") : "Ta carte est encore vierge. Les lieux apparaîtront au fil de tes découvertes.") +
            (progress.discoveredCount > recent.length ? `\\n\\nEt ${progress.discoveredCount - recent.length} autre(s) découverte(s).` : "")
          );
        } catch (error) {
          logger.error("Impossible de charger la carte personnelle.", error);
          await interaction.editReply(
            "La carte personnelle est temporairement indisponible. Ta progression n'a pas été modifiée."
          );
        }
        return;
      }

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

    if (interaction.isStringSelectMenu() && interaction.customId === "etheria:npc:begin") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const account = await getAccount(interaction);
        const character = await getActiveCharacter(getDatabase(), account.accountId);
        if (!character) {
          await interaction.editReply("Aucun personnage actif n'a été trouvé.");
          return;
        }
        const npcKey = interaction.values[0];
        const view = await startNpcConversation(getDatabase(), {
          interactionId: interaction.id,
          accountId: account.accountId,
          characterId: character.id,
          npcKey
        });
        await interaction.editReply(npcDialoguePayload(view));
      } catch (error) {
        logger.error("Impossible de démarrer la rencontre PNJ.", error);
        await interaction.editReply(
          error instanceof Error
            ? error.message
            : "La rencontre n'a pas pu commencer. Ta progression précédente est conservée."
        );
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("etheria:npc:choice:")) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const account = await getAccount(interaction);
        const character = await getActiveCharacter(getDatabase(), account.accountId);
        if (!character) {
          await interaction.editReply("Aucun personnage actif n'a été trouvé.");
          return;
        }
        const conversationId = interaction.customId.slice("etheria:npc:choice:".length);
        const view = await chooseNpcDialogueOption(getDatabase(), {
          interactionId: interaction.id,
          accountId: account.accountId,
          characterId: character.id,
          conversationId,
          choiceKey: interaction.values[0]
        });
        await interaction.editReply(npcDialoguePayload(view));
      } catch (error) {
        logger.error("Impossible d'enregistrer le choix de dialogue.", error);
        await interaction.editReply(
          error instanceof Error
            ? error.message
            : "Ce choix n'a pas pu être enregistré. La conversation précédente est conservée."
        );
      }
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


    if (interaction.isButton() && interaction.customId.startsWith("etheria:camp:craft:")) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const account = await getAccount(interaction);
        const character = await getActiveCharacter(getDatabase(), account.accountId);
        if (!character) {
          await interaction.editReply("Aucun personnage actif n'a été trouvé.");
          return;
        }
        const recipeKey = interaction.customId.slice("etheria:camp:craft:".length);
        const result = await craftItem(getDatabase(), {
          interactionId: discordInteractionUuid(interaction.id),
          accountId: account.accountId,
          characterId: character.id,
          recipeKey
        });
        const outputName = getItemDisplayName(result.output.itemCode);
        await interaction.editReply(
          `Fabrication terminée : **${result.outputQuantity} × ${outputName}**.`
        );
      } catch (error) {
        if (
          error instanceof CraftingInventoryError ||
          error instanceof CraftingRequirementError ||
          error instanceof CraftingRecipeUnavailableError
        ) {
          await interaction.editReply(error.message);
          return;
        }
        logger.error("Impossible de fabriquer cet objet au camp.", error);
        await interaction.editReply("La fabrication n'a pas pu être effectuée. Aucun ingrédient n'a été consommé.");
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === "etheria:camp:storage") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const account = await getAccount(interaction);
        const character = await getActiveCharacter(getDatabase(), account.accountId);
        if (!character) {
          await interaction.editReply("Aucun personnage actif n'a été trouvé.");
          return;
        }
        const entries = await listTemporaryCampStorage(getDatabase(), {
          accountId: account.accountId,
          characterId: character.id
        });
        const storedFragment = entries.find((entry) => entry.itemCode === "unidentified_history_fragment");
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("etheria:camp:deposit_fragment")
            .setLabel("Déposer le fragment")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("etheria:camp:withdraw_fragment")
            .setLabel("Retirer le fragment")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!storedFragment)
        );
        await interaction.editReply({
          content:
            "**Stockage du camp temporaire**\\n" +
            (storedFragment
              ? `${getItemDisplayName(storedFragment.itemCode)} : **${storedFragment.quantity}**`
              : "Le stockage est actuellement vide.") +
            "\\n\\nCe stockage est uniquement accessible depuis ton camp. Les objets déposés ne sont plus dans ton sac porté.",
          components: [row]
        });
      } catch (error) {
        if (error instanceof CampStorageUnavailableError) {
          await interaction.editReply(error.message);
          return;
        }
        logger.error("Impossible d'ouvrir le stockage du camp.", error);
        await interaction.editReply("Impossible d'ouvrir le stockage du camp pour le moment.");
      }
      return;
    }

    if (
      interaction.isButton() &&
      ["etheria:camp:deposit_fragment", "etheria:camp:withdraw_fragment"].includes(interaction.customId)
    ) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const account = await getAccount(interaction);
        const character = await getActiveCharacter(getDatabase(), account.accountId);
        if (!character) {
          await interaction.editReply("Aucun personnage actif n'a été trouvé.");
          return;
        }
        if (interaction.customId === "etheria:camp:deposit_fragment") {
          await depositFoundItemAtTemporaryCamp(getDatabase(), {
            accountId: account.accountId,
            characterId: character.id,
            itemCode: "unidentified_history_fragment"
          });
          await interaction.editReply("Le fragment historique a été déposé dans le stockage du camp. Il ne se trouve plus dans ton sac porté.");
        } else {
          await withdrawFoundItemFromTemporaryCamp(getDatabase(), {
            accountId: account.accountId,
            characterId: character.id,
            itemCode: "unidentified_history_fragment"
          });
          await interaction.editReply("Le fragment historique a été remis dans ton sac porté.");
        }
      } catch (error) {
        if (error instanceof CampStorageUnavailableError || error instanceof CampStorageItemError) {
          await interaction.editReply(error.message);
          return;
        }
        logger.error("Impossible de modifier le stockage du camp.", error);
        await interaction.editReply("Le stockage n'a pas pu être modifié. Ton inventaire est conservé.");
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
