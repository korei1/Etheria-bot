import {
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";

export const bestiaryAdminCommand = new SlashCommandBuilder()
  .setName("etheria-admin")
  .setDescription("Administrer le bestiaire et les PNJ d'Etheria.")
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
      .setName("zones-depart")
      .setDescription("Afficher les zones de départ disponibles pour placer les premiers PNJ.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("localites")
      .setDescription("Afficher les localités approuvées du monde.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("placer-pnj-localite")
      .setDescription("Placer un PNJ dans une localité approuvée.")
      .addStringOption((option) => option.setName("pnj").setDescription("Clé du PNJ.").setRequired(true))
      .addStringOption((option) => option.setName("localite").setDescription("Clé de la localité approuvée.").setRequired(true))
      .addStringOption((option) => option.setName("horaires_json").setDescription("Calendrier hebdomadaire JSON facultatif ; null retire la restriction.").setRequired(false).setMaxLength(1000))
      .addStringOption((option) => option.setName("activite").setDescription("Activité affichée aux joueurs.").setRequired(false).setMaxLength(120))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("itineraires")
      .setDescription("Afficher les itinéraires ou programmer un voyage pour un PNJ.")
      .addStringOption((option) => option.setName("pnj").setDescription("Clé du PNJ approuvé (à renseigner pour programmer un voyage).").setRequired(false))
      .addStringOption((option) => option.setName("itineraire").setDescription("Clé de l'itinéraire approuvé (à renseigner pour programmer un voyage).").setRequired(false))
      .addIntegerOption((option) => option.setName("depart_dans").setDescription("Départ dans ce nombre de minutes Etheria (0 = maintenant).").setMinValue(0).setMaxValue(1000000).setRequired(false))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-itineraire")
      .setDescription("Créer un itinéraire en brouillon entre une zone et une localité ou deux localités.")
      .addStringOption((option) => option.setName("cle").setDescription("Identifiant stable de l'itinéraire.").setRequired(true))
      .addStringOption((option) => option.setName("nom").setDescription("Nom affiché de l'itinéraire.").setRequired(true))
      .addStringOption((option) => option.setName("origine_type").setDescription("Type du lieu de départ.").setRequired(true)
        .addChoices({ name: "Zone de départ", value: "spawn_zone" }, { name: "Localité", value: "settlement" }))
      .addStringOption((option) => option.setName("origine").setDescription("Clé de la zone ou localité de départ.").setRequired(true))
      .addStringOption((option) => option.setName("destination").setDescription("Clé d'une localité approuvée.").setRequired(true))
      .addStringOption((option) => option.setName("mode").setDescription("Mode de déplacement.").setRequired(true)
        .addChoices({ name: "Terrestre", value: "land" }, { name: "Maritime", value: "sea" }, { name: "Aérien", value: "air" }))
      .addStringOption((option) => option.setName("type").setDescription("Type de liaison.").setRequired(true)
        .addChoices(
          { name: "Sentier", value: "trail" }, { name: "Route", value: "road" },
          { name: "Pont", value: "bridge" }, { name: "Tunnel", value: "tunnel" },
          { name: "Ferry", value: "ferry" }, { name: "Voie maritime", value: "sea_lane" },
          { name: "Route aérienne", value: "air_route" }
        ))
      .addBooleanOption((option) => option.setName("bidirectionnel").setDescription("Le trajet peut-il être parcouru dans les deux sens ?").setRequired(true))
      .addStringOption((option) => option.setName("visibilite").setDescription("Visibilité de l'itinéraire.").setRequired(true)
        .addChoices({ name: "Publique", value: "public" }, { name: "Verrouillée jusqu'à découverte", value: "discovery_locked" }))
      .addIntegerOption((option) => option.setName("duree_minutes").setDescription("Durée Etheria validée du trajet, nécessaire aux voyages des PNJ.").setRequired(false).setMinValue(1).setMaxValue(1000000))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("approuver-itineraire")
      .setDescription("Approuver un itinéraire après validation de ses deux extrémités.")
      .addStringOption((option) => option.setName("cle").setDescription("Clé de l'itinéraire.").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("pnjs")
      .setDescription("Afficher les PNJ et leur état éditorial.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-pnj")
      .setDescription("Créer un PNJ brouillon et son premier dialogue.")
      .addStringOption((option) => option.setName("cle").setDescription("Identifiant technique du PNJ.").setRequired(true))
      .addStringOption((option) => option.setName("nom").setDescription("Nom affiché du PNJ.").setRequired(true))
      .addStringOption((option) => option.setName("zone").setDescription("Clé facultative d'une zone de départ existante.").setRequired(false))
      .addStringOption((option) => option.setName("noeud").setDescription("Clé du premier nœud de dialogue.").setRequired(true))
      .addStringOption((option) => option.setName("texte").setDescription("Texte prononcé lors de la première rencontre.").setRequired(true))
      .addStringOption((option) => option.setName("description").setDescription("Description courte du PNJ.").setRequired(false))
      .addStringOption((option) => option.setName("activite").setDescription("Activité dans sa zone de départ (120 caractères max).").setRequired(false).setMaxLength(120))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-dialogue")
      .setDescription("Ajouter un nœud de dialogue à un PNJ.")
      .addStringOption((option) => option.setName("pnj").setDescription("Clé du PNJ.").setRequired(true))
      .addStringOption((option) => option.setName("noeud").setDescription("Clé du nouveau nœud.").setRequired(true))
      .addStringOption((option) => option.setName("texte").setDescription("Texte de dialogue.").setRequired(true))
      .addBooleanOption((option) => option.setName("terminal").setDescription("Ce nœud termine-t-il la conversation ?").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-choix")
      .setDescription("Ajouter une réponse et sa destination dans un dialogue.")
      .addStringOption((option) => option.setName("pnj").setDescription("Clé du PNJ.").setRequired(true))
      .addStringOption((option) => option.setName("noeud").setDescription("Clé du nœud actuel.").setRequired(true))
      .addStringOption((option) => option.setName("cle").setDescription("Clé technique du choix.").setRequired(true))
      .addStringOption((option) => option.setName("libelle").setDescription("Texte affiché au joueur.").setRequired(true))
      .addStringOption((option) => option.setName("destination").setDescription("Clé du nœud suivant.").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("approuver-pnj")
      .setDescription("Publier un PNJ après vérification de son dialogue et de son placement.")
      .addStringOption((option) => option.setName("pnj").setDescription("Clé du PNJ.").setRequired(true))
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
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("contenus-locaux")
      .setDescription("Consulter les activités, services, commerces et événements locaux.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-contenu-local")
      .setDescription("Créer un contenu local en brouillon, rattaché à une localité approuvée.")
      .addStringOption((option) => option.setName("cle").setDescription("Clé stable sans espace.").setRequired(true))
      .addStringOption((option) => option.setName("nom").setDescription("Nom affiché.").setRequired(true))
      .addStringOption((option) => option.setName("localite").setDescription("Clé d'une localité approuvée.").setRequired(true))
      .addStringOption((option) => option.setName("type").setDescription("Type de contenu.").setRequired(true)
        .addChoices(
          { name: "Activité", value: "activity" }, { name: "Service", value: "service" },
          { name: "Commerce", value: "shop" }, { name: "Événement", value: "event" }
        ))
      .addStringOption((option) => option.setName("visibilite").setDescription("Visibilité du contenu.").setRequired(true)
        .addChoices(
          { name: "Publique", value: "public" },
          { name: "Verrouillée jusqu'à découverte", value: "discovery_locked" }
        ))
      .addStringOption((option) => option.setName("description").setDescription("Description du contenu.").setRequired(true))
      .addStringOption((option) => option.setName("tags").setDescription("Ancrages culturels séparés par des virgules.").setRequired(true))
      .addStringOption((option) => option.setName("justification").setDescription("Lien explicite avec la culture du continent.").setRequired(true))
      .addIntegerOption((option) => option.setName("debut").setDescription("Jour de début (événement uniquement, 1 à 120).").setMinValue(1).setMaxValue(120).setRequired(false))
      .addIntegerOption((option) => option.setName("fin").setDescription("Jour de fin (événement uniquement, 1 à 120).").setMinValue(1).setMaxValue(120).setRequired(false))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("modifier-contenu-local")
      .setDescription("Modifier les champs éditoriaux d'un contenu local en brouillon.")
      .addStringOption((option) => option.setName("cle").setDescription("Clé du contenu.").setRequired(true))
      .addIntegerOption((option) => option.setName("revision").setDescription("Révision courante affichée dans le catalogue.").setMinValue(1).setRequired(true))
      .addStringOption((option) => option.setName("nom").setDescription("Nouveau nom.").setRequired(false))
      .addStringOption((option) => option.setName("description").setDescription("Nouvelle description.").setRequired(false))
      .addStringOption((option) => option.setName("tags").setDescription("Nouveaux tags séparés par des virgules.").setRequired(false))
      .addStringOption((option) => option.setName("justification").setDescription("Nouvelle justification culturelle.").setRequired(false))
      .addStringOption((option) => option.setName("visibilite").setDescription("Nouvelle visibilité.").setRequired(false)
        .addChoices(
          { name: "Publique", value: "public" },
          { name: "Verrouillée jusqu'à découverte", value: "discovery_locked" }
        ))
      .addStringOption((option) => option.setName("horaires_json").setDescription("Horaires JSON facultatifs : {days:[{weekday,intervals:[{opensAtMinute,closesAtMinute}]}]}").setMaxLength(1000).setRequired(false))
  )

  .addSubcommand((subcommand) =>
    subcommand
      .setName("approuver-contenu-local")
      .setDescription("Approuver un contenu local après validation éditoriale.")
      .addStringOption((option) => option.setName("cle").setDescription("Clé du contenu.").setRequired(true))
      .addIntegerOption((option) => option.setName("revision").setDescription("Révision courante du contenu.").setMinValue(1).setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stocks-locaux")
      .setDescription("Afficher les stocks enregistrés dans les commerces.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ajouter-stock-local")
      .setDescription("Ajouter un article au stock d'un commerce.")
      .addStringOption((option) => option.setName("commerce").setDescription("Clé d'un contenu de type commerce.").setRequired(true))
      .addStringOption((option) => option.setName("cle").setDescription("Clé de l'article.").setRequired(true))
      .addStringOption((option) => option.setName("nom").setDescription("Nom de l'article.").setRequired(true))
      .addIntegerOption((option) => option.setName("prix_teas").setDescription("Prix en Teas.").setMinValue(0).setRequired(true))
      .addIntegerOption((option) => option.setName("quantite").setDescription("Quantité initiale.").setMinValue(0).setRequired(true))
      .addIntegerOption((option) => option.setName("maximum").setDescription("Capacité maximale du stock.").setMinValue(0).setRequired(true))
      .addIntegerOption((option) => option.setName("reapprovisionnement_jours").setDescription("Intervalle en jours Etheria, facultatif.").setMinValue(1).setMaxValue(120).setRequired(false))
      .addIntegerOption((option) => option.setName("dernier_jour_absolu").setDescription("Compteur absolu du dernier réapprovisionnement, facultatif.").setMinValue(1).setRequired(false))
  );

