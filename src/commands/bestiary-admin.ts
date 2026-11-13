import {
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";

export const bestiaryAdminCommand = new SlashCommandBuilder()
  .setName("etheria-admin")
  .setDescription("Administrer le bestiaire d'Etheria.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("historique")
      .setDescription("Consulter les dernières opérations administratives du bestiaire.")
      .addIntegerOption((option) =>
        option.setName("limite").setDescription("Nombre d'événements à afficher (1 à 10).")
          .setRequired(false).setMinValue(1).setMaxValue(10)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("regions")
      .setDescription("Afficher les régions du bestiaire.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("especes")
      .setDescription("Afficher les espèces et leur disponibilité.")
      .addStringOption((option) =>
        option.setName("region").setDescription("Filtrer par clé de région.").setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("disponibilite")
      .setDescription("Modifier la disponibilité d'une espèce.")
      .addStringOption((option) =>
        option.setName("espece").setDescription("Clé technique de l'espèce.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("statut")
          .setDescription("Nouvelle disponibilité.")
          .setRequired(true)
          .addChoices(
            { name: "Découvrable", value: "discoverable" },
            { name: "Disponible", value: "available" },
            { name: "Retirée", value: "retired" }
          )
      )
      .addIntegerOption((option) =>
        option.setName("revision").setDescription("Révision affichée par /etheria-admin especes.").setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-region")
      .setDescription("Ajouter une nouvelle région.")
      .addStringOption((option) => option.setName("cle").setDescription("Identifiant sans espace.").setRequired(true))
      .addStringOption((option) => option.setName("nom").setDescription("Nom affiché.").setRequired(true))
      .addStringOption((option) => option.setName("visibilite").setDescription("Visibilité initiale.")
        .setRequired(true).addChoices(
          { name: "Publique", value: "public" },
          { name: "Verrouillée jusqu'à découverte", value: "discovery_locked" }
        ))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-espece")
      .setDescription("Ajouter une fiche éditoriale et ses formes (une par ligne : cle|nom).")
      .addStringOption((option) => option.setName("cle").setDescription("Identifiant sans espace.").setRequired(true))
      .addStringOption((option) => option.setName("nom").setDescription("Nom affiché.").setRequired(true))
      .addStringOption((option) => option.setName("region").setDescription("Clé d'une région existante.").setRequired(true))
      .addStringOption((option) => option.setName("element").setDescription("Élément de l'espèce.")
        .setRequired(true).addChoices(
          { name: "Eau", value: "eau" }, { name: "Feu", value: "feu" },
          { name: "Électrique", value: "electrique" }, { name: "Terre", value: "terre" },
          { name: "Air", value: "air" }, { name: "Magie", value: "magie" },
          { name: "Psy", value: "psy" }, { name: "Ombre", value: "ombre" }
        ))
      .addStringOption((option) => option.setName("formes").setDescription("Au moins deux lignes cle|nom, ordre = ligne.")
        .setRequired(true))
      .addBooleanOption((option) => option.setName("approuvee").setDescription("Approuver immédiatement la fiche.").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("approuver")
      .setDescription("Approuver une fiche éditoriale.")
      .addStringOption((option) => option.setName("espece").setDescription("Clé technique de l'espèce.").setRequired(true))
      .addIntegerOption((option) => option.setName("revision").setDescription("Révision courante de la fiche.").setRequired(true).setMinValue(1))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("visibilite-region")
      .setDescription("Modifier la visibilité d'une région.")
      .addStringOption((option) => option.setName("region").setDescription("Clé technique de la région.").setRequired(true))
      .addStringOption((option) => option.setName("visibilite").setDescription("Nouvelle visibilité.").setRequired(true)
        .addChoices(
          { name: "Publique", value: "public" },
          { name: "Verrouillée jusqu'à découverte", value: "discovery_locked" }
        ))
      .addIntegerOption((option) => option.setName("revision").setDescription("Révision affichée par /etheria-admin regions.").setRequired(true).setMinValue(1))
  );
