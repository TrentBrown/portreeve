// @ts-check

import { expect, test } from 'bun:test';
import {
  assertDesktopModuleGraph,
  assertDesktopPackageIdentity,
  assertPackagedDesktopContents,
} from '../../scripts/desktop-package-lib.js';
import { verifyDesktopRuntimeContract } from './runtime-contract.js';

test('requires exact controller and artifact identity before packaging', () => {
  expect(() => assertDesktopPackageIdentity('0.1.0', '0.1.0')).not.toThrow();
  expect(() => assertDesktopPackageIdentity('0.1.0', '0.2.0')).toThrow(
    'does not match release artifact',
  );
});

test('requires the direct lifecycle module graph and excludes the retired CLI adapter', () => {
  const inputs = [
    'apps/desktop/main/artifact.js',
    'apps/desktop/main/lifecycle-controller.js',
    'apps/desktop/main/mcp-setup-adapter.js',
    'src/mcp/setup.js',
    'src/supervision/service.js',
  ];
  expect(() => assertDesktopModuleGraph(inputs)).not.toThrow();
  expect(() =>
    assertDesktopModuleGraph([...inputs, 'apps/desktop/main/cli-adapter.js']),
  ).toThrow('retired lifecycle CLI adapter');
});

test('inspects packaged identity, direct-controller markers, and retired adapter markers', () => {
  const valid = {
    packageDocument: JSON.stringify({
      version: '0.1.0',
      main: 'main/index.js',
      portreeveReleaseChannel: 'preview',
    }),
    verificationDocument: JSON.stringify({
      schemaVersion: 1,
      controllerVersion: '0.1.0',
      artifactVersion: '0.1.0',
      artifactSha256: 'a'.repeat(64),
      architecture: 'arm64',
      releaseChannel: 'preview',
      moduleGraph: {
        directLifecycleController: true,
        verifiedArtifactResolver: true,
        mcpSetupGenerator: true,
        lifecycleCliAdapter: false,
      },
    }),
    mainBundle:
      'controller_artifact_version_mismatch generateMcpSetup portreeve:desktop:generate-mcp-setup sourceExecutable PORTREEVE_DESKTOP_SMOKE',
    preloadBundle:
      'portreeve:desktop:generate-mcp-setup generateMcpSetup requireMcpSetup',
    rendererDocument:
      '<button data-view="mcp">MCP</button><button data-view="cli">CLI</button><form id="mcp-setup-form"><pre id="mcp-configuration"></pre></form><div id="mcp-guide-content"></div><div id="cli-guide-content"></div>',
    rendererBundle:
      "import guides from './generated/client-guides.js'; createClientGuideView(guides); clientInstallationEvidence(snapshot);",
    guideViewBundle: 'document.createElement("section");',
    guideBundleDocument:
      "export const CLIENT_GUIDES_ATTESTATION = Object.freeze({ schemaVersion: 1, generatedForVersion: '0.1.0', cliCommands: 49, mcpTools: 51 }); export default {};",
    controllerVersion: '0.1.0',
    artifactVersion: '0.1.0',
    artifactSha256: 'a'.repeat(64),
    architecture: /** @type {const} */ ('arm64'),
  };
  expect(() => assertPackagedDesktopContents(valid)).not.toThrow();
  expect(() =>
    assertPackagedDesktopContents({
      ...valid,
      mainBundle: `${valid.mainBundle} invalid_lifecycle_json`,
    }),
  ).toThrow('retired CLI adapter marker');
  expect(() =>
    assertPackagedDesktopContents({
      ...valid,
      artifactVersion: '0.2.0',
    }),
  ).toThrow('identity attestation is invalid');
  expect(() =>
    assertPackagedDesktopContents({
      ...valid,
      artifactSha256: 'b'.repeat(64),
    }),
  ).toThrow('identity attestation is invalid');
  expect(() =>
    assertPackagedDesktopContents({
      ...valid,
      guideBundleDocument:
        "export const CLIENT_GUIDES_ATTESTATION = Object.freeze({ schemaVersion: 1, generatedForVersion: '0.0.9', cliCommands: 0, mcpTools: 0 }); export default {};",
    }),
  ).toThrow('client guide bundle is invalid or stale');
  expect(() =>
    assertPackagedDesktopContents({
      ...valid,
      guideViewBundle: 'fetch("https://example.com/guide")',
    }),
  ).toThrow('guide runtime contains prohibited marker fetch(');
});

test('runs the direct-controller contract in the Bun test runtime', async () => {
  expect(await verifyDesktopRuntimeContract()).toMatchObject({
    schemaVersion: 1,
    runtime: 'bun-1.3.14',
    controllerVersion: '0.1.0',
    operations: 8,
  });
});

test('keeps packaged smoke read-only and ahead of mutable Desktop authority', async () => {
  const source = await Bun.file('apps/desktop/main/index.js').text();
  const smoke = source.indexOf('if (desktopSmoke)');
  expect(smoke).toBeGreaterThan(source.indexOf('createDesktopLifecycleController'));
  expect(smoke).toBeLessThan(source.indexOf('new PortreeveClient'));
  const branch = source.slice(smoke, source.indexOf('const client ='));
  expect(branch).toContain('lifecycle.status()');
  for (const mutation of [
    '.install(',
    '.start(',
    '.stop(',
    '.restart(',
    '.uninstall(',
    '.executePurge(',
  ]) {
    expect(branch).not.toContain(mutation);
  }
});
