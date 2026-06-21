import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import type { Host, HostHistoryEntry } from "@lantern/shared"
import type { HostStore } from "./host-store"
import type { ScanObservation } from "../scanner/scanner"
import type { Db } from "../db/client"
import { hosts, hostHistory, type HostRow } from "../db/schema"

function toHost(row: HostRow): Host {
  return {
    id: row.id,
    mac: row.mac,
    ip: row.ip,
    hostname: row.hostname,
    vendor: row.vendor,
    name: row.name,
    isKnown: row.isKnown,
    isOnline: row.isOnline,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
  }
}

export class SqliteHostStore implements HostStore {
  constructor(private db: Db) {}

  async listHosts(): Promise<Host[]> {
    return (await this.db.select().from(hosts)).map(toHost)
  }

  async getHost(id: string): Promise<Host | null> {
    const row = (await this.db.select().from(hosts).where(eq(hosts.id, id)))[0]
    return row ? toHost(row) : null
  }

  async getHistory(hostId: string): Promise<HostHistoryEntry[]> {
    const rows = await this.db
      .select()
      .from(hostHistory)
      .where(eq(hostHistory.hostId, hostId))
    return rows.map((r) => ({
      id: r.id,
      hostId: r.hostId,
      isOnline: r.isOnline,
      observedAt: r.observedAt,
    }))
  }

  async createHost(input: { mac: string; name?: string; ip?: string }): Promise<Host> {
    const now = new Date().toISOString()
    const row = {
      id: randomUUID(),
      mac: input.mac,
      ip: input.ip ?? null,
      hostname: null,
      vendor: null,
      name: input.name ?? input.mac,
      isKnown: true,
      isOnline: false,
      firstSeen: now,
      lastSeen: now,
    }
    await this.db.insert(hosts).values(row)
    return toHost(row as HostRow)
  }

  async updateHost(id: string, patch: { name?: string; isKnown?: boolean }): Promise<Host | null> {
    const existing = await this.getHost(id)
    if (!existing) return null
    await this.db.update(hosts).set(patch).where(eq(hosts.id, id))
    return { ...existing, ...patch }
  }

  async deleteHosts(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.db.delete(hosts).where(inArray(hosts.id, ids))
    // bun-sqlite returns { changes }; fall back to ids.length if unavailable.
    return (result as unknown as { changes?: number }).changes ?? ids.length
  }

  async applyScan(observations: ScanObservation[]): Promise<Host[]> {
    const now = new Date().toISOString()
    const seen = new Set(observations.map((o) => o.mac))
    const current = await this.listHosts()
    const byMac = new Map(current.map((h) => [h.mac, h]))

    for (const obs of observations) {
      const existing = byMac.get(obs.mac)
      if (existing) {
        if (!existing.isOnline) await this.appendHistory(existing.id, true, now)
        await this.db
          .update(hosts)
          .set({
            ip: obs.ip,
            hostname: obs.hostname ?? existing.hostname,
            vendor: obs.vendor ?? existing.vendor,
            isOnline: true,
            lastSeen: now,
          })
          .where(eq(hosts.id, existing.id))
      } else {
        const id = randomUUID()
        await this.db.insert(hosts).values({
          id,
          mac: obs.mac,
          ip: obs.ip,
          hostname: obs.hostname,
          vendor: obs.vendor,
          name: obs.hostname ?? obs.mac,
          isKnown: false,
          isOnline: true,
          firstSeen: now,
          lastSeen: now,
        })
        await this.appendHistory(id, true, now)
      }
    }

    for (const host of current) {
      if (!seen.has(host.mac) && host.isOnline) {
        await this.db.update(hosts).set({ isOnline: false }).where(eq(hosts.id, host.id))
        await this.appendHistory(host.id, false, now)
      }
    }

    return this.listHosts()
  }

  private async appendHistory(hostId: string, isOnline: boolean, observedAt: string) {
    await this.db.insert(hostHistory).values({ id: randomUUID(), hostId, isOnline, observedAt })
  }
}
