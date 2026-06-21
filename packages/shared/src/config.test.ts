import { test, expect } from "bun:test"
import { appConfigSchema } from "./config"

test("appConfigSchema fills defaults from an empty object", () => {
  const cfg = appConfigSchema.parse({})
  expect(cfg.scan.intervalSeconds).toBe(300)
  expect(cfg.storage.databasePath).toBe("./data/lantern.db")
  expect(cfg.notifications.notifyOnNewHost).toBe(true)
})
