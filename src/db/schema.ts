import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Modèle de données.
 *
 * Les binaires — ROMs, jaquettes, sauvegardes, savestates, avatars — vivent sur
 * le disque. La base ne contient que des chemins relatifs à LIBRARY_DIR ou
 * DATA_DIR, de sorte que déplacer le stockage ne demande que de changer une
 * variable d'environnement.
 *
 * Les dates sont stockées en millisecondes : SQLite n'a pas de type date, et un
 * entier se trie sans ambiguïté de fuseau.
 */

const now = sql`(unixepoch() * 1000)`;

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    pseudo: text("pseudo").notNull(),
    /** Facultative : sans elle, seul l'administrateur peut changer le mot de passe. */
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    /** Chemin relatif à DATA_DIR, ex. "avatars/<id>.webp". */
    avatarPath: text("avatar_path"),
    role: text("role", { enum: ["USER", "ADMIN"] })
      .notNull()
      .default("USER"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    /**
     * Ce que le compte voit du catalogue :
     * - `normal` : tous les jeux publiés ;
     * - `restreint` : seulement les jeux listés dans `user_games` — pour faire
     *   essayer le site sans ouvrir toute la bibliothèque ;
     * - `testeur` : les jeux publiés, plus ceux de `user_games` — pour faire
     *   tester un jeu avant sa publication.
     */
    accessMode: text("access_mode", { enum: ["normal", "restreint", "testeur"] })
      .notNull()
      .default("normal"),
    /** Lien d'inscription par lequel le compte est né, s'il est né ainsi. */
    inviteId: text("invite_id"),
    /**
     * Identifiant de l'utilisateur Discord rattaché au compte, s'il y en a un.
     * Un compte né de l'Activité Discord n'a que lui : pas d'adresse, et un
     * mot de passe inutilisable (voir `src/lib/discord/compte.ts`).
     */
    discordId: text("discord_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    // Unicité insensible à la casse : deux comptes ne peuvent pas différer
    // seulement par la casse du pseudo ou de l'adresse.
    uniqueIndex("users_pseudo_unique").on(sql`lower(${table.pseudo})`),
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
    uniqueIndex("users_discord_unique").on(table.discordId),
  ],
);

/** Les jeux attribués à un compte restreint ou testeur (voir `users.access_mode`). */
export const userGames = sqliteTable(
  "user_games",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.gameId] })],
);

