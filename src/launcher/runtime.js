// @ts-check

import { PortreeveClient } from '../../packages/client/src/index.js';
import { prepareRuntimeDirectories, resolveRuntimePaths } from '../platform/paths.js';
import { LauncherEnvironmentService } from './environment-service.js';
import { LauncherEvidenceService } from './evidence-service.js';
import { LauncherLifecycleService } from './lifecycle-service.js';
import { createLauncherLocalStateStore } from './local-state.js';
import { AttachedCommandRegistry } from './command-session.js';

/**
 * Construct the shared launcher engine used by CLI and, later, Electron main.
 *
 * @param {{home?: string, socket?: string}} options
 */
export async function createLauncherRuntime(options = {}) {
  const paths = resolveRuntimePaths({
    ...process.env,
    ...(options.home === undefined ? {} : { PORTREEVE_HOME: options.home }),
    ...(options.socket === undefined ? {} : { PORTREEVE_SOCKET: options.socket }),
  });
  await prepareRuntimeDirectories(paths);
  const client = new PortreeveClient({ socketPath: paths.socketPath });
  const stateStore = createLauncherLocalStateStore({ path: paths.launcherStatePath });
  const environmentService = new LauncherEnvironmentService({ client, stateStore });
  const evidenceService = new LauncherEvidenceService({ client });
  const attachedCommands = new AttachedCommandRegistry();
  const lifecycleService = new LauncherLifecycleService({
    client,
    stateStore,
    environmentService,
    evidenceService,
    attachedCommands,
  });
  return Object.freeze({
    paths,
    client,
    stateStore,
    environmentService,
    evidenceService,
    attachedCommands,
    lifecycleService,
  });
}
