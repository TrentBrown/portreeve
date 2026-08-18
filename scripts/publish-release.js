// @ts-check

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCommandPublicationAdapters } from './publication-adapters.js';
import { createPublicationPlan, renderPublicationPlan } from './publication-plan.js';
import { sha256File } from './release-lib.js';
import {
  advanceReleaseRecord,
  readReleaseRecord,
  verifyReleaseArtifacts,
  writeReleaseRecord,
} from './release-record.js';

const PUBLICATION_TRANSPORT = 'github-pull-request-v1';

/**
 * @typedef {{
 *   preflight(plan: ReturnType<typeof createPublicationPlan>, releaseRoot: string): Promise<void>,
 *   publish(plan: ReturnType<typeof createPublicationPlan>, releaseRoot: string, context: {planSha256: string}): Promise<Record<string, string>>,
 * }} PublicationAdapter
 */

/**
 * @param {{recordPath: string, confirm: boolean, approvedBy: string, now?: () => Date}} options
 * @param {{github: PublicationAdapter, homebrew: PublicationAdapter, desktopUpdate: PublicationAdapter}} adapters
 */
export async function publishPreparedRelease(options, adapters) {
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  let record = await readReleaseRecord(recordPath);
  if (!['prepared', 'publication-approved'].includes(record.state)) {
    throw new Error('Publication requires a finalized prepared release record.');
  }
  await verifyReleaseArtifacts(record, releaseRoot);
  const plan = createPublicationPlanForState(record);
  const planPath = resolve(releaseRoot, 'publication-plan.md');
  const expectedPlan = renderPublicationPlan(plan);
  if ((await readFile(planPath, 'utf8')) !== expectedPlan) {
    throw new Error('Publication plan does not match the finalized release record.');
  }
  const planSha256 = await sha256File(planPath);
  if (!options.confirm) {
    throw new Error(
      `Publication requires --confirm after reviewing ${planPath} (${planSha256}).`,
    );
  }
  if (options.approvedBy.trim() === '') {
    throw new Error('Publication requires a non-empty approver identity.');
  }

  await adapters.github.preflight(plan, releaseRoot);
  await adapters.homebrew.preflight(plan, releaseRoot);
  await adapters.desktopUpdate.preflight(plan, releaseRoot);

  if (record.state === 'prepared') {
    const now = options.now ?? (() => new Date());
    record = advanceReleaseRecord(
      record,
      'publication-approved',
      {
        approvedBy: options.approvedBy,
        approvedAt: now().toISOString(),
        planSha256,
        transport: PUBLICATION_TRANSPORT,
      },
      now,
    );
    await writeReleaseRecord(recordPath, record);
  } else {
    if (record.publication.planSha256 !== planSha256) {
      throw new Error('Recorded publication approval does not match this exact plan.');
    }
    if (record.publication.transport !== PUBLICATION_TRANSPORT) {
      throw new Error(
        'Legacy publication approval cannot be resumed through PR transport; prepare a new release candidate.',
      );
    }
  }

  const publicationContext = { planSha256 };
  const github = await adapters.github.publish(plan, releaseRoot, publicationContext);
  const githubReleaseUrl = requiredResult(github, 'url', 'GitHub release URL');
  const homebrew = await adapters.homebrew.publish(
    plan,
    releaseRoot,
    publicationContext,
  );
  const homebrewPullRequestUrl = requiredResult(
    homebrew,
    'pullRequestUrl',
    'Homebrew pull request URL',
  );
  const homebrewCommit = requiredResult(homebrew, 'commit', 'Homebrew tap commit');
  const desktopUpdate = await adapters.desktopUpdate.publish(
    plan,
    releaseRoot,
    publicationContext,
  );
  const desktopUpdatePullRequestUrl = requiredResult(
    desktopUpdate,
    'pullRequestUrl',
    'Desktop update pull request URL',
  );
  const desktopUpdateCommit = requiredResult(
    desktopUpdate,
    'commit',
    'Desktop update commit',
  );
  const now = options.now ?? (() => new Date());
  record = advanceReleaseRecord(
    record,
    'published',
    {
      tag: plan.tag,
      githubReleaseUrl,
      transport: PUBLICATION_TRANSPORT,
      homebrewPullRequestUrl,
      homebrewCommit,
      desktopUpdatePullRequestUrl,
      desktopUpdateCommit,
      publishedAt: now().toISOString(),
    },
    now,
  );
  await writeReleaseRecord(recordPath, record);
  return { recordPath, record, planSha256 };
}

/** @param {{record: Record<string, any>, planSha256: string}} result */
export function createPublicationCompletion(result) {
  if (
    result.record.state !== 'published' ||
    result.record.publication?.transport !== PUBLICATION_TRANSPORT
  ) {
    throw new Error('Publication completion requires a PR-published release record.');
  }
  return {
    schemaVersion: 2,
    releaseId: result.record.releaseId,
    planSha256: result.planSha256,
    publication: result.record.publication,
  };
}

/** @param {Record<string, any>} record */
function createPublicationPlanForState(record) {
  if (record.state === 'prepared') return createPublicationPlan(record);
  const planningRecord = structuredClone(record);
  planningRecord.stages = planningRecord.stages.slice(0, -1);
  planningRecord.state = 'prepared';
  planningRecord.publication = { state: 'unpublished' };
  return createPublicationPlan(planningRecord);
}

/** @param {Record<string, string>} value @param {string} key @param {string} label */
function requiredResult(value, key, label) {
  const result = value[key];
  if (typeof result !== 'string' || result.trim() === '') {
    throw new Error(`${label} is missing from the publication adapter result.`);
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:publish')
    .description('Publish one approved prepared release without rebuilding')
    .requiredOption('--record <path>', 'finalized release-record.json path')
    .requiredOption('--approved-by <identity>', 'human publication approver')
    .option('--confirm', 'confirm the exact publication plan', false)
    .action(async (values) => {
      const result = await publishPreparedRelease(
        {
          recordPath: values.record,
          confirm: values.confirm,
          approvedBy: values.approvedBy,
        },
        createCommandPublicationAdapters(),
      );
      await writeFile(
        resolve(dirname(result.recordPath), 'publication-complete.json'),
        JSON.stringify(createPublicationCompletion(result), null, 2).concat('\n'),
        { encoding: 'utf8', flag: 'wx' },
      );
      console.log(result.recordPath);
    });
  await program.parseAsync();
}