export const sessions = sqliteTable(
  "sessions",
  {
    /** Empreinte SHA-256 du jeton : seul le cookie porte la valeur en clair. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    /**
     * « Voir comme » : un administrateur qui regarde le site avec les yeux
     * d'un autre compte. La session reste la sienne (c'est lui qui est
     * connecté), mais les pages servent ce compte-ci tant que c'est posé.
     */
    actingAsUserId: text("acting_as_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("reset_tokens_user_idx").on(table.userId)],
);

/**
 * Inscription fermée : un compte naît d'une invitation ou de l'administrateur.
 *
 * Un lien peut servir à plusieurs comptes — jusqu'à `max_uses` — pour qu'un
 * même lien passe de main en main dans un groupe d'amis. Il reste révocable
 * à tout moment, et chaque compte garde dans `users.invite_id` le lien qui
 * l'a fait naître : si un lien fuit, on retrouve d'un coup ce qu'il a produit.
 */
export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    email: text("email"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    /** Dernier usage : conservé pour l'historique, le compte est dans `used_by`. */
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
    maxUses: integer("max_uses").notNull().default(1),
    usesCount: integer("uses_count").notNull().default(0),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
);

/**
 * Inscription ouverte : quelqu'un demande un compte avec son adresse, reçoit
 * un lien, et le compte n'existe qu'une fois le lien confirmé. Jusque-là, la
 * demande vit ici — pas dans `users`, pour qu'une adresse jamais confirmée ne
 * laisse ni compte vide ni pseudo bloqué.
 */
export const pendingRegistrations = sqliteTable(
  "pending_registrations",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    pseudo: text("pseudo").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** Empreinte SHA-256 du jeton envoyé par mail. */
    code: text("code").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("pending_registrations_email_idx").on(table.email)],
);

/**
 * Réglages du site modifiables depuis l'administration, en clé → valeur.
 * Ce qui dépend de l'installation reste dans l'environnement ; ici, ce qui
 * peut changer sans redémarrer — comme l'ouverture des inscriptions.
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const consoles = sqliteTable("consoles", {
  /** "gb", "gbc", "gba" — sert dans les URLs et nomme les dossiers. */
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  /** La GBA ajoute L et R : le gamepad tactile s'adapte. */
  hasShoulderButtons: integer("has_shoulder_buttons", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Résolution native, pour dimensionner le canvas et le bézel. */
  screenWidth: integer("screen_width").notNull(),
  screenHeight: integer("screen_height").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    consoleSlug: text("console_slug")
      .notNull()
      .references(() => consoles.slug, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // Métadonnées propres aux rom hacks et aux traductions
    author: text("author"),
    version: text("version"),
    language: text("language"),
    baseGame: text("base_game"),
    year: integer("year"),

    /**
     * Regroupement de plusieurs entrées sous une seule fiche.
     *
     * Certains titres n'existent qu'en morceaux — une vidéo découpée en huit
     * ROMs, par exemple. Chaque morceau reste un jeu à part entière, avec sa
     * ROM et sa sauvegarde, mais le catalogue n'en montre qu'une carte, et la
     * fiche liste les parties.
     */
    groupSlug: text("group_slug"),
    groupTitle: text("group_title"),
    partNumber: integer("part_number"),

    /** Chemins relatifs à LIBRARY_DIR. */
    romPath: text("rom_path").notNull(),
    romSha1: text("rom_sha1").notNull(),
    romSize: integer("rom_size").notNull(),
    /** Préfixe des miniatures, sans le suffixe de taille ni l'extension. */
    coverPath: text("cover_path"),
    /** Vrai si la jaquette d'origine portait aussi le dos de la boîte. */
    hasBackCover: integer("has_back_cover", { mode: "boolean" }).notNull().default(false),
    /** Étiquette de cartouche, quand elle accompagne la jaquette. */
    labelPath: text("label_path"),

    /**
     * Titre, auteur et jeu de base concaténés, en minuscules et sans accents.
     *
     * SQLite compare les accents : sans cette colonne, chercher « emeraude »
     * ne trouverait pas « Émeraude ». Rempli par le scan, jamais à la main.
     */
    searchText: text("search_text").notNull().default(""),

    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
    /**
     * Jeu du commerce, tel qu'il est sorti — par opposition aux rom hacks et
     * aux traductions, qui sont la raison d'être du site. Sert au filtre du
     * catalogue et tient ces jeux hors des nouveautés.
     */
    isOfficial: integer("is_official", { mode: "boolean" }).notNull().default(false),
    releasedAt: integer("released_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),

    // Dénormalisés, pour trier le catalogue sans agréger à chaque affichage.
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    playCount: integer("play_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("games_console_slug_unique").on(table.consoleSlug, table.slug),
    index("games_console_title_idx").on(table.consoleSlug, table.title),
    index("games_rating_idx").on(table.ratingAvg),
    index("games_plays_idx").on(table.playCount),
    index("games_search_idx").on(table.searchText),
    index("games_group_idx").on(table.consoleSlug, table.groupSlug),
  ],
);

export const ratings = sqliteTable(
  "ratings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameId] }),
    index("ratings_game_idx").on(table.gameId),
  ],
);

// ---------------------------------------------------------------------------
// Parties et sauvegardes
// ---------------------------------------------------------------------------

/** Les jeux qu'un compte a mis de côté pour les retrouver vite. */
export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [primaryKey({ columns: [table.userId, table.gameId] })],
);

export const playSessions = sqliteTable(
  "play_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().default(now),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull().default(now),
    durationSec: integer("duration_sec").notNull().default(0),
  },
  (table) => [
    index("plays_user_recent_idx").on(table.userId, table.lastSeenAt),
    index("plays_game_idx").on(table.gameId),
  ],
);

/** Une sauvegarde SRAM par compte et par jeu. */
export const saveFiles = sqliteTable(
  "save_files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    /** Chemin relatif à DATA_DIR. */
    path: text("path").notNull(),
    size: integer("size").notNull(),
    /** Empreinte du contenu : évite de réécrire une sauvegarde identique. */
    hash: text("hash"),
    /** Incrémentée à chaque écriture : détecte un conflit entre deux appareils. */
    revision: integer("revision").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [uniqueIndex("save_files_user_game_unique").on(table.userId, table.gameId)],
);

