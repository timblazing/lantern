CREATE TABLE `host_history` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`is_online` integer NOT NULL,
	`observed_at` text NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `hosts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hosts` (
	`id` text PRIMARY KEY NOT NULL,
	`mac` text NOT NULL,
	`ip` text,
	`hostname` text,
	`vendor` text,
	`name` text NOT NULL,
	`is_known` integer DEFAULT false NOT NULL,
	`is_online` integer DEFAULT false NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hosts_mac_unique` ON `hosts` (`mac`);