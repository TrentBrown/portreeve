#!/usr/bin/env node
// @ts-check
/* global window */

import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDesktopInspectorPicker } from './desktop-inspector-picker.js';

const require = createRequire(import.meta.url);
const electronExecutable = /** @type {string} */ (require('electron'));
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(
  process.env.PORTREEVE_DESKTOP_INSPECTOR_OUTPUT ??
    join(tmpdir(), 'portreeve-desktop-inspector'),
);
await mkdir(outputRoot, { recursive: true });
const userDataPath = await mkdtemp(join(outputRoot, 'profile-'));
const selectionPath = join(outputRoot, 'selection.json');
const screenshotPath = join(outputRoot, 'window.png');
await rm(selectionPath, { force: true });

const electronApp = await electron.launch({
  executablePath: electronExecutable,
  args: ['apps/desktop'],
  cwd: workspaceRoot,
  env: {
    ...process.env,
    PORTREEVE_DESKTOP_INSPECTOR: '1',
    PORTREEVE_DESKTOP_INSPECTOR_USER_DATA: userDataPath,
  },
});
const page = await electronApp.firstWindow();

/** @param {unknown} selectionSet @param {boolean} [announce] */
async function recordSelection(selectionSet, announce = true) {
  const temporaryPath = `${selectionPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(selectionSet, null, 2)}\n`);
  await rename(temporaryPath, selectionPath);
  if (announce) {
    console.log(`\nSelected elements:\n${JSON.stringify(selectionSet, null, 2)}`);
  }
}

await page.exposeBinding('__portreeveInspectorReport', (_source, descriptor) =>
  recordSelection(descriptor),
);
await page.addInitScript(installDesktopInspectorPicker);
await page.evaluate(installDesktopInspectorPicker);

console.log(`PortReeve Desktop inspector is ready at ${page.url()}.`);
console.log('Option-click replaces the selection without activating the element.');
console.log('Shift-Option-click adds or removes an element from the selection.');
console.log(
  'Normal clicks use the live PortReeve service and can perform real actions.',
);
console.log(`Latest selection set: ${selectionPath}`);
console.log('Commands: snapshot, selected, select <selector>, add <selector>, clear,');
console.log(
  '          click <selector>, hover <selector>, screenshot, reload, help, quit',
);

const input = createInterface({ input: process.stdin, output: process.stdout });
input.setPrompt('portreeve-inspector> ');
input.prompt();

/** @param {string} selector */
async function locatorDescriptor(selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'attached' });
  return locator.evaluate((element) => {
    const inspectorWindow = /** @type {Window & {
      __portreeveInspectorDescribe?: (element: Element) => unknown
    }} */ (window);
    if (inspectorWindow.__portreeveInspectorDescribe === undefined) {
      throw new Error('The PortReeve inspector picker is unavailable.');
    }
    return inspectorWindow.__portreeveInspectorDescribe(element);
  });
}

/** @param {string} selector @param {boolean} extend */
async function selectLocator(selector, extend) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, extendSelection) => {
      const inspectorWindow = /** @type {Window & {
          __portreeveInspectorSelect?: (
            element: Element,
            extend?: boolean,
            report?: boolean
          ) => unknown
        }} */ (window);
      if (inspectorWindow.__portreeveInspectorSelect === undefined) {
        throw new Error('The PortReeve inspector picker is unavailable.');
      }
      return inspectorWindow.__portreeveInspectorSelect(
        element,
        extendSelection,
        false,
      );
    }, extend);
}

/** @param {string} line */
async function runCommand(line) {
  const trimmed = line.trim();
  const separator = trimmed.indexOf(' ');
  const command = separator === -1 ? trimmed : trimmed.slice(0, separator);
  const argument = separator === -1 ? '' : trimmed.slice(separator + 1).trim();
  switch (command) {
    case '':
      return;
    case 'snapshot':
      console.log(await page.locator('body').ariaSnapshot());
      return;
    case 'selected':
      try {
        console.log(await readFile(selectionPath, 'utf8'));
      } catch (error) {
        if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
          console.log('No elements have been selected yet.');
          return;
        }
        throw error;
      }
      return;
    case 'select':
      if (argument === '') throw new Error('select requires a CSS selector.');
      await recordSelection(await selectLocator(argument, false), false);
      console.log(`Selected ${argument}`);
      return;
    case 'add':
      if (argument === '') throw new Error('add requires a CSS selector.');
      await recordSelection(await selectLocator(argument, true), false);
      console.log(`Toggled ${argument} in the selection`);
      return;
    case 'clear':
      if (argument !== '') throw new Error('clear does not accept an argument.');
      await recordSelection(
        await page.evaluate(() => {
          const inspectorWindow = /** @type {Window & {
            __portreeveInspectorClear?: (report?: boolean) => unknown
          }} */ (window);
          if (inspectorWindow.__portreeveInspectorClear === undefined) {
            throw new Error('The PortReeve inspector picker is unavailable.');
          }
          return inspectorWindow.__portreeveInspectorClear(false);
        }),
        false,
      );
      console.log('Cleared the selection');
      return;
    case 'inspect':
      if (argument === '') throw new Error('inspect requires a CSS selector.');
      console.log(JSON.stringify(await locatorDescriptor(argument), null, 2));
      return;
    case 'click':
      if (argument === '') throw new Error('click requires a CSS selector.');
      await page.locator(argument).first().click();
      console.log(`Clicked ${argument}`);
      return;
    case 'hover':
      if (argument === '') throw new Error('hover requires a CSS selector.');
      await page.locator(argument).first().hover();
      console.log(`Hovered ${argument}`);
      return;
    case 'screenshot':
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved ${screenshotPath}`);
      return;
    case 'reload':
      await page.reload();
      console.log(`Reloaded ${page.url()}`);
      return;
    case 'help':
      console.log('Option-click replaces the selection without activating it.');
      console.log('Shift-Option-click adds or removes an element.');
      console.log('snapshot                    print the accessibility snapshot');
      console.log('selected                    print the ordered selection set');
      console.log('select <selector>           replace the selection with first match');
      console.log('add <selector>              toggle first match in the selection');
      console.log('clear                       clear the selection');
      console.log(
        'inspect <selector>          print DOM, box, and computed-style data',
      );
      console.log('click <selector>            click the first matching element');
      console.log('hover <selector>            hover the first matching element');
      console.log('screenshot                  save a full-page screenshot');
      console.log('reload                      reload source renderer files');
      console.log('quit                        close the inspector and Desktop app');
      return;
    case 'quit':
    case 'exit':
      await closeInspector();
      return;
    default:
      throw new Error(`Unknown inspector command: ${command}`);
  }
}

let closing = false;
async function closeInspector() {
  if (closing) return;
  closing = true;
  input.close();
  await electronApp.close().catch(() => {});
}

/** @type {Promise<void>} */
let commandQueue = Promise.resolve();
input.on('line', (line) => {
  commandQueue = commandQueue
    .then(() => runCommand(line))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      if (!closing) input.prompt();
    });
});
input.on('SIGINT', () => void closeInspector());
process.on('SIGTERM', () => void closeInspector());

await new Promise((resolveClose) => electronApp.process().once('exit', resolveClose));
input.close();
await rm(userDataPath, { recursive: true, force: true });
console.log('PortReeve Desktop inspector closed.');
