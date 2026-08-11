// @ts-check
/* global document, window, Element, CSS */

/**
 * Install a development-only Option-click element picker inside the renderer. This
 * function must remain self-contained because Playwright serializes it into the page.
 */
export function installDesktopInspectorPicker() {
  const inspectorWindow = /** @type {Window & {
    __portreeveInspectorInstalled?: boolean,
    __portreeveInspectorSelection?: unknown,
    __portreeveInspectorDescribe?: (element: Element) => unknown,
    __portreeveInspectorSelect?: (element: Element, report?: boolean) => unknown,
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

  /** @param {Element} element */
  const describe = (element) => {
    const style = window.getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    const text = (element.textContent ?? '').replace(/\s+/gu, ' ').trim();
    return {
      schemaVersion: 1,
      selectedAt: new Date().toISOString(),
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

  const highlight = document.createElement('div');
  highlight.setAttribute('data-portreeve-inspector-ui', 'highlight');
  Object.assign(highlight.style, {
    position: 'fixed',
    zIndex: '2147483646',
    display: 'none',
    pointerEvents: 'none',
    border: '2px solid #d9782d',
    background: 'rgb(217 120 45 / 12%)',
    boxShadow: '0 0 0 1px rgb(255 255 255 / 85%)',
  });

  const status = document.createElement('div');
  status.setAttribute('data-portreeve-inspector-ui', 'status');
  status.textContent =
    'Inspector ready · Option-click selects · Normal clicks are live';
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
  document.documentElement.append(highlight, status);

  /** @type {Element | null} */
  let selected = null;
  const positionHighlight = () => {
    if (selected === null || !selected.isConnected) {
      highlight.style.display = 'none';
      return;
    }
    const rectangle = selected.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: 'block',
      left: `${rectangle.left}px`,
      top: `${rectangle.top}px`,
      width: `${rectangle.width}px`,
      height: `${rectangle.height}px`,
    });
  };

  /** @param {Element} element @param {boolean} [report] */
  const selectElement = (element, report = true) => {
    selected = element;
    const descriptor = describe(element);
    inspectorWindow.__portreeveInspectorSelection = descriptor;
    status.textContent = `Selected · ${descriptor.selector}`;
    positionHighlight();
    if (report) void inspectorWindow.__portreeveInspectorReport?.(descriptor);
    return descriptor;
  };
  inspectorWindow.__portreeveInspectorSelect = selectElement;

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
    selectElement(element);
  };

  /** @param {MouseEvent} event */
  const suppressClick = (event) => {
    if (!event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  document.addEventListener('pointerdown', select, true);
  document.addEventListener('click', suppressClick, true);
  window.addEventListener('resize', positionHighlight);
  document.addEventListener('scroll', positionHighlight, true);
}
