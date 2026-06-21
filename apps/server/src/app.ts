import { Hono } from "hono"
import { createHostRoutes } from "./routes/hosts"
import { DemoScanner } from "./scanner/demo-scanner"
import { InMemoryHostStore } from "./store/host-store"
import type { HostStore } from "./store/host-store"
import type { Scanner } from "./scanner/scanner"

export interface AppDeps {
  store: HostStore
  scanner: Scanner
}

export function createApp(deps: AppDeps = {
  store: new InMemoryHostStore(),
  scanner: new DemoScanner(),
}) {
  const { store, scanner } = deps
  const app = new Hono()

  app.get("/api/health", (c) => c.json({ status: "ok", scanner: scanner.name }))

  app.post("/api/scan", async (c) => {
    const observations = await scanner.scan()
    const hosts = await store.applyScan(observations)
    return c.json({ scannedAt: new Date().toISOString(), hosts })
  })

  app.route("/api/hosts", createHostRoutes(store, scanner))

  // Web build is served in production; refined when the build path is finalized.
  app.get("/", (c) => c.text("Lantern API. UI is served from apps/web build."))

  return app
}
