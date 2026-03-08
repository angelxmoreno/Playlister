import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const oauthState = pgTable("oauth_state", {
  state: text("state").primaryKey(),
  provider: text("provider").notNull(),
  userId: text("user_id"),
  codeVerifier: text("code_verifier"),
  expiresAt: timestamp("expires_at").notNull(),
});

export const connectedServices = pgTable(
  "connected_services",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.userId, t.provider)]
);

export const playlists = pgTable(
  "playlists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    trackCount: integer("track_count").default(0),
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.userId, t.provider, t.externalId)]
);

export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  playlistId: text("playlist_id")
    .notNull()
    .references(() => playlists.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist"),
  album: text("album"),
  durationMs: integer("duration_ms"),
  position: integer("position").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const snapshots = pgTable("snapshots", {
  id: text("id").primaryKey(),
  playlistId: text("playlist_id")
    .notNull()
    .references(() => playlists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  trackData: jsonb("track_data").notNull(),
  trackCount: integer("track_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type OAuthState = typeof oauthState.$inferSelect;
export type ConnectedService = typeof connectedServices.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
