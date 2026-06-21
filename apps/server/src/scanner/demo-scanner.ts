import type { Scanner, ScanObservation } from "./scanner"

const FIXTURES: ScanObservation[] = [
  { mac: "a1:b2:c3:d4:e5:01", ip: "192.168.1.1", hostname: "router.local", vendor: "Ubiquiti" },
  { mac: "a1:b2:c3:d4:e5:02", ip: "192.168.1.10", hostname: "nas.local", vendor: "Synology" },
  { mac: "a1:b2:c3:d4:e5:03", ip: "192.168.1.20", hostname: "desktop.local", vendor: "Intel" },
  { mac: "a1:b2:c3:d4:e5:04", ip: "192.168.1.30", hostname: null, vendor: "Espressif" },
  { mac: "a1:b2:c3:d4:e5:05", ip: "192.168.1.40", hostname: "tv.local", vendor: "Samsung" },
]

export class DemoScanner implements Scanner {
  readonly name = "demo"

  async scan(): Promise<ScanObservation[]> {
    // Always-on devices plus a random subset of the rest, to simulate churn.
    const [router, ...rest] = FIXTURES
    const present = rest.filter(() => Math.random() > 0.25)
    return [router, ...present]
  }
}
