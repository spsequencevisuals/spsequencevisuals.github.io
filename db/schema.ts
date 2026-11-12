import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const enquiries = sqliteTable("enquiries", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  payloadHash: text("payload_hash").notNull(),
  intent: text("intent").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  service: text("service").notNull(),
  budget: text("budget").notNull().default(""),
  preferredDate: text("preferred_date").notNull().default(""),
  preferredTime: text("preferred_time").notNull().default(""),
  details: text("details").notNull(),
  referenceUrl: text("reference_url").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("enquiries_created_idx").on(table.createdAt, table.id)]);

export const requestLimits = sqliteTable("request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: integer("expires_at").notNull(),
});

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const portfolioProjects = sqliteTable("portfolio_projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  sortOrder: integer("sort_order").notNull().default(0),
  dataJson: text("data_json").notNull(),
  mediaId: text("media_id"),
  posterId: text("poster_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const studioSettings = sqliteTable("studio_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const socialDrafts = sqliteTable("social_drafts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  dataJson: text("data_json").notNull(),
  state: text("state").notNull().default("draft"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const socialDispatches = sqliteTable("social_dispatches", {
  id: text("id").primaryKey(),
  draftId: text("draft_id").notNull(),
  channelId: text("channel_id").notNull(),
  service: text("service").notNull(),
  state: text("state").notNull().default("sending"),
  providerPostId: text("provider_post_id"),
  externalLink: text("external_link"),
  message: text("message").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("social_dispatches_draft_idx").on(table.draftId)]);
