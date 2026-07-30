// @ts-check

import { Database } from 'bun:sqlite';
import { chmod, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import embeddedAsset from './compiled-runtime.txt';

const runtimeDirectory = await mkdtemp(join(tmpdir(), 'portreeve-runtime-'));
const socketPath = join(runtimeDirectory, 'portreeve.sock');
const database = new Database(':memory:');
const tcpProbeServer = Bun.serve({
  port: 0,
  fetch() {
    return new Response('runtime-probe');
  },
});

try {
  database.run('CREATE TABLE spike (value TEXT NOT NULL)');
  database.run('INSERT INTO spike (value) VALUES (?)', ['sqlite-ok']);

  const lsof = Bun.spawn(
    ['lsof', '-nP', '-a', '-p', String(process.pid), '-iTCP', '-sTCP:LISTEN', '-Fpcn'],
    {
      stderr: 'pipe',
      stdout: 'pipe',
    },
  );
  const lsofExitCode = await lsof.exited;
  const lsofOutput = await new Response(lsof.stdout).text();

  const signalProbe = Bun.spawn(['sleep', '30']);
  signalProbe.kill('SIGTERM');
  const signalExitCode = await signalProbe.exited;

  const server = Bun.serve({
    unix: socketPath,
    fetch() {
      const row = database.query('SELECT value FROM spike LIMIT 1').get();
      return Response.json(row);
    },
  });

  try {
    await chmod(socketPath, 0o600);
    const response = await fetch('http://portreeve/health', {
      unix: socketPath,
    });
    const body = await response.json();
    const socketMode = (await stat(socketPath)).mode & 0o777;

    console.log(
      JSON.stringify({
        ambientDotenvLoaded: process.env.PORTREEVE_SPIKE_AMBIENT === 'loaded',
        body,
        embeddedAsset: embeddedAsset.trim(),
        lsofExitCode,
        lsofFoundListener: lsofOutput.includes(`:${tcpProbeServer.port}`),
        signalExitCode,
        socketMode,
      }),
    );
  } finally {
    server.stop(true);
  }
} finally {
  tcpProbeServer.stop(true);
  database.close();
  await rm(runtimeDirectory, { force: true, recursive: true });
}
