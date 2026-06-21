import { test, expect } from "bun:test"
import { createDb } from "../db/client"
import { SqliteHostStore } from "./sqlite-host-store"

function freshStore() {
  return new SqliteHostStore(createDb(":memory:"))
}

test("applyScan inserts new hosts as unknown+online", async () => {
  const store = freshStore()
  const hosts = await store.applyScan([
    { mac: "a1:b2:c3:d4:e5:01", ip: "10.0.0.1", hostname: "r", vendor: "v" },
  ])
  expect(hosts).toHaveLength(1)
  expect(hosts[0].isOnline).toBe(true)
  expect(hosts[0].isKnown).toBe(false)
})

test("a host unseen in the next scan goes offline and records history", async () => {
  const store = freshStore()
  await store.applyScan([{ mac: "a1:b2:c3:d4:e5:01", ip: null, hostname: null, vendor: null }])
  const [host] = await store.listHosts()
  await store.applyScan([]) // nothing seen
  const after = await store.getHost(host.id)
  expect(after?.isOnline).toBe(false)
  const history = await store.getHistory(host.id)
  expect(history.length).toBeGreaterThanOrEqual(2) // online then offline
})

test("createHost then deleteHosts removes it", async () => {
  const store = freshStore()
  const host = await store.createHost({ mac: "a1:b2:c3:d4:e5:09", name: "x" })
  expect(await store.deleteHosts([host.id])).toBe(1)
  expect(await store.getHost(host.id)).toBeNull()
})

test("re-scan updates existing host fields", async () => {
  const store = freshStore()
  await store.applyScan([{ mac: "a1:b2:c3:d4:e5:01", ip: "10.0.0.1", hostname: null, vendor: null }])
  const [before] = await store.listHosts()
  expect(before.ip).toBe("10.0.0.1")
  expect(before.hostname).toBeNull()

  await store.applyScan([{ mac: "a1:b2:c3:d4:e5:01", ip: "10.0.0.2", hostname: "updated.local", vendor: "Acme" }])
  const [after] = await store.listHosts()
  expect(after.ip).toBe("10.0.0.2")
  expect(after.hostname).toBe("updated.local")
  expect(after.vendor).toBe("Acme")
  expect(after.isOnline).toBe(true)
})

test("updateHost patches name and isKnown", async () => {
  const store = freshStore()
  await store.applyScan([{ mac: "a1:b2:c3:d4:e5:02", ip: null, hostname: null, vendor: null }])
  const [host] = await store.listHosts()
  const updated = await store.updateHost(host.id, { name: "My Device", isKnown: true })
  expect(updated?.name).toBe("My Device")
  expect(updated?.isKnown).toBe(true)
})

test("deleteHosts cascades to host_history", async () => {
  const store = freshStore()
  await store.applyScan([{ mac: "a1:b2:c3:d4:e5:03", ip: null, hostname: null, vendor: null }])
  const [host] = await store.listHosts()
  // Confirm history exists
  const historyBefore = await store.getHistory(host.id)
  expect(historyBefore.length).toBeGreaterThan(0)
  // Delete the host
  await store.deleteHosts([host.id])
  // History should be gone too (cascade)
  const historyAfter = await store.getHistory(host.id)
  expect(historyAfter).toHaveLength(0)
})

test("getHost returns null for unknown id", async () => {
  const store = freshStore()
  expect(await store.getHost("nonexistent-id")).toBeNull()
})

test("deleteHosts with empty array returns 0", async () => {
  const store = freshStore()
  expect(await store.deleteHosts([])).toBe(0)
})
