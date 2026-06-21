import { test, expect } from "bun:test"
import { createApp } from "./app"
import { InMemoryHostStore } from "./store/host-store"
import { DemoScanner } from "./scanner/demo-scanner"

function appFor() {
  return createApp({ store: new InMemoryHostStore(), scanner: new DemoScanner() })
}

test("health returns ok", async () => {
  const res = await appFor().request("/api/health")
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ status: "ok" })
})

test("scan then list returns hosts", async () => {
  const app = appFor()
  await app.request("/api/scan", { method: "POST" })
  const res = await app.request("/api/hosts")
  const body = await res.json()
  expect(body.hosts.length).toBeGreaterThan(0)
})

test("creating a host with invalid body is rejected", async () => {
  const res = await appFor().request("/api/hosts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  expect(res.status).toBe(400)
})

test("creating a host with valid body returns 201", async () => {
  const res = await appFor().request("/api/hosts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mac: "aa:bb:cc:dd:ee:ff", name: "Test Device" }),
  })
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(body.host.mac).toBe("aa:bb:cc:dd:ee:ff")
  expect(body.host.name).toBe("Test Device")
})

test("GET /api/hosts/:id for unknown id returns 404", async () => {
  const res = await appFor().request("/api/hosts/nonexistent-id")
  expect(res.status).toBe(404)
})

test("DELETE /api/hosts removes created host", async () => {
  const app = appFor()
  // Create a host first
  const createRes = await app.request("/api/hosts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mac: "11:22:33:44:55:66" }),
  })
  const { host } = await createRes.json()

  const deleteRes = await app.request("/api/hosts", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: [host.id] }),
  })
  expect(deleteRes.status).toBe(200)
  const body = await deleteRes.json()
  expect(body.removed).toBe(1)
})

test("GET /api/hosts/:id returns host with history after scan", async () => {
  const app = appFor()
  await app.request("/api/scan", { method: "POST" })
  const listRes = await app.request("/api/hosts")
  const { hosts } = await listRes.json()
  expect(hosts.length).toBeGreaterThan(0)

  const detailRes = await app.request(`/api/hosts/${hosts[0].id}`)
  expect(detailRes.status).toBe(200)
  const body = await detailRes.json()
  expect(body.host).toBeDefined()
  expect(Array.isArray(body.history)).toBe(true)
})
