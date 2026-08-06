// @ts-check

import { chmod } from 'node:fs/promises';
import { AllocationService } from '../../allocation/service.js';
import { DockerCliAdapter } from '../../docker/adapter.js';
import { DiagnosticLog } from '../../observability/diagnostic-log.js';
import {
  prepareRuntimeDirectories,
  resolveRuntimePaths,
  validateExistingDatabase,
} from '../../platform/paths.js';
import { startPortreeveServer } from '../../server/server.js';
import { openRegistry } from '../../storage/registry.js';

/**
 * @param {{home?: string, socket?: string}} options
 */
export async function serveCommand(options) {
  const paths = resolveRuntimePaths({
    ...process.env,
    ...(options.home ? { PORTREEVE_HOME: options.home } : {}),
    ...(options.socket ? { PORTREEVE_SOCKET: options.socket } : {}),
  });
  await prepareRuntimeDirectories(paths);
  await validateExistingDatabase(paths.databasePath);

  const registry = openRegistry(paths.databasePath);
  await chmod(paths.databasePath, 0o600);
  const allocationService = new AllocationService({ registry });
  const diagnosticLog = new DiagnosticLog({
    path: paths.diagnosticLogPath,
    settings: () => registry.getSettings(),
  });

  /** @type {Awaited<ReturnType<typeof startPortreeveServer>> | undefined} */
  let server;
  try {
    server = await startPortreeveServer({
      socketPath: paths.socketPath,
      allocationService,
      dockerAdapter: new DockerCliAdapter({
        executable: process.env.PORTREEVE_DOCKER_EXECUTABLE ?? 'docker',
      }),
      diagnosticLog,
      mode: process.env.PORTREEVE_SUPERVISED === '1' ? 'supervised' : 'manual',
    });
    console.log(`Portreeve ${process.pid} serving on ${paths.socketPath}`);
    const terminate = () => {
      void server?.stop();
    };
    process.once('SIGINT', terminate);
    process.once('SIGTERM', terminate);
    await server.waitUntilStopped();
    process.off('SIGINT', terminate);
    process.off('SIGTERM', terminate);
  } finally {
    await server?.stop();
    registry.close();
  }
}
