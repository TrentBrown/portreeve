// @ts-check

import { expect, test } from 'bun:test';
import {
  clientGuideSections,
  clientInstallationEvidence,
  clientReferenceFilters,
  filterClientReference,
} from '../../apps/desktop/renderer/client-guide-model.js';

const reference = [
  {
    name: 'portreeve_ports_list',
    description: 'List ports',
    family: 'ports',
    safety: 'read-only',
  },
  {
    name: 'portreeve_port_reclaim_execute',
    description: 'Execute reclaim',
    family: 'ports',
    safety: 'consequential-mutation',
  },
  {
    name: 'portreeve_health',
    description: 'Read health',
    family: 'diagnostics',
    safety: 'read-only',
  },
];

test('filters complete client reference by text, family, and safety', () => {
  expect(filterClientReference(reference, { query: 'reclaim' })).toHaveLength(1);
  expect(filterClientReference(reference, { family: 'ports' })).toHaveLength(2);
  expect(filterClientReference(reference, { safety: 'read-only' })).toHaveLength(2);
  expect(
    filterClientReference(reference, {
      query: 'port',
      family: 'ports',
      safety: 'consequential-mutation',
    }),
  ).toEqual([reference[1]]);
  expect(clientReferenceFilters(reference)).toEqual({
    families: ['diagnostics', 'ports'],
    safety: ['consequential-mutation', 'read-only'],
  });
});

test('groups only the approved authored sections', () => {
  const blocks = [
    { type: 'heading', level: 1, id: 'guide' },
    { type: 'heading', level: 2, id: 'start-here' },
    { type: 'paragraph', value: 'start' },
    { type: 'heading', level: 2, id: 'common-workflows' },
    { type: 'paragraph', value: 'work' },
    { type: 'heading', level: 2, id: 'troubleshooting-and-safety' },
    { type: 'paragraph', value: 'safe' },
  ];
  const sections = clientGuideSections(blocks);
  expect(sections['start-here']).toHaveLength(2);
  expect(sections['common-workflows']).toHaveLength(2);
  expect(sections['troubleshooting-and-safety']).toHaveLength(2);
});

test('keeps bundled, managed, running, compatibility, freshness, and mismatch distinct', () => {
  const evidence = clientInstallationEvidence({
    stale: true,
    artifact: { version: '0.2.0', bundledLocation: '/bundle/portreeve' },
    lifecycle: {
      mode: 'supervised',
      installation: { managedLocation: '/managed/portreeve' },
      socket: { state: 'healthy' },
      versions: { managed: '0.1.0', running: '0.1.0' },
    },
  });
  expect(evidence).toEqual({
    evidence: 'stale',
    bundledVersion: '0.2.0',
    bundledLocation: '/bundle/portreeve',
    managedVersion: '0.1.0',
    managedLocation: '/managed/portreeve',
    runningVersion: '0.1.0',
    mode: 'supervised',
    socket: 'healthy',
    versionMismatch: true,
    compatibility: 'compatible',
  });
});
