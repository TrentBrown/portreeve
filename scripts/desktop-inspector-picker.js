// @ts-check
/* global document, window, Element, CSS */

/**
 * Install a development-only Option-click element picker inside the renderer. This
 * function must remain self-contained because Playwright serializes it into the page.
 */
export function installDesktopInspectorPicker() {
  if (document.documentElement === null) {
    document.addEventListener('DOMContentLoaded', installDesktopInspectorPicker, {
      once: true,
    });
    return;
  }
  const inspectorWindow = /** @type {Window & {
    __portreeveInspectorInstalled?: boolean,
    __portreeveInspectorSelection?: unknown,
    __portreeveInspectorSelections?: unknown,
    __portreeveInspectorDescribe?: (element: Element) => unknown,
    __portreeveInspectorSelect?: (
      element: Element,
      extend?: boolean,
      report?: boolean
    ) => unknown,
    __portreeveInspectorClear?: (report?: boolean) => unknown,
    __portreeveInspectorReport?: (descriptor: unknown) => Promise<void>
  }} */ (window);
  if (inspectorWindow.__portreeveInspectorInstalled) return;
  inspectorWindow.__portreeveInspectorInstalled = true;

  /** @param {string} value */
  const escape = (value) => CSS.escape(value);

  /** @param {Element} element @param {string} candidate */
  const uniqueSelector = (element, candidate) => {
    try {
      const matches = document.querySelectorAll(candidate);
      return matches.length === 1 && matches[0] === element;
    } catch {
      return false;
    }
  };

  /** @param {Element} element */
  const selectorFor = (element) => {
    if (element.id !== '') {
      const candidate = `#${escape(element.id)}`;
      if (uniqueSelector(element, candidate)) return candidate;
    }
    for (const attribute of [
      'data-view',
      'data-action',
      'data-guide-view',
      'data-field',
      'name',
      'aria-label',
    ]) {
      const value = element.getAttribute(attribute);
      if (value === null || value === '') continue;
      const candidate = `${element.tagName.toLowerCase()}[${attribute}="${escape(value)}"]`;
      if (uniqueSelector(element, candidate)) return candidate;
    }

    const parts = [];
    /** @type {Element | null} */
    let current = element;
    while (current !== null && current !== document.documentElement) {
      /** @type {Element} */
      const elementAtPath = current;
      let part = elementAtPath.tagName.toLowerCase();
      /** @type {Element | null} */
      const parent = elementAtPath.parentElement;
      if (parent !== null) {
        const siblings = Array.from(parent.children).filter(
          (candidate) => candidate.tagName === elementAtPath.tagName,
        );
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(elementAtPath) + 1})`;
        }
      }
      parts.unshift(part);
      const candidate = parts.join(' > ');
      if (uniqueSelector(element, candidate)) return candidate;
      current = parent;
    }
    return parts.join(' > ');
  };

  /** @param {Element} element @param {string} [selectedAt] */
  const describe = (element, selectedAt = new Date().toISOString()) => {
    const style = window.getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    const text = (element.textContent ?? '').replace(/\s+/gu, ' ').trim();
    return {
      schemaVersion: 1,
      selectedAt,
      selector: selectorFor(element),
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      classes: Array.from(element.classList),
      text: text.length > 240 ? `${text.slice(0, 237)}...` : text,
      attributes: Object.fromEntries(
        Array.from(element.attributes).map(({ name, value }) => [name, value]),
      ),
      rectangle: {
        x: Math.round(rectangle.x * 100) / 100,
        y: Math.round(rectangle.y * 100) / 100,
        width: Math.round(rectangle.width * 100) / 100,
        height: Math.round(rectangle.height * 100) / 100,
      },
      styles: {
        display: style.display,
        position: style.position,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        margin: style.margin,
        padding: style.padding,
        border: style.border,
        borderRadius: style.borderRadius,
        gap: style.gap,
        gridTemplateColumns: style.gridTemplateColumns,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
      },
      ancestors: Array.from(
        /** @type {Element[]} */ (
          (() => {
            const ancestors = [];
            let current = element.parentElement;
            while (current !== null && ancestors.length < 6) {
              ancestors.push(current);
              current = current.parentElement;
            }
            return ancestors;
          })()
        ),
      ).map((ancestor) => ({
        tag: ancestor.tagName.toLowerCase(),
        id: ancestor.id || null,
        classes: Array.from(ancestor.classList),
      })),
    };
  };
  inspectorWindow.__portreeveInspectorDescribe = describe;

  const status = document.createElement('div');
  status.setAttribute('data-portreeve-inspector-ui', 'status');
  status.textContent =
    'Inspector ready · Option-click selects · Shift-Option-click extends · Normal clicks are live';
  Object.assign(status.style, {
    position: 'fixed',
    zIndex: '2147483647',
    right: '12px',
    bottom: '12px',
    maxWidth: 'min(520px, calc(100vw - 24px))',
    padding: '7px 10px',
    border: '1px solid rgb(255 255 255 / 55%)',
    borderRadius: '7px',
    background: '#102a43',
    color: '#fffdf8',
    font: '600 12px/1.4 system-ui, sans-serif',
    boxShadow: '0 5px 18px rgb(16 42 67 / 25%)',
    pointerEvents: 'none',
  });
  document.documentElement.append(status);

  const selectionLimit = 10;
  /** @type {Array<{element: Element, selectedAt: string}>} */
  const selections = [];
  /** @type {Array<{box: HTMLDivElement, badge: HTMLSpanElement}>} */
  const highlights = [];

  const createHighlight = () => {
    const box = document.createElement('div');
    box.setAttribute('data-portreeve-inspector-ui', 'highlight');
    Object.assign(box.style, {
      position: 'fixed',
      zIndex: '2147483646',
      display: 'none',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      border: '2px solid #d9782d',
      background: 'rgb(217 120 45 / 12%)',
      boxShadow: '0 0 0 1px rgb(255 255 255 / 85%)',
    });
    const badge = document.createElement('span');
    badge.setAttribute('data-portreeve-inspector-ui', 'selection-number');
    Object.assign(badge.style, {
      position: 'absolute',
      top: '-11px',
      left: '-11px',
      minWidth: '20px',
      height: '20px',
      padding: '0 5px',
      border: '1px solid rgb(255 255 255 / 90%)',
      borderRadius: '999px',
      background: '#d9782d',
      color: '#fffdf8',
      font: '700 11px/18px system-ui, sans-serif',
      textAlign: 'center',
      boxSizing: 'border-box',
      boxShadow: '0 2px 7px rgb(16 42 67 / 28%)',
    });
    box.append(badge);
    document.documentElement.append(box);
    return { box, badge };
  };

  const selectionSnapshot = () => ({
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    selectionLimit,
    selections: selections.map(({ element, selectedAt }, index) => ({
      selectionNumber: index + 1,
      ...describe(element, selectedAt),
    })),
  });

  /** @param {string} [message] */
  const updateStatus = (message) => {
    if (message !== undefined) {
      status.textContent = `${message} · Normal clicks are live`;
      return;
    }
    if (selections.length === 0) {
      status.textContent =
        'Inspector ready · Option-click selects · Shift-Option-click extends · Normal clicks are live';
      return;
    }
    if (selections.length === 1) {
      const onlySelection = selections[0];
      if (onlySelection === undefined) return;
      status.textContent = `Selected 1 · ${selectorFor(onlySelection.element)} · Shift-Option-click extends · Normal clicks are live`;
      return;
    }
    status.textContent = `Selected ${selections.length} · Shift-Option-click toggles membership · Normal clicks are live`;
  };

  const positionHighlights = () => {
    while (highlights.length < selections.length) highlights.push(createHighlight());
    while (highlights.length > selections.length) highlights.pop()?.box.remove();
    for (const [index, selection] of selections.entries()) {
      const highlight = highlights[index];
      if (highlight === undefined) continue;
      if (!selection.element.isConnected) {
        highlight.box.style.display = 'none';
        continue;
      }
      const rectangle = selection.element.getBoundingClientRect();
      highlight.badge.textContent = String(index + 1);
      Object.assign(highlight.box.style, {
        display: 'block',
        left: `${rectangle.left}px`,
        top: `${rectangle.top}px`,
        width: `${rectangle.width}px`,
        height: `${rectangle.height}px`,
      });
    }
  };

  /** @param {ReturnType<typeof selectionSnapshot>} snapshot @param {boolean} report */
  const publishSelection = (snapshot, report) => {
    inspectorWindow.__portreeveInspectorSelections = snapshot;
    inspectorWindow.__portreeveInspectorSelection = snapshot.selections.at(-1) ?? null;
    if (report) void inspectorWindow.__portreeveInspectorReport?.(snapshot);
    return snapshot;
  };

  /**
   * @param {Element} element
   * @param {boolean} [extend]
   * @param {boolean} [report]
   */
  const selectElement = (element, extend = false, report = true) => {
    for (let index = selections.length - 1; index >= 0; index -= 1) {
      const selection = selections[index];
      if (selection !== undefined && !selection.element.isConnected) {
        selections.splice(index, 1);
      }
    }
    const existingIndex = selections.findIndex(
      (selection) => selection.element === element,
    );
    if (extend) {
      if (existingIndex >= 0) {
        selections.splice(existingIndex, 1);
      } else if (selections.length >= selectionLimit) {
        updateStatus(`Selection limit of ${selectionLimit} reached`);
        return selectionSnapshot();
      } else {
        selections.push({ element, selectedAt: new Date().toISOString() });
      }
    } else {
      selections.splice(0, selections.length, {
        element,
        selectedAt: new Date().toISOString(),
      });
    }
    const snapshot = selectionSnapshot();
    updateStatus();
    positionHighlights();
    return publishSelection(snapshot, report);
  };
  inspectorWindow.__portreeveInspectorSelect = selectElement;

  /** @param {boolean} [report] */
  const clearSelection = (report = true) => {
    selections.splice(0);
    const snapshot = selectionSnapshot();
    updateStatus();
    positionHighlights();
    return publishSelection(snapshot, report);
  };
  inspectorWindow.__portreeveInspectorClear = clearSelection;

  /** @param {PointerEvent} event */
  const select = (event) => {
    if (!event.altKey) return;
    const element = event
      .composedPath()
      .find(
        (candidate) =>
          candidate instanceof Element &&
          !candidate.hasAttribute('data-portreeve-inspector-ui'),
      );
    if (!(element instanceof Element)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectElement(element, event.shiftKey);
  };

  /** @param {MouseEvent} event */
  const suppressClick = (event) => {
    if (!event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  document.addEventListener('pointerdown', select, true);
  document.addEventListener('click', suppressClick, true);
  window.addEventListener('resize', positionHighlights);
  document.addEventListener('scroll', positionHighlights, true);
}
