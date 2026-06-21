import type { Host } from "@lantern/shared"

// A point-in-time observation from a scan, before merge into the store.
export interface ScanObservation {
  mac: string
  ip: string | null
  hostname: string | null
  vendor: string | null
}

// All scanner implementations (demo now, arp-scan later) satisfy this.
export interface Scanner {
  readonly name: string
  scan(): Promise<ScanObservation[]>
}

// Helper consumers may use to know whether a host appeared in a scan.
export type ObservedMacSet = ReadonlySet<string>

export type { Host }
