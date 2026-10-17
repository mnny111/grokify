ALTER TABLE `projects` ADD `site_slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_site_slug_unique` ON `projects` (`site_slug`);