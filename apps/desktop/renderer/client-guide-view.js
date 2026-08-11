// @ts-check

import {
  clientGuideSections,
  clientReferenceFilters,
  filterClientReference,
} from './client-guide-model.js';

/**
 * @param {{root: HTMLElement, guideId: 'mcp'|'cli', guide: any, copyText(text: string): Promise<unknown>}} options
 */
export function createClientGuideView(options) {
  const { root, guideId, guide } = options;
  const sections = clientGuideSections(guide.document.blocks);
  const referenceSection = document.createElement('section');
  referenceSection.className = 'client-guide-section client-reference-section';
  referenceSection.id = `${guideId}-searchable-complete-reference`;
  referenceSection.tabIndex = -1;

  const filters = clientReferenceFilters(guide.reference);
  const controls = document.createElement('div');
  controls.className = 'client-reference-controls panel';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = guideId === 'mcp' ? 'Search tools' : 'Search commands';
  search.setAttribute('aria-label', search.placeholder);
  const family = selectFilter('All families', filters.families);
  family.setAttribute('aria-label', 'Filter by family');
  const safety = selectFilter('All safety classes', filters.safety);
  safety.setAttribute('aria-label', 'Filter by safety');
  const count = document.createElement('p');
  count.className = 'client-reference-count';
  count.setAttribute('aria-live', 'polite');
  controls.append(search, family, safety, count);
  const results = document.createElement('div');
  results.className = 'client-reference-results';

  const referenceHeading = document.createElement('h2');
  referenceHeading.textContent = 'Searchable complete reference';
  const referenceIntroduction = document.createElement('p');
  referenceIntroduction.textContent =
    guideId === 'mcp'
      ? 'Every tool registered by this Desktop-bundled MCP contract, including exact input and output schemas.'
      : 'Every executable command in this Desktop-bundled CLI contract, including options, safety, and output behavior.';
  referenceSection.append(referenceHeading, referenceIntroduction, controls, results);

  const renderResults = () => {
    const visible = filterClientReference(guide.reference, {
      query: search.value,
      family: family.value,
      safety: safety.value,
    });
    count.textContent = `${visible.length} of ${guide.reference.length} ${guideId === 'mcp' ? 'tools' : 'commands'}`;
    results.replaceChildren(
      ...(visible.length === 0
        ? [emptyResult(search.value, family.value, safety.value)]
        : visible.map((entry) => referenceEntry(entry, guideId, options.copyText))),
    );
  };
  search.addEventListener('input', renderResults);
  family.addEventListener('change', renderResults);
  safety.addEventListener('change', renderResults);

  root.replaceChildren(
    renderSection(sections['start-here'] ?? [], guideId, options.copyText),
    renderSection(sections['common-workflows'] ?? [], guideId, options.copyText),
    referenceSection,
    renderSection(
      sections['troubleshooting-and-safety'] ?? [],
      guideId,
      options.copyText,
    ),
  );
  renderResults();

  return Object.freeze({
    /** @param {string} anchor */
    focusAnchor(anchor) {
      const id = desktopAnchor(guideId, anchor.replace(/^#/u, ''));
      const target = document.getElementById(id);
      if (target === null) return false;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
      return true;
    },
  });
}

/** @param {any[]} blocks @param {'mcp'|'cli'} guideId @param {(text: string) => Promise<unknown>} copyText */
function renderSection(blocks, guideId, copyText) {
  const section = document.createElement('section');
  section.className = 'client-guide-section';
  section.append(...blocks.map((block) => renderBlock(block, guideId, copyText)));
  return section;
}

/** @param {any} block @param {'mcp'|'cli'} guideId @param {(text: string) => Promise<unknown>} copyText */
function renderBlock(block, guideId, copyText) {
  if (block.type === 'heading') {
    const heading = document.createElement(`h${Math.min(6, block.level)}`);
    heading.id = desktopAnchor(guideId, block.id);
    if (block.level === 2) heading.tabIndex = -1;
    appendInline(heading, block.inline, guideId);
    return heading;
  }
  if (block.type === 'paragraph' || block.type === 'callout') {
    const paragraph = document.createElement('p');
    if (block.type === 'callout') paragraph.className = 'client-guide-callout';
    appendInline(paragraph, block.inline, guideId);
    return paragraph;
  }
  if (block.type === 'code') return codeBlock(block.text, block.language, copyText);
  if (block.type === 'rule') return document.createElement('hr');
  if (block.type === 'list') {
    const list = document.createElement(block.ordered ? 'ol' : 'ul');
    for (const item of block.items) {
      const element = document.createElement('li');
      appendInline(element, item, guideId);
      list.append(element);
    }
    return list;
  }
  if (block.type === 'table') {
    const wrap = document.createElement('div');
    wrap.className = 'client-guide-table';
    const table = document.createElement('table');
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const value of block.header) {
      const cell = document.createElement('th');
      appendInline(cell, value, guideId);
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement('tbody');
    for (const values of block.rows) {
      const row = document.createElement('tr');
      for (const value of values) {
        const cell = document.createElement('td');
        appendInline(cell, value, guideId);
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    wrap.append(table);
    return wrap;
  }
  throw new Error(`Unsupported compiled guide block ${block.type}.`);
}

/** @param {HTMLElement} parent @param {any[]} inline @param {'mcp'|'cli'} guideId */
function appendInline(parent, inline, guideId) {
  for (const node of inline) {
    if (node.type === 'text') parent.append(document.createTextNode(node.text));
    else if (node.type === 'code') {
      const code = document.createElement('code');
      code.textContent = node.text;
      parent.append(code);
    } else if (node.type === 'strong' || node.type === 'emphasis') {
      const element = document.createElement(node.type === 'strong' ? 'strong' : 'em');
      element.textContent = node.text;
      parent.append(element);
    } else if (node.type === 'link') {
      if (!node.href.startsWith('#')) {
        const label = document.createElement('span');
        label.className = 'client-guide-repository-link';
        label.textContent = linkLabel(node.text);
        label.title = 'Available in the repository documentation';
        parent.append(label);
        continue;
      }
      const link = document.createElement('a');
      const id = desktopAnchor(guideId, node.href.slice(1));
      link.href = `#${id}`;
      link.textContent = linkLabel(node.text);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.getElementById(id);
        if (target instanceof HTMLDetailsElement) target.open = true;
        target?.scrollIntoView({ block: 'start' });
        if (target instanceof HTMLElement) target.focus({ preventScroll: true });
      });
      parent.append(link);
    } else throw new Error(`Unsupported inline guide node ${node.type}.`);
  }
}

/** @param {any} entry @param {'mcp'|'cli'} guideId @param {(text: string) => Promise<unknown>} copyText */
function referenceEntry(entry, guideId, copyText) {
  const details = document.createElement('details');
  details.className = 'client-reference-entry';
  details.id = entry.id;
  details.tabIndex = -1;
  const summary = document.createElement('summary');
  const title = document.createElement('strong');
  title.textContent = guideId === 'mcp' ? entry.name : entry.path;
  const description = document.createElement('span');
  description.textContent = entry.description;
  const badges = document.createElement('span');
  badges.className = 'client-reference-badges';
  badges.append(badge(entry.family), badge(entry.safetyLabel ?? entry.safety));
  summary.append(title, description, badges);
  const body = document.createElement('div');
  body.className = 'client-reference-body';
  if (guideId === 'mcp') {
    body.append(
      codeBlock(
        JSON.stringify(entry.inputSchema, null, 2),
        'json',
        copyText,
        'Copy input schema',
      ),
      codeBlock(
        JSON.stringify(entry.outputSchema, null, 2),
        'json',
        copyText,
        'Copy output schema',
      ),
    );
  } else {
    const synopsis = codeBlock(entry.synopsis, 'sh', copyText, 'Copy command');
    body.append(synopsis);
    if (entry.options.length > 0) {
      const list = document.createElement('ul');
      for (const option of entry.options) {
        const item = document.createElement('li');
        item.textContent = `${option.flags} — ${option.description}`;
        list.append(item);
      }
      body.append(list);
    }
    for (const text of entry.environment) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      body.append(paragraph);
    }
  }
  details.append(summary, body);
  return details;
}

/** @param {string} text @param {string|null} language @param {(text: string) => Promise<unknown>} copyText @param {string} [label] */
function codeBlock(text, language, copyText, label = 'Copy') {
  const figure = document.createElement('figure');
  figure.className = 'client-guide-code';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', async () => {
    try {
      await copyText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy failed';
    }
    window.setTimeout(() => (button.textContent = label), 1_500);
  });
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  if (language) code.className = `language-${language}`;
  code.textContent = text;
  pre.append(code);
  figure.append(button, pre);
  return figure;
}

