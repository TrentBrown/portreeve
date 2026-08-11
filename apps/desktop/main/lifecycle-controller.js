// @ts-check

import {
  LifecycleMutationResultSchema,
  LifecycleStatusSchema,
  SemanticVersionSchema,
} from '../../../src/supervision/schemas.js';
import {
  PurgePreviewSchema,
  PurgeResultSchema,
} from '../../../src/supervision/purge.js';
import { createLifecycleService } from '../../../src/supervision/service.js';
import { PORTREEVE_VERSION } from '../../../src/version.js';

const VERSION_MISMATCH_CODE = 'controller_artifact_version_mismatch';

/**
 * Construct the Desktop's privileged lifecycle authority from trusted main-process
 * inputs. The renderer never supplies controller paths, native arguments, runtime
 * locations, environment overrides, or supervisor choices.
 *
 * @param {{version: string, executablePath: string}} artifact
 * @param {{
 *   controllerVersion?: string,
 *   createService?: typeof createLifecycleService
 * }} [dependencies]
 */
export function createDesktopLifecycleController(artifact, dependencies = {}) {
  const artifactVersion = SemanticVersionSchema.parse(artifact.version);
  const controllerVersion = SemanticVersionSchema.parse(
    dependencies.controllerVersion ?? PORTREEVE_VERSION,
  );
  const service = (dependencies.createService ?? createLifecycleService)({
    sourceExecutable: artifact.executablePath,
  });
  const mismatch =
    controllerVersion === artifactVersion
      ? null
      : Object.freeze({
          code: VERSION_MISMATCH_CODE,
          message: `PortReeve lifecycle controller ${controllerVersion} does not match bundled artifact ${artifactVersion}. Lifecycle mutations are disabled.`,
        });
  const compatibility = Object.freeze({
    version: controllerVersion,
    mutationsEnabled: mismatch === null,
    error: mismatch,
  });
  /** @type {string|null} */
  let purgeToken = null;

  function assertMutationsEnabled() {
    if (mismatch === null) return;
    throw desktopControllerError(mismatch.code, mismatch.message);
  }

  /** @param {string} operation @param {() => Promise<unknown>} invoke */
  async function mutate(operation, invoke) {
    purgeToken = null;
    assertMutationsEnabled();
    const parsed = LifecycleMutationResultSchema.safeParse(await invoke());
    if (!parsed.success || parsed.data.operation !== operation) {
      throw desktopControllerError(
        'invalid_lifecycle_result',
        'PortReeve returned an unsupported lifecycle result.',
      );
    }
    return parsed.data;
  }

  return Object.freeze({
    compatibility,
    async status() {
      const parsed = LifecycleStatusSchema.safeParse(await service.status());
      if (!parsed.success) {
        throw desktopControllerError(
          'invalid_lifecycle_status',
          'PortReeve returned unsupported lifecycle status evidence.',
        );
      }
      return parsed.data;
    },
    install: () => mutate('install', () => service.install()),
    start: () => mutate('start', () => service.start()),
    stop: () => mutate('stop', () => service.stop()),
    stopManual: () => mutate('stop-manual', () => service.stopManual()),
    restart: () => mutate('restart', () => service.restart()),
    uninstall: () => mutate('uninstall', () => service.uninstall()),
    async previewPurge() {
      purgeToken = null;
      const parsed = PurgePreviewSchema.safeParse(await service.previewPurge());
      if (!parsed.success) {
        throw desktopControllerError(
          'invalid_purge_preview',
          'PortReeve returned an unsupported purge preview.',
        );
      }
      purgeToken = parsed.data.confirmationToken;
      return {
        allowed: parsed.data.allowed,
        root: parsed.data.root,
        paths: parsed.data.paths.map(({ path, type, size }) => ({ path, type, size })),
        refused: parsed.data.refused,
      };
    },
    async executePurge() {
      const token = purgeToken;
      purgeToken = null;
      assertMutationsEnabled();
      if (token === null) {
        throw desktopControllerError(
          'purge_preview_required',
          'A fresh purge preview is required before deletion.',
        );
      }
      const parsed = PurgeResultSchema.safeParse(await service.purge(token));
      if (!parsed.success || parsed.data.confirmationToken !== token) {
        throw desktopControllerError(
          'invalid_purge_result',
          'PortReeve returned an unsupported purge result.',
        );
      }
      return {
        outcome: parsed.data.outcome,
        removed: parsed.data.removed,
        retained: parsed.data.retained,
        missing: parsed.data.missing,
        refused: parsed.data.refused,
      };
    },
    clearPurgePreview() {
      purgeToken = null;
    },
  });
}

/** @param {string} code @param {string} message */
function desktopControllerError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
