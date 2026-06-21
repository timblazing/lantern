import { z } from "zod"
import { hostSchema, hostHistoryEntrySchema } from "./host"

// GET /api/hosts
export const listHostsResponseSchema = z.object({
  hosts: z.array(hostSchema),
})
export type ListHostsResponse = z.infer<typeof listHostsResponseSchema>

// GET /api/hosts/:id
export const hostDetailResponseSchema = z.object({
  host: hostSchema,
  history: z.array(hostHistoryEntrySchema),
})
export type HostDetailResponse = z.infer<typeof hostDetailResponseSchema>

// DELETE /api/hosts (bulk) — body
export const deleteHostsInputSchema = z.object({
  ids: z.array(z.string()).min(1),
})
export type DeleteHostsInput = z.infer<typeof deleteHostsInputSchema>

// POST /api/scan — triggers a rescan; returns hosts seen.
export const scanResultSchema = z.object({
  scannedAt: z.iso.datetime(),
  hosts: z.array(hostSchema),
})
export type ScanResult = z.infer<typeof scanResultSchema>

// POST /api/hosts/:id/wake — Wake-on-LAN
export const wakeResponseSchema = z.object({ sent: z.boolean() })
export type WakeResponse = z.infer<typeof wakeResponseSchema>

// POST /api/hosts/:id/port-check — body + response
export const portCheckInputSchema = z.object({
  port: z.number().int().min(1).max(65535),
})
export type PortCheckInput = z.infer<typeof portCheckInputSchema>

export const portCheckResponseSchema = z.object({
  port: z.number().int(),
  open: z.boolean(),
})
export type PortCheckResponse = z.infer<typeof portCheckResponseSchema>

// Generic error envelope for non-2xx responses.
export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>