/** Versions précédentes en rotation : filet contre un écrasement malheureux. */
export const saveBackups = sqliteTable(
  "save_backups",
  {
    id: text("id").primaryKey(),
    saveFileId: text("save_file_id")
      .notNull()
      .references(() => saveFiles.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    size: integer("size").notNull(),
    revision: integer("revision").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("save_backups_file_idx").on(table.saveFileId, table.createdAt)],
);

/** Cinq par compte et par jeu : le quota est appliqué côté serveur. */
export const saveStates = sqliteTable(
  "save_states",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    /**
     * Pris automatiquement, par rotation, plutôt que demandé par le joueur.
     *
     * Les deux séries sont indépendantes et ont chacune leurs emplacements :
     * une reprise automatique ne doit jamais écraser celle qu'un joueur a
     * posée avant un combat difficile.
     */
    isAuto: integer("is_auto", { mode: "boolean" }).notNull().default(false),
    label: text("label"),
    path: text("path").notNull(),
    thumbPath: text("thumb_path"),
    size: integer("size").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    uniqueIndex("save_states_slot_unique").on(
      table.userId,
      table.gameId,
      table.isAuto,
      table.slot,
    ),
    index("save_states_user_game_idx").on(table.userId, table.gameId),
  ],
);

/**
 * Touches du clavier et boutons de la manette, par compte.
 *
 * Une disposition vaut pour toutes les consoles : elles ont les mêmes boutons,
 * et régler ses touches une fois par console ressemblait, pour le joueur, à
 * un réglage qui ne tient pas. La ligne la plus récente du compte fait foi
 * (voir `src/lib/keymap/lecture.ts`) ; `console_slug` garde la console où le
 * réglage a été fait la première fois, et rien ne le lit plus.
 */
