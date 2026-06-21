import { test, expect } from "bun:test"
import { hostSchema, macAddressSchema, createHostInputSchema } from "./host"

test("hostSchema accepts a valid host", () => {
  const result = hostSchema.safeParse({
    id: "h1",
    mac: "a1:b2:c3:d4:e5:f6",
    ip: "192.168.1.10",
    hostname: "nas.local",
    vendor: "Synology",
    name: "NAS",
    isKnown: true,
    isOnline: true,
    firstSeen: "2026-06-19T00:00:00.000Z",
    lastSeen: "2026-06-19T01:00:00.000Z",
  })
  expect(result.success).toBe(true)
})

test("macAddressSchema rejects upper-case and malformed MACs", () => {
  expect(macAddressSchema.safeParse("A1:B2:C3:D4:E5:F6").success).toBe(false)
  expect(macAddressSchema.safeParse("not-a-mac").success).toBe(false)
})

test("createHostInputSchema requires a MAC", () => {
  expect(createHostInputSchema.safeParse({}).success).toBe(false)
  expect(
    createHostInputSchema.safeParse({ mac: "a1:b2:c3:d4:e5:f6" }).success
  ).toBe(true)
})
