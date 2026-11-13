CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolio_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`data_json` text NOT NULL,
	`media_id` text,
	`poster_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`service` text NOT NULL,
	`state` text DEFAULT 'sending' NOT NULL,
	`provider_post_id` text,
	`external_link` text,
	`message` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `social_dispatches_draft_idx` ON `social_dispatches` (`draft_id`);--> statement-breakpoint
CREATE TABLE `social_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`data_json` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_sessions(id TEXT PRIMARY KEY,storage_key TEXT NOT NULL,upload_id TEXT NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,owner_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS upload_parts(session_id TEXT NOT NULL,part_number INTEGER NOT NULL,etag TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(session_id,part_number));

