// @ts-check

import { z } from 'zod';
import { PortSchema } from '../protocol/schemas.js';

export const PortRangeSchema = z
  .object({
    start: PortSchema,
    end: PortSchema,
  })
  .refine(({ end, start }) => start <= end, {
    message: 'port range start must not exceed end',
  });

export const ServerSettingsSchema = z
  .object({
    automaticPortRanges: z.array(PortRangeSchema).min(1).max(16),
    excludedPorts: z.array(PortSchema).max(4_096),
    leaseTtlMilliseconds: z.number().int().min(1_000).max(120_000),
    ephemeralAssignmentTtlMilliseconds: z.number().int().min(1_000).max(86_400_000),
    gracefulShutdownMilliseconds: z.number().int().min(100).max(60_000),
    historyMaximumEvents: z.number().int().min(100).max(100_000),
    diagnosticLogMaximumBytes: z
      .number()
      .int()
      .min(16_384)
      .max(104_857_600)
      .default(1_048_576),
    diagnosticLogFiles: z.number().int().min(1).max(16).default(3),
  })
  .superRefine(({ automaticPortRanges, excludedPorts }, context) => {
    const sortedRanges = [...automaticPortRanges].sort(
      (left, right) => left.start - right.start,
    );
    for (let index = 1; index < sortedRanges.length; index += 1) {
      const previous = sortedRanges[index - 1];
      const current = sortedRanges[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        current.start <= previous.end
      ) {
        context.addIssue({
          code: 'custom',
          message: 'automatic port ranges must not overlap',
          path: ['automaticPortRanges'],
        });
      }
    }

    if (new Set(excludedPorts).size !== excludedPorts.length) {
      context.addIssue({
        code: 'custom',
        message: 'excluded ports must be unique',
        path: ['excludedPorts'],
      });
    }
  });

const defaultServerSettings = ServerSettingsSchema.parse({
  automaticPortRanges: [{ start: 10_240, end: 49_151 }],
  excludedPorts: [],
  leaseTtlMilliseconds: 15_000,
  ephemeralAssignmentTtlMilliseconds: 3_600_000,
  gracefulShutdownMilliseconds: 5_000,
  historyMaximumEvents: 10_000,
  diagnosticLogMaximumBytes: 1_048_576,
  diagnosticLogFiles: 3,
});

for (const range of defaultServerSettings.automaticPortRanges) {
  Object.freeze(range);
}
Object.freeze(defaultServerSettings.automaticPortRanges);
Object.freeze(defaultServerSettings.excludedPorts);

export const DEFAULT_SERVER_SETTINGS = Object.freeze(defaultServerSettings);
