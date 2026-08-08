// @ts-check

import { z } from 'zod';
import { HealthResponseSchema, TimestampSchema } from '../protocol/schemas.js';

export const SemanticVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);

export const LifecycleErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const LifecycleInstallationSchema = z
  .object({
    state: z.enum(['absent', 'installed', 'invalid']),
    managedExecutablePath: z.string().min(1),
    version: SemanticVersionSchema.nullable(),
    error: LifecycleErrorSchema.nullable(),
  })
  .strict();

export const LifecycleSupervisorSchema = z
  .object({
    kind: z.string().min(1),
    state: z.enum(['unavailable', 'inactive', 'starting', 'active', 'failed']),
    mainPid: z.number().int().positive().nullable(),
    error: LifecycleErrorSchema.nullable(),
  })
  .strict();

export const LifecycleSocketSchema = z
  .object({
    path: z.string().min(1),
    state: z.enum(['unavailable', 'healthy', 'unhealthy', 'incompatible']),
    server: HealthResponseSchema.nullable(),
    error: LifecycleErrorSchema.nullable(),
  })
  .strict();

export const LifecycleVersionsSchema = z
  .object({
    cli: SemanticVersionSchema,
    managed: SemanticVersionSchema.nullable(),
    running: SemanticVersionSchema.nullable(),
  })
  .strict();

export const LifecycleStatusSchema = z
  .object({
    observedAt: TimestampSchema,
    installation: LifecycleInstallationSchema,
    supervisor: LifecycleSupervisorSchema,
    socket: LifecycleSocketSchema,
    mode: z.enum(['none', 'manual', 'supervised', 'ambiguous']),
    versions: LifecycleVersionsSchema,
    limitations: z.array(z.string().min(1)),
  })
  .strict();

/**
 * Native supervisor definitions are rendered into line-oriented systemd units
 * and property lists, so a control character in a path would escape its
 * directive and inject a foreign definition.
 */
const SupervisorPathSchema = z
  .string()
  .min(1)
  // eslint-disable-next-line no-control-regex
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
    message: 'supervisor definition paths must not contain control characters',
  });

export const SupervisorDefinitionSchema = z
  .object({
    executable: SupervisorPathSchema,
    applicationDirectory: SupervisorPathSchema,
    socketPath: SupervisorPathSchema,
    standardOutputPath: SupervisorPathSchema,
    standardErrorPath: SupervisorPathSchema,
  })
  .strict();

export const LifecycleOperationSchema = z.enum([
  'install',
  'start',
  'stop',
  'stop-manual',
  'restart',
  'uninstall',
]);

export const LifecycleMutationResultSchema = z
  .object({
    operation: LifecycleOperationSchema,
    outcome: z.enum(['succeeded', 'no-change', 'refused', 'partial', 'failed']),
    changed: z.boolean(),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema,
    before: LifecycleStatusSchema,
    after: LifecycleStatusSchema,
    error: LifecycleErrorSchema.nullable(),
  })
  .strict();

/**
 * Reduce an exception to stable lifecycle evidence without leaking command
 * arguments, paths from nested causes, or implementation-specific stacks.
 *
 * @param {unknown} error
 */
export function lifecycleError(error) {
  if (error instanceof Error) {
    const candidateCode =
      'code' in error && typeof error.code === 'string' ? error.code : 'internal';
    return LifecycleErrorSchema.parse({
      code: candidateCode.trim() || 'internal',
      message: error.message.trim() || error.name || 'Unknown lifecycle error.',
    });
  }
  return LifecycleErrorSchema.parse({
    code: 'internal',
    message: String(error),
  });
}
