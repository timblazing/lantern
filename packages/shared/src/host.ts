import { z } from "zod"

// A MAC address, normalized lower-case colon-separated, e.g. "a1:b2:c3:d4:e5:f6".
export const macAddressSchema = z
  .string()
  .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/, "must be a lower-case MAC address")

export const hostSchema = z.object({
  id: z.string(),
  mac: macAddressSchema,
  ip: z.string().nullable(),
  hostname: z.string().nullable(),
  vendor: z.string().nullable(),
  // User-editable display name / alias.
  name: z.string(),
  // Marked known by the user (vs newly-discovered unknown device).
  isKnown: z.boolean(),
  // Currently seen online by the latest scan.
  isOnline: z.boolean(),
  firstSeen: z.iso.datetime(),
  lastSeen: z.iso.datetime(),
})
export type Host = z.infer<typeof hostSchema>

// One online/offline transition for a host.
export const hostHistoryEntrySchema = z.object({
  id: z.string(),
  hostId: z.string(),
  isOnline: z.boolean(),
  observedAt: z.iso.datetime(),
})
export type HostHistoryEntry = z.infer<typeof hostHistoryEntrySchema>

// Payload to manually create a host.
export const createHostInputSchema = z.object({
  mac: macAddressSchema,
  name: z.string().min(1).optional(),
  ip: z.string().optional(),
})
export type CreateHostInput = z.infer<typeof createHostInputSchema>

// Editable fields.
export const updateHostInputSchema = z.object({
  name: z.string().min(1).optional(),
  isKnown: z.boolean().optional(),
})
export type UpdateHostInput = z.infer<typeof updateHostInputSchema>
