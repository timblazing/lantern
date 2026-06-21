import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import {
  createHostInputSchema,
  updateHostInputSchema,
  deleteHostsInputSchema,
  portCheckInputSchema,
} from "@lantern/shared"
import type { HostStore } from "../store/host-store"
import type { Scanner } from "../scanner/scanner"

export function createHostRoutes(store: HostStore, _scanner: Scanner) {
  const app = new Hono()

  app.get("/", async (c) => c.json({ hosts: await store.listHosts() }))

  app.post("/", zValidator("json", createHostInputSchema), async (c) => {
    const host = await store.createHost(c.req.valid("json"))
    return c.json({ host }, 201)
  })

  app.get("/:id", async (c) => {
    const id = c.req.param("id")
    const host = await store.getHost(id)
    if (!host) return c.json({ error: "host not found" }, 404)
    return c.json({ host, history: await store.getHistory(id) })
  })

  app.patch("/:id", zValidator("json", updateHostInputSchema), async (c) => {
    const host = await store.updateHost(c.req.param("id"), c.req.valid("json"))
    if (!host) return c.json({ error: "host not found" }, 404)
    return c.json({ host })
  })

  app.delete("/", zValidator("json", deleteHostsInputSchema), async (c) => {
    const removed = await store.deleteHosts(c.req.valid("json").ids)
    return c.json({ removed })
  })

  app.post("/:id/wake", async (c) => {
    const host = await store.getHost(c.req.param("id"))
    if (!host) return c.json({ error: "host not found" }, 404)
    return c.json({ sent: true })
  })

  app.post(
    "/:id/port-check",
    zValidator("json", portCheckInputSchema),
    async (c) => {
      const host = await store.getHost(c.req.param("id"))
      if (!host) return c.json({ error: "host not found" }, 404)
      const { port } = c.req.valid("json")
      // Demo stub: pretend common ports are open. Real TCP check is later.
      const open = host.isOnline && [22, 80, 443, 445, 3000].includes(port)
      return c.json({ port, open })
    }
  )

  return app
}
