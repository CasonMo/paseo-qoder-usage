import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const quotaBucketSchema = z.object({
  used: z.number().nullable(),
  remaining: z.number().nullable(),
  total: z.number().nullable(),
  percentage: z.number().nullable(),
  unit: z.string().nullable(),
});

export const quotaSnapshotSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  fetchedAt: z.number().nullable(),
  userType: z.string().nullable(),
  expiresAt: z.number().nullable(),
  totalUsagePercentage: z.number().nullable(),
  isQuotaExceeded: z.boolean().nullable(),
  upgradeUrl: z.string().nullable(),
  userQuota: quotaBucketSchema.nullable(),
  addOnQuota: quotaBucketSchema.nullable(),
  orgResourcePackage: quotaBucketSchema.nullable(),
});

export const quotaStateSchema = z.object({
  snapshot: quotaSnapshotSchema,
  intervalMinutes: z.number(),
  fetching: z.boolean(),
  needsInstall: z.boolean(),
});

export const qoderQuotaGetRpc = defineRpc({
  name: "qoder.quota.get",
  input: z.object({}),
  output: quotaStateSchema,
});

export const qoderQuotaRefreshRpc = defineRpc({
  name: "qoder.quota.refresh",
  input: z.object({}),
  output: quotaStateSchema,
});

export const qoderSdkInstallRpc = defineRpc({
  name: "qoder.sdk.install",
  input: z.object({}),
  output: quotaStateSchema,
});

export const qoderConfigSetRpc = defineRpc({
  name: "qoder.config.set",
  input: z.object({ intervalMinutes: z.number() }),
  output: quotaStateSchema,
});

export type QuotaBucket = z.infer<typeof quotaBucketSchema>;
export type QuotaSnapshot = z.infer<typeof quotaSnapshotSchema>;
export type QuotaState = z.infer<typeof quotaStateSchema>;