export const keymaps = sqliteTable(
  "keymaps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consoleSlug: text("console_slug")
      .notNull()
      .references(() => consoles.slug, { onDelete: "cascade" }),
    /** Bouton de la console → touche du clavier, en JSON ; « "" » = bouton laissé sans touche. */
    mapping: text("mapping").notNull(),
    /** Même chose pour une manette à numérotation standard ; null = disposition par défaut. */
    gamepad: text("gamepad"),
    /**
     * Les manettes que le navigateur ne reconnaît pas, en JSON : une
     * disposition par manette et par type d'appareil (« android|8BitDo… »),
     * leur numérotation n'étant pas la même d'un système à l'autre.
     */
    gamepads: text("gamepads"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [uniqueIndex("keymaps_user_console_unique").on(table.userId, table.consoleSlug)],
);

/**
 * Habillages d'écran (bezels), trouvés par le scan dans `LIBRARY_DIR/bezels/`.
 *
 * Comme les jeux, c'est un cache : la table se reconstruit à chaque scan, et
 * les images servies sont des copies produites dans DATA_DIR.
 *
 * La zone d'écran est mesurée sur l'image elle-même — la partie transparente
 * qui entoure son centre — et rangée en fractions de l'image. Elle change d'un
 * habillage à l'autre : un fichier de plus ne demande aucun réglage à la main.
 */
export const bezels = sqliteTable(
  "bezels",
  {
    /** `<console>-<nom du fichier>` : stable d'un scan à l'autre. */
    id: text("id").primaryKey(),
    consoleSlug: text("console_slug")
      .notNull()
      .references(() => consoles.slug, { onDelete: "cascade" }),
    /** Nom affiché, tiré du nom de fichier. */
    name: text("name").notNull(),
    /** Image servie, relative à DATA_DIR. */
    path: text("path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** Zone d'écran, en fractions de la largeur et de la hauteur de l'image. */
    screenX: real("screen_x").notNull(),
    screenY: real("screen_y").notNull(),
    screenW: real("screen_w").notNull(),
    screenH: real("screen_h").notNull(),
    /** Change quand l'image change : sert de version dans l'adresse. */
    hash: text("hash").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("bezels_console_idx").on(table.consoleSlug)],
);

/**
 * L'habillage choisi par un compte, pour une console.
 *
 * Pas de clé étrangère vers `bezels` : cette table-là est reconstruite par le
 * scan, et un fichier renommé ne doit pas effacer le choix des joueurs. Un
 * choix qui ne correspond plus à rien retombe simplement sur le défaut.
 * `bezel_id` vide veut dire « aucun habillage », choisi explicitement.
 */
export const bezelChoices = sqliteTable(
  "bezel_choices",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consoleSlug: text("console_slug")
      .notNull()
      .references(() => consoles.slug, { onDelete: "cascade" }),
    bezelId: text("bezel_id"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [primaryKey({ columns: [table.userId, table.consoleSlug] })],
);

// ---------------------------------------------------------------------------
// Activités Discord
// ---------------------------------------------------------------------------

/**
 * Une application Discord déclarée depuis l'administration : un nom d'hôte,
 * les identifiants de l'application, et **le seul jeu** qu'elle sert.
 *
 * Le nom d'hôte désigne l'application : une requête qui arrive sur cet hôte
 * est servie avec ces réglages et ce jeu, et rien d'autre du site (voir
 * `src/proxy.ts`). L'environnement (`DISCORD_*`) reste le repli pour une
 * installation à une seule Activité, sans ligne ici.
 *
 * Le secret et le jeton de bot sont rangés comme les autres secrets des
 * réglages (voir `src/lib/parametres.ts`) : lisibles par le seul compte du
 * service, jamais renvoyés au navigateur.
 */
export const discordApps = sqliteTable(
  "discord_apps",
  {
    id: text("id").primaryKey(),
    /** Pour l'administrateur : « Pokémon Prism », « Traduction de X ». */
    name: text("name").notNull(),
    /** Nom d'hôte, en minuscules, sans schéma ni port. */
    host: text("host").notNull(),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret").notNull(),
    /** Verrou facultatif : le seul serveur Discord où l'Activité se joue. */
    guildId: text("guild_id").notNull().default(""),
    /** Exigé par le verrou ; vide sinon. */
    botToken: text("bot_token").notNull().default(""),
    /**
     * Les rôles du serveur du verrou qui donnent le droit de jouer : un
     * tableau JSON d'identifiants. Vide : tous les membres du serveur. N'a de
     * sens qu'avec le verrou (voir `src/lib/discord/roles.ts`).
     */
    roles: text("roles").notNull().default(""),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    /** Mot d'accueil, le même à chaque lancement ; vide : rien d'affiché. */
    welcome: text("welcome").notNull().default(""),
    /**
     * Qui propose l'Activité et comment le joindre : affichés sur ses pages
     * de confidentialité et de conditions d'utilisation (`/discord/…`), que
     * Discord demande de lier dans le portail. Saisis par l'administrateur,
     * jamais écrits dans le dépôt ; vides : les pages renvoient au serveur
     * Discord où l'Activité est installée.
     */
    publisher: text("publisher").notNull().default(""),
    contact: text("contact").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [uniqueIndex("discord_apps_host_unique").on(table.host)],
);

/**
 * Les astuces d'une Activité : mot du jour, conseil, rappel. L'accueil en
 * tire une au hasard à chaque lancement. Autant qu'on veut, dans l'ordre
 * d'ajout pour l'administrateur.
 */
export const discordTips = sqliteTable(
  "discord_tips",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => discordApps.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("discord_tips_app_idx").on(table.appId, table.createdAt)],
);

// ---------------------------------------------------------------------------
// Relations, pour l'API de requêtes de Drizzle
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  ratings: many(ratings),
  plays: many(playSessions),
  saves: many(saveFiles),
  saveStates: many(saveStates),
  keymaps: many(keymaps),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const consolesRelations = relations(consoles, ({ many }) => ({
  games: many(games),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  console: one(consoles, { fields: [games.consoleSlug], references: [consoles.slug] }),
  ratings: many(ratings),
  plays: many(playSessions),
  saves: many(saveFiles),
  saveStates: many(saveStates),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(users, { fields: [ratings.userId], references: [users.id] }),
  game: one(games, { fields: [ratings.gameId], references: [games.id] }),
}));

export const playSessionsRelations = relations(playSessions, ({ one }) => ({
  user: one(users, { fields: [playSessions.userId], references: [users.id] }),
  game: one(games, { fields: [playSessions.gameId], references: [games.id] }),
}));

export const saveFilesRelations = relations(saveFiles, ({ one, many }) => ({
  user: one(users, { fields: [saveFiles.userId], references: [users.id] }),
  game: one(games, { fields: [saveFiles.gameId], references: [games.id] }),
  backups: many(saveBackups),
}));

export const saveBackupsRelations = relations(saveBackups, ({ one }) => ({
  saveFile: one(saveFiles, { fields: [saveBackups.saveFileId], references: [saveFiles.id] }),
}));

export const saveStatesRelations = relations(saveStates, ({ one }) => ({
  user: one(users, { fields: [saveStates.userId], references: [users.id] }),
  game: one(games, { fields: [saveStates.gameId], references: [games.id] }),
}));

export const keymapsRelations = relations(keymaps, ({ one }) => ({
  user: one(users, { fields: [keymaps.userId], references: [users.id] }),
  console: one(consoles, { fields: [keymaps.consoleSlug], references: [consoles.slug] }),
}));

export type User = typeof users.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type ConsoleRow = typeof consoles.$inferSelect;
export type SaveStateRow = typeof saveStates.$inferSelect;
