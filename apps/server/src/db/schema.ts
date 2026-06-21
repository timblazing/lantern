import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const hosts = sqliteTable("hosts", {
  id: text("id").primaryKey(),
  mac: text("mac").notNull().unique(),
  ip: text("ip"),
  hostname: text("hostname"),
  vendor: text("vendor"),
  name: text("name").notNull(),
  isKnown: integer("is_known", { mode: "boolean" }).notNull().default(false),
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  firstSeen: text("first_seen").notNull(),
  lastSeen: text("last_seen").notNull(),
})

export const hostHistory = sqliteTable("host_history", {
  id: text("id").primaryKey(),
  hostId: text("host_id")
    .notNull()
    .references(() => hosts.id, { onDelete: "cascade" }),
  isOnline: integer("is_online", { mode: "boolean" }).notNull(),
  observedAt: text("observed_at").notNull(),
})

export type HostRow = typeof hosts.$inferSelect
export type HostHistoryRow = typeof hostHistory.$inferSelect
