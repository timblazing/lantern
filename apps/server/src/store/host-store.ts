import { randomUUID } from "node:crypto"
import type { Host, HostHistoryEntry } from "@lantern/shared"
import type { ScanObservation } from "../scanner/scanner"

export interface HostStore {
  listHosts(): Promise<Host[]>
  getHost(id: string): Promise<Host | null>
  getHistory(hostId: string): Promise<HostHistoryEntry[]>
  createHost(input: { mac: string; name?: string; ip?: string }): Promise<Host>
  updateHost(id: string, patch: { name?: string; isKnown?: boolean }): Promise<Host | null>
  deleteHosts(ids: string[]): Promise<number>
  // Merge a scan: upsert observed hosts, flip unseen known hosts offline,
  // append history rows on state change. Returns the full host list after merge.
  applyScan(observations: ScanObservation[]): Promise<Host[]>
}

export class InMemoryHostStore implements HostStore {
  private hosts = new Map<string, Host>()
  private history: HostHistoryEntry[] = []

  async listHosts() {
    return [...this.hosts.values()]
  }

  async getHost(id: string) {
    return this.hosts.get(id) ?? null
  }

  async getHistory(hostId: string) {
    return this.history.filter((h) => h.hostId === hostId)
  }

  async createHost(input: { mac: string; name?: string; ip?: string }) {
    const now = new Date().toISOString()
    const host: Host = {
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
    this.hosts.set(host.id, host)
    return host
  }

  async updateHost(id: string, patch: { name?: string; isKnown?: boolean }) {
    const host = this.hosts.get(id)
    if (!host) return null
    const updated = { ...host, ...patch }
    this.hosts.set(id, updated)
    return updated
  }

  async deleteHosts(ids: string[]) {
    let removed = 0
    for (const id of ids) if (this.hosts.delete(id)) removed++
    return removed
  }

  async applyScan(observations: ScanObservation[]) {
    const now = new Date().toISOString()
    const seen = new Set(observations.map((o) => o.mac))
    const byMac = new Map([...this.hosts.values()].map((h) => [h.mac, h]))

    for (const obs of observations) {
      const existing = byMac.get(obs.mac)
      if (existing) {
        if (!existing.isOnline) this.appendHistory(existing.id, true, now)
        this.hosts.set(existing.id, {
          ...existing,
          ip: obs.ip,
          hostname: obs.hostname ?? existing.hostname,
          vendor: obs.vendor ?? existing.vendor,
          isOnline: true,
          lastSeen: now,
        })
      } else {
        const id = randomUUID()
        this.hosts.set(id, {
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
        this.appendHistory(id, true, now)
      }
    }

    for (const host of this.hosts.values()) {
      if (!seen.has(host.mac) && host.isOnline) {
        this.hosts.set(host.id, { ...host, isOnline: false })
        this.appendHistory(host.id, false, now)
      }
    }

    return [...this.hosts.values()]
  }

  private appendHistory(hostId: string, isOnline: boolean, observedAt: string) {
    this.history.push({ id: randomUUID(), hostId, isOnline, observedAt })
  }
}
