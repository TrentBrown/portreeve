// @ts-check

import { z } from 'zod';

export const ProcessFingerprintSchema = z.object({
  pid: z.number().int().positive(),
  parentPid: z.number().int().nonnegative(),
  uid: z.number().int().nonnegative(),
  startTime: z.iso.datetime({ offset: true }),
  executable: z.string().min(1),
  command: z.string().min(1),
  workingDirectory: z.string().min(1),
});

/**
 * @param {number} pid
 */
export async function inspectProcess(pid) {
  const parsedPid = z.number().int().positive().parse(pid);
  const child = Bun.spawn(
    ['ps', '-p', String(parsedPid), '-o', 'ppid=,uid=,lstart=,comm='],
    {
      env: { ...process.env, LC_ALL: 'C' },
      stderr: 'pipe',
      stdout: 'pipe',
    },
  );
  const exitCode = await child.exited;
  const output = await new Response(child.stdout).text();
  if (exitCode === 1 || output.trim() === '') {
    return null;
  }
  if (exitCode !== 0) {
    const error = await new Response(child.stderr).text();
    throw new Error(`ps failed for PID ${parsedPid}: ${error.trim()}`);
  }

  const metadata = parsePsProcess(output);
  const files = await inspectProcessFiles(parsedPid);
  if (files.executable === null || files.workingDirectory === null) {
    return null;
  }

  return ProcessFingerprintSchema.parse({
    pid: parsedPid,
    parentPid: metadata.parentPid,
    uid: metadata.uid,
    startTime: metadata.startTime,
    executable: files.executable,
    command: metadata.command,
    workingDirectory: files.workingDirectory,
  });
}

/**
 * @param {string} output
 */
export function parsePsProcess(output) {
  const match = output
    .trim()
    .match(
      /^(\d+)\s+(\d+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$/,
    );
  if (match === null) {
    throw new Error(`Unexpected ps process output: ${output.trim()}`);
  }
  const startTime = new Date(match[3] ?? '');
  if (Number.isNaN(startTime.getTime())) {
    throw new Error(`Invalid process start time: ${match[3]}`);
  }

  return {
    parentPid: Number.parseInt(match[1] ?? '', 10),
    uid: Number.parseInt(match[2] ?? '', 10),
    startTime: startTime.toISOString(),
    command: match[4] ?? '',
  };
}

/**
 * @param {number} pid
 */
async function inspectProcessFiles(pid) {
  const child = Bun.spawn(['lsof', '-a', '-p', String(pid), '-d', 'cwd,txt', '-Ffn'], {
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const exitCode = await child.exited;
  const output = await new Response(child.stdout).text();
  if (exitCode === 1) {
    return { executable: null, workingDirectory: null };
  }
  if (exitCode !== 0) {
    const error = await new Response(child.stderr).text();
    throw new Error(`lsof process inspection failed for PID ${pid}: ${error.trim()}`);
  }

  let field = '';
  let executable = null;
  let workingDirectory = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('f')) {
      field = line.slice(1);
    } else if (line.startsWith('n')) {
      if (field === 'cwd') {
        workingDirectory = line.slice(1);
      } else if (field === 'txt' && executable === null) {
        executable = line.slice(1);
      }
    }
  }
  return { executable, workingDirectory };
}

/**
 * @param {unknown} left
 * @param {unknown} right
 */
export function sameProcessInstance(left, right) {
  const first = ProcessFingerprintSchema.safeParse(left);
  const second = ProcessFingerprintSchema.safeParse(right);
  return (
    first.success &&
    second.success &&
    first.data.pid === second.data.pid &&
    first.data.startTime === second.data.startTime &&
    first.data.executable === second.data.executable &&
    first.data.uid === second.data.uid
  );
}

/**
 * @param {unknown} listenerFingerprint
 * @param {unknown} rootFingerprint
 * @param {(pid: number) => Promise<import('zod').infer<typeof ProcessFingerprintSchema> | null>} [inspect]
 */
export async function verifyProcessLineage(
  listenerFingerprint,
  rootFingerprint,
  inspect = inspectProcess,
) {
  const listener = ProcessFingerprintSchema.parse(listenerFingerprint);
  const root = ProcessFingerprintSchema.parse(rootFingerprint);
  const freshRoot = await inspect(root.pid);
  if (freshRoot === null || !sameProcessInstance(freshRoot, root)) {
    return { verified: false, reason: 'root-process-changed', lineage: [] };
  }

  /** @type {number[]} */
  const lineage = [];
  let current = listener;
  for (let depth = 0; depth < 64; depth += 1) {
    lineage.push(current.pid);
    if (sameProcessInstance(current, root)) {
      return { verified: true, reason: 'verified', lineage };
    }
    if (current.parentPid <= 1 || lineage.includes(current.parentPid)) {
      break;
    }
    const parent = await inspect(current.parentPid);
    if (parent === null) {
      break;
    }
    current = parent;
  }

  return { verified: false, reason: 'not-in-run-lineage', lineage };
}