/** @param {string} firstLabel @param {string[]} values */
function selectFilter(firstLabel, values) {
  const select = document.createElement('select');
  const first = document.createElement('option');
  first.value = 'all';
  first.textContent = firstLabel;
  select.append(first);
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.replaceAll('-', ' ');
    select.append(option);
  }
  return select;
}

/** @param {string} query @param {string} family @param {string} safety */
function emptyResult(query, family, safety) {
  const empty = document.createElement('div');
  empty.className = 'panel empty-state';
  const heading = document.createElement('h3');
  heading.textContent = 'No reference entries match';
  const message = document.createElement('p');
  message.textContent = `Try a broader search or clear the ${family !== 'all' || safety !== 'all' ? 'filters' : `term “${query}”`}.`;
  empty.append(heading, message);
  return empty;
}

/** @param {string} text */
function badge(text) {
  const element = document.createElement('span');
  element.className = 'badge';
  element.textContent = text.replaceAll('-', ' ');
  return element;
}

/** @param {'mcp'|'cli'} guideId @param {string} anchor */
function desktopAnchor(guideId, anchor) {
  return /^(mcp-tool|cli-command)-/u.test(anchor) ? anchor : `${guideId}-${anchor}`;
}

/** @param {string} text */
function linkLabel(text) {
  return text.startsWith('`') && text.endsWith('`') ? text.slice(1, -1) : text;
}
