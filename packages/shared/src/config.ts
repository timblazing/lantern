import { z } from "zod"

export const scanConfigSchema = z.object({
  // Network interfaces / arp-scan targets. Empty = demo mode (no real scan).
  interfaces: z.array(z.string()).default([]),
  // Seconds between scheduled scans.
  intervalSeconds: z.number().int().positive().default(300),
  // Optional raw arp-scan args.
  arpScanArgs: z.array(z.string()).default([]),
})
export type ScanConfig = z.infer<typeof scanConfigSchema>

export const storageConfigSchema = z.object({
  // Path to the SQLite database file (mounted data dir in container).
  databasePath: z.string().default("./data/lantern.db"),
  // Days of host history to retain.
  historyRetentionDays: z.number().int().positive().default(30),
})
export type StorageConfig = z.infer<typeof storageConfigSchema>

export const notificationConfigSchema = z.object({
  // Generic webhook / Shoutrrr-style URL; empty disables notifications.
  url: z.string().default(""),
  notifyOnNewHost: z.boolean().default(true),
  notifyOnHostOffline: z.boolean().default(false),
})
export type NotificationConfig = z.infer<typeof notificationConfigSchema>

export const appConfigSchema = z.object({
  scan: scanConfigSchema.default(() => scanConfigSchema.parse({})),
  storage: storageConfigSchema.default(() => storageConfigSchema.parse({})),
  notifications: notificationConfigSchema.default(() =>
    notificationConfigSchema.parse({})
  ),
})
export type AppConfig = z.infer<typeof appConfigSchema>
