CREATE TABLE `builds` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`version` integer NOT NULL,
	`spec` text NOT NULL,
	`html` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`signature` text,
	`payload` text NOT NULL,
	`error` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locks` (
	`project` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `policies` (
	`project` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`percent` integer DEFAULT 80 NOT NULL,
	`max_lamports` text DEFAULT '100000000' NOT NULL,
	`reserve_lamports` text DEFAULT '20000000' NOT NULL,
	`daily_lamports` text DEFAULT '500000000' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`description` text NOT NULL,
	`config` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`mint` text,
	`parent` text,
	`treasury` text,
	`secret` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`owner` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
